import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeHistoryStore, type PracticeSession } from '@/stores/practiceHistoryStore';
import { ArrowLeft, Trophy, Clock, Target, Zap, TrendingUp, Calendar, Music, Trash2, BarChart3, Guitar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function formatTime(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatDateFull(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface ChordFrequency {
  symbol: string;
  count: number;
  correctCount: number;
}

function useStats(sessions: PracticeSession[]) {
  return useMemo(() => {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalPracticeTime: 0,
        overallAccuracy: 0,
        totalAttempts: 0,
        bestAccuracy: 0,
        avgSessionTime: 0,
        chordFrequencies: [] as ChordFrequency[],
        recentTrend: [] as { date: string; accuracy: number; sessions: number }[],
        streakDays: 0,
      };
    }

    const totalPracticeTime = sessions.reduce((sum, s) => sum + s.totalDurationMs, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.totalCorrect, 0);
    const totalAttempts = sessions.reduce((sum, s) => sum + s.totalCorrect + s.totalSkipped, 0);
    const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
    const bestAccuracy = Math.max(...sessions.map((s) => s.accuracyRate));

    // Chord frequencies
    const chordMap = new Map<string, { count: number; correct: number }>();
    sessions.forEach((s) => {
      s.attempts.forEach((a) => {
        const prev = chordMap.get(a.chordSymbol) ?? { count: 0, correct: 0 };
        prev.count++;
        if (a.result === 'correct') prev.correct++;
        chordMap.set(a.chordSymbol, prev);
      });
    });
    const chordFrequencies = [...chordMap.entries()]
      .map(([symbol, data]) => ({ symbol, count: data.count, correctCount: data.correct }))
      .sort((a, b) => b.count - a.count);

    // Recent trend by day (last 14 days)
    const dayMap = new Map<string, { correct: number; total: number; sessions: number }>();
    sessions.forEach((s) => {
      const dateKey = new Date(s.date).toLocaleDateString();
      const prev = dayMap.get(dateKey) ?? { correct: 0, total: 0, sessions: 0 };
      prev.correct += s.totalCorrect;
      prev.total += s.totalCorrect + s.totalSkipped;
      prev.sessions++;
      dayMap.set(dateKey, prev);
    });
    const recentTrend = [...dayMap.entries()]
      .map(([date, data]) => ({
        date,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        sessions: data.sessions,
      }))
      .slice(0, 14)
      .reverse();

    // Streak days
    let streakDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today.getTime() - i * 86400000);
      const dateKey = checkDate.toLocaleDateString();
      if (dayMap.has(dateKey)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      totalSessions: sessions.length,
      totalPracticeTime,
      overallAccuracy,
      totalAttempts,
      bestAccuracy,
      avgSessionTime: totalPracticeTime / sessions.length,
      chordFrequencies,
      recentTrend,
      streakDays,
    };
  }, [sessions]);
}

