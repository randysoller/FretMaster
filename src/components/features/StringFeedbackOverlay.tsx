import { motion, AnimatePresence } from 'framer-motion';
import type { StringFeedback, StringNoteStatus } from '@/hooks/useChordDetection';

interface StringFeedbackOverlayProps {
  feedback: StringFeedback[];
  isListening: boolean;
}

const STRING_LABELS = ['Low E', 'A', 'D', 'G', 'B', 'High E'];

const STATUS_CONFIG: Record<StringNoteStatus, { color: string; bg: string; ring: string; label: string; icon: string }> = {
  correct: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/40',
    label: 'Correct',
    icon: '✓',
  },
  missing: {
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    ring: 'ring-red-500/40',
    label: 'Missing',
    icon: '✗',
  },
  muted: {
    color: 'text-[hsl(var(--text-muted)/0.4)]',
    bg: 'bg-[hsl(var(--bg-surface)/0.3)]',
    ring: 'ring-transparent',
    label: 'Muted',
    icon: '—',
  },
  idle: {
    color: 'text-[hsl(var(--text-muted)/0.3)]',
    bg: 'bg-[hsl(var(--bg-surface)/0.2)]',
    ring: 'ring-transparent',
    label: 'Waiting',
    icon: '·',
  },
};

export default function StringFeedbackOverlay({ feedback, isListening }: StringFeedbackOverlayProps) {
  if (!isListening || feedback.length === 0) return null;

  const hasSignal = feedback.some((f) => f.status === 'correct' || f.status === 'missing');

  return (
    <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-3 sm:p-4 w-full max-w-[240px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-body text-[hsl(var(--text-muted))]">Correct</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-500" />
          <span className="text-[9px] font-body text-[hsl(var(--text-muted))]">Missing</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[hsl(var(--text-muted)/0.25)]" />
          <span className="text-[9px] font-body text-[hsl(var(--text-muted))]">Muted</span>
        </div>
      </div>

      <div className="space-y-1">
        {feedback.map((fb) => {
          const cfg = STATUS_CONFIG[fb.status];
          const barWidth = hasSignal && fb.status !== 'muted' ? Math.max(fb.strength * 100, 4) : 0;

          return (
            <div key={fb.stringIndex} className="flex items-center gap-2">
              {/* String number */}
              <span className="text-[11px] font-display font-bold text-[hsl(var(--text-muted)/0.5)] w-3 text-right tabular-nums">
                {6 - fb.stringIndex}
              </span>

              {/* Note name */}
              <span className={`text-xs font-display font-bold w-6 text-center ${
                fb.status === 'muted'
                  ? 'text-[hsl(var(--text-muted)/0.3)]'
                  : fb.status === 'correct'
                    ? 'text-emerald-400'
                    : fb.status === 'missing'
                      ? 'text-red-400'
                      : 'text-[hsl(var(--text-muted)/0.5)]'
              }`}>
                {fb.noteName}
              </span>

              {/* Strength bar */}
              <div className="flex-1 h-3 rounded-full bg-[hsl(var(--bg-surface))] overflow-hidden relative">
                <motion.div
                  className={`h-full rounded-full ${
                    fb.status === 'correct'
                      ? 'bg-emerald-500'
                      : fb.status === 'missing'
                        ? 'bg-red-500/50'
                        : 'bg-[hsl(var(--text-muted)/0.15)]'
                  }`}
                  initial={false}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                />
              </div>

              {/* Status icon */}
              <span className={`text-xs font-display font-bold w-4 text-center ${cfg.color}`}>
                {fb.status !== 'idle' ? cfg.icon : ''}
              </span>
            </div>
          );
        })}
      </div>

      {!hasSignal && (
        <p className="text-[10px] font-body text-[hsl(var(--text-muted)/0.5)] text-center mt-2">
          Play a chord to see string feedback
        </p>
      )}
    </div>
  );
}
