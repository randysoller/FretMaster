import { useMemo, useState } from 'react';
import type { ConfusionEntry } from '@/stores/practiceHistoryStore';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompareArrows, Trash2, ChevronDown, Info } from 'lucide-react';

interface ConfusionMatrixProps {
  data: ConfusionEntry[];
  onClear: () => void;
}

interface ConfusionPair {
  expected: string;
  detected: string;
  count: number;
  /** Reverse direction count (detected→expected) */
  reverseCount: number;
}

export default function ConfusionMatrix({ data, onClear }: ConfusionMatrixProps) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const pairs = useMemo(() => {
    if (data.length === 0) return [];

    // Build bidirectional pairs, sorted by total confusion count
    const pairMap = new Map<string, ConfusionPair>();
    for (const entry of data) {
      const key = [entry.expected, entry.detected].sort().join('↔');
      const existing = pairMap.get(key);
      if (existing) {
        if (entry.expected === existing.expected) {
          existing.count += entry.count;
        } else {
          existing.reverseCount += entry.count;
        }
      } else {
        pairMap.set(key, {
          expected: entry.expected,
          detected: entry.detected,
          count: entry.count,
          reverseCount: 0,
        });
      }
    }

    return [...pairMap.values()]
      .map((p) => ({ ...p, total: p.count + p.reverseCount }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const topPairs = expanded ? pairs : pairs.slice(0, 8);
  const maxTotal = pairs.length > 0 ? Math.max(...pairs.map((p) => p.count + p.reverseCount)) : 1;
  const totalConfusions = data.reduce((sum, e) => sum + e.count, 0);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-[hsl(var(--semantic-error)/0.8)]" />
          <h3 className="font-display text-sm font-bold text-[hsl(var(--text-default))] uppercase tracking-wider">
            Chord Confusions
          </h3>
          <span className="text-[10px] font-display font-bold text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface))] rounded-full px-2 py-0.5">
            {totalConfusions} total
          </span>
        </div>
        <div className="relative">
          {!showConfirmClear ? (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)] transition-colors"
            >
              <Trash2 className="size-3" /> Clear
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-body text-[hsl(var(--semantic-error))]">Clear all?</span>
              <button
                onClick={() => { onClear(); setShowConfirmClear(false); }}
                className="px-2 py-0.5 rounded text-[10px] font-display font-bold bg-[hsl(var(--semantic-error))] text-white hover:bg-[hsl(var(--semantic-error)/0.8)] transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-2 py-0.5 rounded text-[10px] font-display font-bold border border-[hsl(var(--border-default))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info tooltip */}
      <div className="flex items-start gap-2 mb-3 rounded-lg bg-[hsl(var(--semantic-info)/0.06)] border border-[hsl(var(--semantic-info)/0.15)] px-3 py-2">
        <Info className="size-3.5 text-[hsl(var(--semantic-info))] shrink-0 mt-0.5" />
        <p className="text-[11px] font-body text-[hsl(var(--text-subtle))] leading-relaxed">
          These chord pairs are frequently confused during practice. Focus your practice on the top pairs to improve accuracy.
        </p>
      </div>

      {/* Confusion pairs */}
      <div className="space-y-2">
        {topPairs.map((pair, i) => {
          const total = pair.count + pair.reverseCount;
          const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          const severity =
            total >= 10 ? 'high' :
            total >= 5 ? 'medium' : 'low';
          const severityColors = {
            high: {
              bg: 'bg-[hsl(var(--semantic-error)/0.1)]',
              border: 'border-[hsl(var(--semantic-error)/0.25)]',
              text: 'text-[hsl(var(--semantic-error))]',
              bar: 'bg-[hsl(var(--semantic-error)/0.4)]',
            },
            medium: {
              bg: 'bg-[hsl(var(--color-emphasis)/0.08)]',
              border: 'border-[hsl(var(--color-emphasis)/0.2)]',
              text: 'text-[hsl(var(--color-emphasis))]',
              bar: 'bg-[hsl(var(--color-emphasis)/0.35)]',
            },
            low: {
              bg: 'bg-[hsl(var(--bg-surface)/0.5)]',
              border: 'border-[hsl(var(--border-subtle))]',
              text: 'text-[hsl(var(--text-subtle))]',
              bar: 'bg-[hsl(var(--color-primary)/0.25)]',
            },
          };
          const colors = severityColors[severity];

          return (
            <motion.div
              key={`${pair.expected}-${pair.detected}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
              className={`relative rounded-lg ${colors.bg} border ${colors.border} px-3 py-2.5 overflow-hidden`}
            >
              {/* Background bar showing relative frequency */}
              <div
                className={`absolute inset-y-0 left-0 ${colors.bar} transition-all duration-500`}
                style={{ width: `${Math.max(pct, 3)}%` }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Rank */}
                  <span className="font-display text-xs font-bold text-[hsl(var(--text-muted))] tabular-nums w-4 text-center shrink-0">
                    {i + 1}
                  </span>

                  {/* Chord pair */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-sm font-bold text-[hsl(var(--text-default))]">
                      {pair.expected}
                    </span>
                    <GitCompareArrows className={`size-3.5 ${colors.text} shrink-0`} />
                    <span className="font-display text-sm font-bold text-[hsl(var(--text-default))]">
                      {pair.detected}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Direction breakdown */}
                  <div className="flex items-center gap-1 text-[10px] font-body tabular-nums">
                    {pair.count > 0 && (
                      <span className="text-[hsl(var(--text-muted))]">
                        {pair.expected}→{pair.detected}: {pair.count}
                      </span>
                    )}
                    {pair.reverseCount > 0 && (
                      <>
                        {pair.count > 0 && <span className="text-[hsl(var(--border-default))]">|</span>}
                        <span className="text-[hsl(var(--text-muted))]">
                          {pair.detected}→{pair.expected}: {pair.reverseCount}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Total count badge */}
                  <span className={`font-display text-xs font-extrabold ${colors.text} tabular-nums`}>
                    {total}×
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Show more / less */}
      {pairs.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs font-body text-[hsl(var(--color-primary))] hover:underline mx-auto"
        >
          <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Show less' : `Show all ${pairs.length} pairs`}
        </button>
      )}
    </div>
  );
}
