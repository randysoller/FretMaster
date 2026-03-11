import { motion } from 'framer-motion';

interface ConfidenceBarProps {
  confidence: number; // 0–1
  isListening: boolean;
}

function getBarColor(pct: number): string {
  if (pct >= 75) return 'hsl(142 71% 45%)';
  if (pct >= 50) return 'hsl(80 60% 45%)';
  if (pct >= 30) return 'hsl(45 93% 47%)';
  if (pct >= 15) return 'hsl(25 90% 50%)';
  return 'hsl(0 84% 55%)';
}

function getBarGlow(pct: number): string {
  if (pct >= 75) return '0 0 12px hsl(142 71% 45% / 0.5)';
  if (pct >= 50) return '0 0 8px hsl(80 60% 45% / 0.4)';
  if (pct >= 30) return '0 0 6px hsl(45 93% 47% / 0.3)';
  return 'none';
}

function getLabel(pct: number): string {
  if (pct >= 85) return 'Excellent';
  if (pct >= 70) return 'Good';
  if (pct >= 50) return 'Close';
  if (pct >= 25) return 'Partial';
  if (pct > 0) return 'Weak';
  return 'No signal';
}

function getLabelColor(pct: number): string {
  if (pct >= 70) return 'text-emerald-400';
  if (pct >= 50) return 'text-lime-400';
  if (pct >= 30) return 'text-amber-400';
  if (pct > 0) return 'text-orange-400';
  return 'text-[hsl(var(--text-muted)/0.4)]';
}

export default function ConfidenceBar({ confidence, isListening }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const color = getBarColor(pct);
  const glow = getBarGlow(pct);
  const label = getLabel(pct);
  const labelColor = getLabelColor(pct);

  if (!isListening) return null;

  return (
    <div className="w-full max-w-[320px] mx-auto mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
          Match Confidence
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-body font-medium ${labelColor}`}>
            {label}
          </span>
          <span
            className="text-sm font-display font-bold tabular-nums transition-colors duration-200"
            style={{ color }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-[hsl(var(--bg-surface))] overflow-hidden border border-[hsl(var(--border-subtle)/0.3)]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={false}
          animate={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: glow,
          }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        />
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
      </div>
      {/* Tick marks at 25/50/75 */}
      <div className="relative h-1.5 mt-0.5">
        {[25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 w-px h-1 bg-[hsl(var(--text-muted)/0.15)]"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
    </div>
  );
}
