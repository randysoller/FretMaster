import type { SessionSummary as SessionSummaryData } from '@/hooks/useSessionStats';
import { usePracticeHistoryStore } from '@/stores/practiceHistoryStore';
import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Clock, Target, Zap, TrendingUp, SkipForward, CheckCircle } from 'lucide-react';

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

interface SessionSummaryProps {
  summary: SessionSummaryData;
  onClose: () => void;
  mode?: 'single' | 'progression';
}

export default function SessionSummary({ summary, onClose, mode = 'single' }: SessionSummaryProps) {
  const { attempts, totalCorrect, totalSkipped, accuracyRate, avgResponseTimeMs, fastestTimeMs, slowestTimeMs, totalDurationMs } = summary;
  const hasAttempts = attempts.length > 0;
  const addSession = usePracticeHistoryStore((s) => s.addSession);

  // Save to history on mount
  const savedRef = useRef(false);
  useEffect(() => {
    if (hasAttempts && !savedRef.current) {
      savedRef.current = true;
      const chordSymbols = [...new Set(attempts.map((a) => a.chordSymbol))];
      addSession({
        date: Date.now(),
        mode,
        totalCorrect,
        totalSkipped,
        accuracyRate,
        avgResponseTimeMs,
        fastestTimeMs,
        totalDurationMs,
        attempts: attempts.map((a) => ({ chordSymbol: a.chordSymbol, chordName: a.chordName, result: a.result, timeMs: a.timeMs })),
        chords: chordSymbols,
      });
    }
  }, [hasAttempts]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md max-h-[85vh] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-[hsl(var(--border-subtle))]">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis)/0.3)]" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-[hsl(var(--color-primary)/0.12)]">
                <Trophy className="size-5 text-[hsl(var(--color-primary))]" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[hsl(var(--text-default))]">Session Summary</h2>
                <p className="text-xs font-body text-[hsl(var(--text-muted))]">{formatDuration(totalDurationMs)} total practice</p>
              </div>
            </div>
            <button onClick={onClose} className="flex items-center justify-center size-9 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {!hasAttempts ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-body text-[hsl(var(--text-muted))]">No chord attempts recorded this session.</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="px-5 pt-4 pb-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[hsl(var(--semantic-success)/0.08)] border border-[hsl(var(--semantic-success)/0.2)] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Target className="size-3.5 text-[hsl(var(--semantic-success))]" />
                    <span className="text-[10px] font-body font-medium text-[hsl(var(--semantic-success))] uppercase tracking-wider">Accuracy</span>
                  </div>
                  <span className="font-display text-2xl font-extrabold text-[hsl(var(--semantic-success))]">{accuracyRate.toFixed(0)}%</span>
                </div>
                <div className="rounded-xl bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.2)] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Clock className="size-3.5 text-[hsl(var(--color-primary))]" />
                    <span className="text-[10px] font-body font-medium text-[hsl(var(--color-primary))] uppercase tracking-wider">Avg Time</span>
                  </div>
                  <span className="font-display text-2xl font-extrabold text-[hsl(var(--color-primary))]">{formatTime(avgResponseTimeMs)}</span>
                </div>
                <div className="rounded-xl bg-[hsl(var(--color-emphasis)/0.08)] border border-[hsl(var(--color-emphasis)/0.2)] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Zap className="size-3.5 text-[hsl(var(--color-emphasis))]" />
                    <span className="text-[10px] font-body font-medium text-[hsl(var(--color-emphasis))] uppercase tracking-wider">Fastest</span>
                  </div>
                  <span className="font-display text-lg font-bold text-[hsl(var(--color-emphasis))]">{fastestTimeMs > 0 ? formatTime(fastestTimeMs) : '—'}</span>
                </div>
                <div className="rounded-xl bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <TrendingUp className="size-3.5 text-[hsl(var(--text-muted))]" />
                    <span className="text-[10px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">Attempts</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-display text-lg font-bold text-[hsl(var(--semantic-success))]">{totalCorrect}</span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">/</span>
                    <span className="font-display text-lg font-bold text-[hsl(var(--text-muted))]">{totalSkipped}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-[9px] font-body text-[hsl(var(--semantic-success))]">correct</span>
                    <span className="text-[9px] font-body text-[hsl(var(--text-muted))]">skipped</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attempt Log */}
            <div className="px-5 pb-1">
              <h3 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-2">Attempt Log</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
              <div className="space-y-1.5">
                {attempts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${
                      a.result === 'correct'
                        ? 'border-[hsl(var(--semantic-success)/0.15)] bg-[hsl(var(--semantic-success)/0.04)]'
                        : 'border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-surface)/0.5)]'
                    }`}
                  >
                    <span className="font-display text-xs font-bold text-[hsl(var(--text-muted))] tabular-nums w-5 text-center">{i + 1}</span>
                    {a.result === 'correct' ? (
                      <CheckCircle className="size-4 text-[hsl(var(--semantic-success))] shrink-0" />
                    ) : (
                      <SkipForward className="size-4 text-[hsl(var(--text-muted)/0.5)] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-display font-bold ${
                        a.result === 'correct' ? 'text-[hsl(var(--text-default))]' : 'text-[hsl(var(--text-subtle))]'
                      }`}>{a.chordSymbol}</span>
                    </div>
                    <span className={`text-xs font-body tabular-nums ${
                      a.result === 'correct' ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-muted))]'
                    }`}>
                      {formatTime(a.timeMs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-[hsl(var(--border-subtle))] px-5 py-3">
          <button onClick={onClose} className="w-full rounded-xl py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all">
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
