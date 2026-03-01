import { useState } from 'react';
import { useMetronomeStore } from '@/stores/metronomeStore';
import { Link2, Link2Off, Minus, Plus, Eye, ChevronDown } from 'lucide-react';

export default function BeatSyncControls() {
  const store = useMetronomeStore();
  const [expanded, setExpanded] = useState(store.syncEnabled);

  return (
    <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm overflow-hidden">
      {/* Header toggle */}
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
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--bg-overlay)/0.5)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {store.syncEnabled ? (
            <Link2 className="size-4 text-[hsl(var(--color-emphasis))]" />
          ) : (
            <Link2Off className="size-4 text-[hsl(var(--text-muted))]" />
          )}
          <span className="text-sm font-display font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
            Beat Sync
          </span>
          {store.syncEnabled && (
            <span className="text-xs font-body text-[hsl(var(--color-emphasis))] bg-[hsl(var(--color-emphasis)/0.12)] rounded-full px-2 py-0.5">
              Every {store.beatsPerChord} {store.syncUnit === 'measures' ? `measure${store.beatsPerChord > 1 ? 's' : ''}` : `beat${store.beatsPerChord > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[hsl(var(--border-subtle))]">
          {/* Enable toggle */}
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm font-body text-[hsl(var(--text-subtle))]">Auto-advance chords</span>
            <button
              onClick={() => store.setSyncEnabled(!store.syncEnabled)}
              className={`
                relative w-12 h-7 rounded-full transition-colors duration-200
                ${store.syncEnabled ? 'bg-[hsl(var(--color-emphasis))]' : 'bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-default))]'}
              `}
            >
              <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ${store.syncEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {store.syncEnabled && (
            <>
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

              {/* Summary text */}
              <p className="text-xs font-body text-[hsl(var(--text-muted))] leading-relaxed">
                Auto-advances to the next chord every {store.beatsPerChord}{' '}
                {store.syncUnit === 'measures'
                  ? `measure${store.beatsPerChord > 1 ? 's' : ''} (${store.beatsPerChord * store.beatsPerMeasure} beats)`
                  : `beat${store.beatsPerChord > 1 ? 's' : ''}`}
                {' '}during practice.
                {store.autoRevealBeforeAdvance ? ' Chord is revealed 2 beats before advancing.' : ''}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
