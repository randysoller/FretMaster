import { useState, useEffect } from 'react';
import { useMetronomeStore } from '@/stores/metronomeStore';
import { Link2, Link2Off, Minus, Plus, Eye, ChevronDown, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BeatSyncControls() {
  const store = useMetronomeStore();
  const [expanded, setExpanded] = useState(store.syncEnabled);

  // Auto-collapse when count-in starts
  useEffect(() => {
    if (store.isCountingIn) setExpanded(false);
  }, [store.isCountingIn]);

  const isActive = store.isPlaying && store.syncEnabled;

  const handleStartStop = () => {
    if (store.isCountingIn || isActive) {
      store.stopCountIn();
    } else {
      store.startCountIn();
    }
  };

  // Compute display text for count-in overlay
  const getCountInDisplay = () => {
    if (!store.isCountingIn || store.countInBeat === 0) return null;
    const isLast = store.countInBeat === store.countInTotal;
    if (isLast) return { text: 'START', isStart: true };
    const measureBeat = ((store.countInBeat - 1) % store.beatsPerMeasure) + 1;
    return { text: String(measureBeat), isStart: false };
  };

  const countInDisplay = getCountInDisplay();

  return (
    <>
      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm overflow-hidden">
        {/* Header row with toggle and Start/Stop button */}
        <div className="flex items-center gap-2 pr-2">
          {/* Collapsible header toggle */}
          <button
            onClick={() => {
              if (!store.syncEnabled && !expanded) {
                setExpanded(true);
              } else if (!store.syncEnabled && expanded) {
                setExpanded(false);
              } else {
                setExpanded(!expanded);
              }
            }}
            className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--bg-overlay)/0.5)] transition-colors min-w-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {store.syncEnabled ? (
                <Link2 className="size-4 text-[hsl(var(--color-emphasis))] shrink-0" />
              ) : (
                <Link2Off className="size-4 text-[hsl(var(--text-muted))] shrink-0" />
              )}
              <span className="text-sm font-display font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider shrink-0">
                Beat Sync
              </span>
              {store.syncEnabled && !store.isCountingIn && (
                <span className="text-xs font-body text-[hsl(var(--color-emphasis))] bg-[hsl(var(--color-emphasis)/0.12)] rounded-full px-2 py-0.5 truncate">
                  Every {store.beatsPerChord} {store.syncUnit === 'measures' ? `measure${store.beatsPerChord > 1 ? 's' : ''}` : `beat${store.beatsPerChord > 1 ? 's' : ''}`}
                </span>
              )}
              {store.isCountingIn && (
                <span className="text-xs font-body text-[hsl(var(--semantic-error))] bg-[hsl(var(--semantic-error)/0.12)] rounded-full px-2 py-0.5 animate-pulse">
                  Count-in...
                </span>
              )}
            </div>
            <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Start/Stop button — always visible */}
          <button
            onClick={handleStartStop}
            className={`
              flex items-center justify-center gap-2 shrink-0 rounded-xl min-h-[48px] px-5 font-display font-bold text-sm transition-all duration-200 active:scale-95
              ${store.isCountingIn || isActive
                ? 'bg-[hsl(var(--semantic-error)/0.15)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.4)] hover:bg-[hsl(var(--semantic-error)/0.25)]'
                : 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--color-primary)/0.25)]'
              }
            `}
          >
            {store.isCountingIn || isActive ? (
              <><Square className="size-4 fill-current" /> Stop</>
            ) : (
              <><Play className="size-4 fill-current" /> Start</>
            )}
          </button>
        </div>

        {/* Expanded controls */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[hsl(var(--border-subtle))] pt-3">
                {/* Sync unit toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => store.setSyncUnit('beats')}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-display font-bold transition-all active:scale-95 ${
                      store.syncUnit === 'beats'
                        ? 'bg-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))]'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                    }`}
                  >
                    Beats
                  </button>
                  <button
                    onClick={() => store.setSyncUnit('measures')}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-display font-bold transition-all active:scale-95 ${
                      store.syncUnit === 'measures'
                        ? 'bg-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))]'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                    }`}
                  >
                    Measures
                  </button>
                </div>

                {/* Count control */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-body text-[hsl(var(--text-subtle))]">Advance every</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => store.setBeatsPerChord(store.beatsPerChord - 1)}
                      className="size-10 flex items-center justify-center rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors active:scale-95"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="text-base font-display font-bold text-[hsl(var(--color-emphasis))] tabular-nums w-6 text-center">
                      {store.beatsPerChord}
                    </span>
                    <button
                      onClick={() => store.setBeatsPerChord(store.beatsPerChord + 1)}
                      className="size-10 flex items-center justify-center rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors active:scale-95"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="text-sm font-body text-[hsl(var(--text-subtle))]">
                    {store.syncUnit === 'measures' ? 'measures' : 'beats'}
                  </span>
                </div>

                {/* Auto-reveal toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4 text-[hsl(var(--text-muted))]" />
                    <span className="text-sm font-body text-[hsl(var(--text-subtle))]">Auto-reveal before advancing</span>
                  </div>
                  <button
                    onClick={() => store.setAutoRevealBeforeAdvance(!store.autoRevealBeforeAdvance)}
                    className={`
                      relative w-12 h-7 rounded-full transition-colors duration-200
                      ${store.autoRevealBeforeAdvance ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-default))]'}
                    `}
                  >
                    <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ${store.autoRevealBeforeAdvance ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Count-in length */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-body text-[hsl(var(--text-subtle))]">Count-in</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 4].map((m) => (
                      <button
                        key={m}
                        onClick={() => store.setCountInMeasures(m)}
                        className={`rounded-lg px-3 py-2 text-sm font-display font-bold transition-all active:scale-95 ${
                          store.countInMeasures === m
                            ? 'bg-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))]'
                            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                        }`}
                      >
                        {m} {m === 1 ? 'bar' : 'bars'}
                      </button>
                    ))}
                  </div>
                </div>

            {/* Summary text */}
            <p className="text-xs font-body text-[hsl(var(--text-muted))] leading-relaxed">
              Counts in {store.countInMeasures} {store.countInMeasures === 1 ? 'measure' : 'measures'}, then auto-advances every {store.beatsPerChord}{' '}
              {store.syncUnit === 'measures'
                ? `measure${store.beatsPerChord > 1 ? 's' : ''} (${store.beatsPerChord * store.beatsPerMeasure} beats)`
                : `beat${store.beatsPerChord > 1 ? 's' : ''}`}
              {' '}during practice.
              {store.autoRevealBeforeAdvance ? ' Chord is revealed 2 beats before advancing.' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Count-in visual overlay */}
      <AnimatePresence>
        {store.isCountingIn && countInDisplay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            {/* Dimmed backdrop */}
            <div className="absolute inset-0 bg-[hsl(var(--bg-base)/0.4)]" />
            <AnimatePresence mode="wait">
              <motion.div
                key={store.countInBeat}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                {countInDisplay.isStart ? (
                  <span
                    className="font-display text-8xl sm:text-9xl font-black uppercase tracking-wider text-[hsl(142_71%_45%)]"
                    style={{ textShadow: '0 0 40px hsl(142 71% 45% / 0.5), 0 0 80px hsl(142 71% 45% / 0.2), 0 4px 20px hsl(0 0% 0% / 0.4)' }}
                  >
                    START
                  </span>
                ) : (
                  <span
                    className="font-display text-[10rem] sm:text-[14rem] font-black leading-none tabular-nums text-[hsl(0_84%_60%)]"
                    style={{ textShadow: '0 0 40px hsl(0 84% 60% / 0.5), 0 0 80px hsl(0 84% 60% / 0.2), 0 4px 20px hsl(0 0% 0% / 0.4)' }}
                  >
                    {countInDisplay.text}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
