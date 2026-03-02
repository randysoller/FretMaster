import { useEffect, useRef, useState, useCallback } from 'react';
import { useMetronomeStore, onBeat } from '@/stores/metronomeStore';
import type { StrummingPattern, StrumType } from '@/constants/strumming';
import { getStyleStrumming } from '@/constants/strumming';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Strum action rendering ─────────────────────────────

function StrumArrow({ type, active, index }: { type: StrumType; active: boolean; index: number }) {
  const isAccent = type === 'Ad' || type === 'Au';
  const isDown = type === 'D' || type === 'Ad';
  const isUp = type === 'U' || type === 'Au';
  const isMute = type === 'mute';
  const isRest = type === 'rest';

  if (isRest) {
    return (
      <div
        className={`flex items-center justify-center w-full transition-all duration-100 ${
          active ? 'opacity-60' : 'opacity-20'
        }`}
        style={{ height: 36 }}
      >
        <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">·</span>
      </div>
    );
  }

  if (isMute) {
    return (
      <div
        className={`flex items-center justify-center w-full rounded-md transition-all duration-100 ${
          active
            ? 'bg-[hsl(var(--text-muted)/0.25)]'
            : 'bg-[hsl(var(--text-muted)/0.06)]'
        }`}
        style={{ height: 36 }}
      >
        <span className={`font-display text-xs font-bold transition-colors duration-100 ${
          active ? 'text-[hsl(var(--text-subtle))]' : 'text-[hsl(var(--text-muted)/0.4)]'
        }`}>
          ✕
        </span>
      </div>
    );
  }

  // Down or Up stroke
  const color = active
    ? isAccent
      ? 'hsl(var(--color-emphasis))'
      : 'hsl(var(--color-primary))'
    : isAccent
      ? 'hsl(var(--color-emphasis) / 0.3)'
      : 'hsl(var(--text-muted) / 0.25)';

  const glowColor = isAccent
    ? 'hsl(var(--color-emphasis) / 0.4)'
    : 'hsl(var(--color-primary) / 0.3)';

  return (
    <div
      className="flex items-center justify-center w-full transition-all duration-100"
      style={{ height: 36 }}
    >
      <svg
        width={isAccent ? 20 : 16}
        height={isAccent ? 28 : 24}
        viewBox="0 0 16 24"
        className={`transition-all duration-100 ${active ? 'scale-110' : ''}`}
        style={{
          filter: active ? `drop-shadow(0 0 6px ${glowColor})` : 'none',
        }}
      >
        {isDown ? (
          <>
            {/* Down arrow */}
            <line x1="8" y1="2" x2="8" y2="18" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" />
            <polyline points="3,14 8,20 13,14" fill="none" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            {/* Up arrow */}
            <line x1="8" y1="22" x2="8" y2="6" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" />
            <polyline points="3,10 8,4 13,10" fill="none" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Beat group divider ──────────────────────────────────

function BeatGroup({
  beatIndex,
  subdivisions,
  pattern,
  activeSubIndex,
  patternOffset,
}: {
  beatIndex: number;
  subdivisions: number;
  pattern: StrumType[];
  activeSubIndex: number;
  patternOffset: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Beat number */}
      <span className={`text-[10px] font-display font-bold tabular-nums transition-colors duration-100 ${
        activeSubIndex >= patternOffset && activeSubIndex < patternOffset + subdivisions
          ? 'text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--text-muted)/0.4)]'
      }`}>
        {beatIndex + 1}
      </span>
      {/* Subdivision cells */}
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: subdivisions }, (_, s) => {
          const pIdx = patternOffset + s;
          const action = pattern[pIdx % pattern.length];
          const isActive = pIdx === activeSubIndex;
          return (
            <div
              key={s}
              className={`rounded-md transition-all duration-100 ${
                isActive
                  ? 'bg-[hsl(var(--color-primary)/0.12)] ring-1 ring-[hsl(var(--color-primary)/0.4)]'
                  : 'bg-transparent'
              }`}
              style={{ width: subdivisions <= 2 ? 32 : subdivisions <= 3 ? 26 : 22, minWidth: 18 }}
            >
              <StrumArrow type={action} active={isActive} index={pIdx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main display component ─────────────────────────────

interface StrummingPatternDisplayProps {
  styleId: string;
  /** If true, sync with the metronome and animate the current position */
  animated?: boolean;
  /** If provided, only show this specific pattern (otherwise show selector) */
  patternId?: string;
  /** Compact mode for practice view */
  compact?: boolean;
}

export default function StrummingPatternDisplay({
  styleId,
  animated = true,
  patternId,
  compact = false,
}: StrummingPatternDisplayProps) {
  const patterns = getStyleStrumming(styleId);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSubIndex, setActiveSubIndex] = useState(-1);

  const metronome = useMetronomeStore();
  const lastBeatTimeRef = useRef(0);
  const rafRef = useRef(0);
  const currentBeatRef = useRef(0);

  // Find the selected pattern
  const pattern = patternId
    ? patterns.find((p) => p.id === patternId) ?? patterns[0]
    : patterns[selectedIdx] ?? null;

  if (!pattern || patterns.length === 0) return null;

  const totalSteps = pattern.pattern.length;

  // Subscribe to beat events for timing reference
  useEffect(() => {
    if (!animated) return;
    const unsub = onBeat((beat) => {
      currentBeatRef.current = beat;
      lastBeatTimeRef.current = performance.now();
    });
    return unsub;
  }, [animated]);

  // RAF loop for smooth subdivision tracking
  useEffect(() => {
    if (!animated) {
      setActiveSubIndex(-1);
      return;
    }

    const tick = () => {
      const state = useMetronomeStore.getState();
      if (!state.isPlaying || !pattern) {
        setActiveSubIndex(-1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      const beatDurationMs = (60 / state.bpm) * 1000;
      const elapsed = now - lastBeatTimeRef.current;
      const beatFraction = Math.min(elapsed / beatDurationMs, 0.999);

      // Current subdivision within this beat
      const subInBeat = Math.floor(beatFraction * pattern.subdivisions);

      // Global position in pattern
      const beatInPattern = currentBeatRef.current % pattern.beats;
      const globalIdx = (beatInPattern * pattern.subdivisions + subInBeat) % totalSteps;

      setActiveSubIndex(globalIdx);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animated, pattern, totalSteps]);

  return (
    <div className={`rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
      {/* Header with pattern selector */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
            Strumming Pattern
          </span>
        </div>

        {patterns.length > 1 && !patternId && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-display font-bold bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-all"
            >
              <span className="max-w-[120px] truncate">{pattern.name}</span>
              <ChevronDown className={`size-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute z-30 top-full mt-1 right-0 w-56 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden"
                >
                  {patterns.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedIdx(i); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        i === selectedIdx
                          ? 'bg-[hsl(var(--color-primary)/0.1)]'
                          : 'hover:bg-[hsl(var(--bg-overlay))]'
                      }`}
                    >
                      <p className={`text-xs font-display font-bold ${
                        i === selectedIdx ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                      }`}>
                        {p.name}
                      </p>
                      <p className="text-[10px] font-body text-[hsl(var(--text-muted))] mt-0.5">
                        {p.description}
                      </p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Description */}
      {!compact && (
        <p className="text-xs font-body text-[hsl(var(--text-muted))] mb-3">
          {pattern.description}
        </p>
      )}

      {/* Pattern visualization */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
        {Array.from({ length: pattern.beats }, (_, beatIdx) => (
          <BeatGroup
            key={beatIdx}
            beatIndex={beatIdx}
            subdivisions={pattern.subdivisions}
            pattern={pattern.pattern}
            activeSubIndex={activeSubIndex}
            patternOffset={beatIdx * pattern.subdivisions}
          />
        ))}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[hsl(var(--border-subtle)/0.5)]">
          <LegendItem symbol="↓" label="Down" color="text-[hsl(var(--text-muted))]" />
          <LegendItem symbol="↑" label="Up" color="text-[hsl(var(--text-muted))]" />
          <LegendItem symbol="↓" label="Accent" color="text-[hsl(var(--color-emphasis))]" bold />
          <LegendItem symbol="✕" label="Mute" color="text-[hsl(var(--text-muted))]" />
          <LegendItem symbol="·" label="Rest" color="text-[hsl(var(--text-muted))]" />
        </div>
      )}

      {/* Subdivision info */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.5)]">
          {pattern.subdivisions === 2 ? '8th notes' : pattern.subdivisions === 3 ? 'Triplets' : '16th notes'}
          {' · '}
          {pattern.beats} beats
        </span>
        {animated && metronome.isPlaying && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />
            <span className="text-[10px] font-body text-[hsl(var(--semantic-success))]">Synced</span>
          </span>
        )}
      </div>
    </div>
  );
}

function LegendItem({ symbol, label, color, bold }: { symbol: string; label: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-sm ${color} ${bold ? 'font-bold' : ''}`}>{symbol}</span>
      <span className="text-[9px] font-body text-[hsl(var(--text-muted)/0.5)]">{label}</span>
    </div>
  );
}

// ─── Setup preview (non-animated, shows all patterns for a style) ──

export function StrummingPatternPreview({ styleId }: { styleId: string }) {
  const patterns = getStyleStrumming(styleId);
  if (patterns.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {patterns.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-lg bg-[hsl(var(--bg-surface)/0.5)] px-3 py-2">
          {/* Mini pattern preview */}
          <div className="flex items-center gap-[1px] shrink-0">
            {p.pattern.slice(0, Math.min(p.pattern.length, 16)).map((action, i) => {
              const isAccent = action === 'Ad' || action === 'Au';
              const isDown = action === 'D' || action === 'Ad';
              const isUp = action === 'U' || action === 'Au';
              const isMute = action === 'mute';
              const isRest = action === 'rest';
              return (
                <span
                  key={i}
                  className={`text-[9px] font-display font-bold w-2.5 text-center ${
                    isRest
                      ? 'text-[hsl(var(--text-muted)/0.2)]'
                      : isMute
                        ? 'text-[hsl(var(--text-muted)/0.35)]'
                        : isAccent
                          ? 'text-[hsl(var(--color-emphasis))]'
                          : 'text-[hsl(var(--text-subtle)/0.6)]'
                  }`}
                >
                  {isRest ? '·' : isMute ? '✕' : isDown ? '↓' : isUp ? '↑' : '·'}
                </span>
              );
            })}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-display font-bold text-[hsl(var(--text-default))] truncate">
              {p.name}
            </p>
            <p className="text-[9px] font-body text-[hsl(var(--text-muted))] truncate">
              {p.subdivisions === 2 ? '8ths' : p.subdivisions === 3 ? 'Triplets' : '16ths'}
              {' · '}
              {p.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