function SessionCard({ session, index }: { session: PracticeSession; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const total = session.totalCorrect + session.totalSkipped;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
      className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm overflow-hidden"
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 hover:bg-[hsl(var(--bg-overlay)/0.3)] transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${
              session.accuracyRate >= 80 ? 'bg-[hsl(var(--semantic-success)/0.12)]' :
              session.accuracyRate >= 50 ? 'bg-[hsl(var(--color-primary)/0.12)]' :
              'bg-[hsl(var(--semantic-error)/0.08)]'
            }`}>
              <span className={`font-display text-sm font-extrabold ${
                session.accuracyRate >= 80 ? 'text-[hsl(var(--semantic-success))]' :
                session.accuracyRate >= 50 ? 'text-[hsl(var(--color-primary))]' :
                'text-[hsl(var(--semantic-error))]'
              }`}>{session.accuracyRate.toFixed(0)}%</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-display font-bold text-[hsl(var(--text-default))]">
                  {session.mode === 'progression' ? 'Progression' : 'Chord'} Practice
                </span>
                <span className="text-[10px] font-body text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface))] rounded px-1.5 py-0.5">
                  {total} chords
                </span>
              </div>
              <p className="text-xs font-body text-[hsl(var(--text-muted))] mt-0.5">
                {formatDateFull(session.date)} · {formatDuration(session.totalDurationMs)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-body text-[hsl(var(--semantic-success))]">{session.totalCorrect}✓</span>
            {session.totalSkipped > 0 && <span className="text-xs font-body text-[hsl(var(--text-muted))]">{session.totalSkipped}↷</span>}
          </div>
        </div>
        {/* Chord chips */}
        <div className="flex flex-wrap gap-1 mt-2">
          {session.chords.slice(0, 10).map((ch, i) => (
            <span key={`${ch}-${i}`} className="text-[10px] font-display font-bold text-[hsl(var(--text-subtle))] bg-[hsl(var(--bg-surface))] rounded px-1.5 py-0.5">{ch}</span>
          ))}
          {session.chords.length > 10 && (
            <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">+{session.chords.length - 10}</span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-[hsl(var(--border-subtle)/0.3)]">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-center py-1.5">
                  <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Avg Time</p>
                  <p className="text-sm font-display font-bold text-[hsl(var(--color-primary))]">{formatTime(session.avgResponseTimeMs)}</p>
                </div>
                <div className="text-center py-1.5">
                  <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Fastest</p>
                  <p className="text-sm font-display font-bold text-[hsl(var(--color-emphasis))]">{formatTime(session.fastestTimeMs)}</p>
                </div>
                <div className="text-center py-1.5">
                  <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Duration</p>
                  <p className="text-sm font-display font-bold text-[hsl(var(--text-default))]">{formatDuration(session.totalDurationMs)}</p>
                </div>
              </div>
              {/* Attempt log */}
              <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-none">
                {session.attempts.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                    a.result === 'correct' ? 'bg-[hsl(var(--semantic-success)/0.04)]' : 'bg-[hsl(var(--bg-surface)/0.3)]'
                  }`}>
                    <span className="font-display font-bold text-[hsl(var(--text-muted))] tabular-nums w-4 text-center">{i + 1}</span>
                    <span className={`font-display font-bold flex-1 ${a.result === 'correct' ? 'text-[hsl(var(--text-default))]' : 'text-[hsl(var(--text-subtle))]'}`}>{a.chordSymbol}</span>
                    <span className={`tabular-nums ${a.result === 'correct' ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-muted))]'}`}>{formatTime(a.timeMs)}</span>
                    <span className={a.result === 'correct' ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-muted))]'}>{a.result === 'correct' ? '✓' : '↷'}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TrendBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="w-full h-24 sm:h-28 flex items-end justify-center bg-[hsl(var(--bg-surface)/0.3)] rounded-t-lg overflow-hidden">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(pct, 4)}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`w-full rounded-t-md ${
            value >= 80 ? 'bg-[hsl(var(--semantic-success)/0.6)]' :
            value >= 50 ? 'bg-[hsl(var(--color-primary)/0.5)]' :
            'bg-[hsl(var(--semantic-error)/0.4)]'
          }`}
        />
      </div>
      <span className="text-[9px] font-body text-[hsl(var(--text-muted))] truncate w-full text-center">{label}</span>
    </div>
  );
}

export default function PracticeHistory() {
  const navigate = useNavigate();
  const { sessions, clearHistory } = usePracticeHistoryStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const stats = useStats(sessions);

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
            <ArrowLeft className="size-4" /> Back
          </button>
          {sessions.length > 0 && (
            <div className="relative">
              {!showConfirmClear ? (
                <button onClick={() => setShowConfirmClear(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)] transition-colors">
                  <Trash2 className="size-3.5" /> Clear History
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-body text-[hsl(var(--semantic-error))]">Clear all?</span>
                  <button onClick={() => { clearHistory(); setShowConfirmClear(false); }} className="px-2.5 py-1 rounded text-xs font-display font-bold bg-[hsl(var(--semantic-error))] text-white hover:bg-[hsl(var(--semantic-error)/0.8)] transition-colors">Yes</button>
                  <button onClick={() => setShowConfirmClear(false)} className="px-2.5 py-1 rounded text-xs font-display font-bold border border-[hsl(var(--border-default))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">No</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-[hsl(var(--color-primary)/0.12)]">
            <BarChart3 className="size-5 text-[hsl(var(--color-primary))]" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[hsl(var(--text-default))]">Practice History</h1>
            <p className="text-xs font-body text-[hsl(var(--text-muted))]">{stats.totalSessions} sessions recorded</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="px-4 sm:px-6 py-16 text-center">
          <Trophy className="size-12 mx-auto mb-4 text-[hsl(var(--text-muted)/0.2)]" />
          <h2 className="font-display text-lg font-bold text-[hsl(var(--text-default))] mb-2">No Practice History</h2>
          <p className="text-sm font-body text-[hsl(var(--text-muted))] mb-6 max-w-sm mx-auto">Complete a practice session to start tracking your progress. Your accuracy, response times, and most-practiced chords will appear here.</p>
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-95 transition-all">
            Start Practicing
          </button>
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-24 max-w-4xl mx-auto space-y-5">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-[hsl(var(--semantic-success)/0.08)] border border-[hsl(var(--semantic-success)/0.2)] px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Target className="size-3.5 text-[hsl(var(--semantic-success))]" />
                <span className="text-[10px] font-body font-medium text-[hsl(var(--semantic-success))] uppercase tracking-wider">Accuracy</span>
              </div>
              <span className="font-display text-2xl font-extrabold text-[hsl(var(--semantic-success))]">{stats.overallAccuracy.toFixed(0)}%</span>
            </div>
            <div className="rounded-xl bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.2)] px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Clock className="size-3.5 text-[hsl(var(--color-primary))]" />
                <span className="text-[10px] font-body font-medium text-[hsl(var(--color-primary))] uppercase tracking-wider">Total Time</span>
              </div>
              <span className="font-display text-2xl font-extrabold text-[hsl(var(--color-primary))]">{formatDuration(stats.totalPracticeTime)}</span>
            </div>
            <div className="rounded-xl bg-[hsl(var(--color-emphasis)/0.08)] border border-[hsl(var(--color-emphasis)/0.2)] px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap className="size-3.5 text-[hsl(var(--color-emphasis))]" />
                <span className="text-[10px] font-body font-medium text-[hsl(var(--color-emphasis))] uppercase tracking-wider">Best</span>
              </div>
              <span className="font-display text-2xl font-extrabold text-[hsl(var(--color-emphasis))]">{stats.bestAccuracy.toFixed(0)}%</span>
            </div>
            <div className="rounded-xl bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Calendar className="size-3.5 text-[hsl(var(--text-muted))]" />
                <span className="text-[10px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">Streak</span>
              </div>
              <span className="font-display text-2xl font-extrabold text-[hsl(var(--text-default))]">{stats.streakDays} <span className="text-sm font-body text-[hsl(var(--text-muted))]">day{stats.streakDays !== 1 ? 's' : ''}</span></span>
            </div>
          </div>

          {/* Accuracy Trend */}
          {stats.recentTrend.length > 1 && (
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="size-4 text-[hsl(var(--color-primary))]" />
                <h3 className="font-display text-sm font-bold text-[hsl(var(--text-default))] uppercase tracking-wider">Accuracy Trend</h3>
              </div>
              <div className="flex gap-1 items-end">
                {stats.recentTrend.map((day, i) => (
                  <TrendBar key={i} value={day.accuracy} max={100} label={day.date.split('/').slice(0, 2).join('/')} />
                ))}
              </div>
            </div>
          )}

          {/* Most Practiced Chords */}
          {stats.chordFrequencies.length > 0 && (
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Music className="size-4 text-[hsl(var(--color-emphasis))]" />
                <h3 className="font-display text-sm font-bold text-[hsl(var(--text-default))] uppercase tracking-wider">Most Practiced Chords</h3>
              </div>
              <div className="space-y-1.5">
                {stats.chordFrequencies.slice(0, 12).map((cf) => {
                  const maxCount = stats.chordFrequencies[0].count;
                  const pct = maxCount > 0 ? (cf.count / maxCount) * 100 : 0;
                  const accPct = cf.count > 0 ? (cf.correctCount / cf.count) * 100 : 0;
                  return (
                    <div key={cf.symbol} className="flex items-center gap-3">
                      <span className="font-display font-bold text-sm text-[hsl(var(--text-default))] w-12 text-right shrink-0">{cf.symbol}</span>
                      <div className="flex-1 h-6 bg-[hsl(var(--bg-surface)/0.4)] rounded-md overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, 3)}%` }}
                          transition={{ duration: 0.5, delay: 0.05 }}
                          className={`h-full rounded-md ${accPct >= 80 ? 'bg-[hsl(var(--semantic-success)/0.35)]' : accPct >= 50 ? 'bg-[hsl(var(--color-primary)/0.3)]' : 'bg-[hsl(var(--semantic-error)/0.25)]'}`}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span className="text-[10px] font-body font-medium text-[hsl(var(--text-subtle))]">{cf.count} attempts</span>
                          <span className={`text-[10px] font-display font-bold ${accPct >= 80 ? 'text-[hsl(var(--semantic-success))]' : accPct >= 50 ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--semantic-error))]'}`}>{accPct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session Timeline */}
          <div>
            <h3 className="font-display text-sm font-bold text-[hsl(var(--text-default))] uppercase tracking-wider mb-3">Session Timeline</h3>
            <div className="space-y-2">
              {(() => {
                let lastDateLabel = '';
                return sessions.map((s, i) => {
                  const dateLabel = formatDate(s.date);
                  const showDate = dateLabel !== lastDateLabel;
                  lastDateLabel = dateLabel;
                  return (
                    <div key={s.id}>
                      {showDate && (
                        <div className="flex items-center gap-2 mt-3 mb-1.5">
                          <Calendar className="size-3 text-[hsl(var(--text-muted))]" />
                          <span className="text-xs font-display font-bold text-[hsl(var(--text-muted))] uppercase tracking-wider">{dateLabel}</span>
                          <div className="flex-1 h-px bg-[hsl(var(--border-subtle)/0.3)]" />
                        </div>
                      )}
                      <SessionCard session={s} index={i} />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
