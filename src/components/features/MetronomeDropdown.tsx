import { useState, useRef, useEffect, useCallback } from 'react';
import { useMetronomeStore, SOUND_LABELS, type MetronomeSoundType } from '@/stores/metronomeStore';
import {
  Gauge, Play, Minus, Plus, Volume2, Volume1, VolumeX,
  ChevronUp, ChevronDown,
} from 'lucide-react';

function getTempoMarking(bpm: number): string {
  if (bpm < 40) return 'Grave';
  if (bpm < 55) return 'Largo';
  if (bpm < 66) return 'Larghetto';
  if (bpm < 76) return 'Adagio';
  if (bpm < 92) return 'Andante';
  if (bpm < 108) return 'Moderato';
  if (bpm < 120) return 'Allegretto';
  if (bpm < 156) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

function useTapTempo(onBpmChange: (bpm: number) => void) {
  const tapsRef = useRef<number[]>([]);
  return useCallback(() => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) { tapsRef.current = [now]; return; }
    taps.push(now);
    if (taps.length > 8) taps.shift();
    if (taps.length < 2) return;
    let total = 0;
    for (let i = 1; i < taps.length; i++) total += taps[i] - taps[i - 1];
    const bpm = Math.round(60000 / (total / (taps.length - 1)));
    if (bpm >= 30 && bpm <= 260) onBpmChange(bpm);
  }, [onBpmChange]);
}

/** Metronome SVG icon — orange outline style matching lucide icons */
function MetronomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Metronome body — trapezoidal shape */}
      <path d="M5 21h14l-3-18H8L5 21z" />
      {/* Pendulum arm */}
      <line x1="12" y1="21" x2="16" y2="5" />
      {/* Pendulum weight */}
      <circle cx="14.5" cy="11" r="1.5" />
    </svg>
  );
}

export default function MetronomeDropdown({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const store = useMetronomeStore();
  const tapTempo = useTapTempo(store.setBpm);

  const soundTypes: MetronomeSoundType[] = ['click', 'woodblock', 'hihat', 'sidestick', 'voice'];
  const timeSigOptions = [
    { value: 2, label: '2/4' },
    { value: 3, label: '3/4' },
    { value: 4, label: '4/4' },
    { value: 6, label: '6/8' },
    { value: 12, label: '12/8' },
  ];
  const presetBpms = [60, 80, 100, 120, 140, 160];
  const VolumeIcon = store.volume === 0 ? VolumeX : store.volume < 0.5 ? Volume1 : Volume2;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      {position === 'bottom' ? (
        <button
          onClick={() => setOpen(!open)}
          className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
            store.isPlaying
              ? 'text-[hsl(142_71%_45%)]'
              : open
                ? 'text-[hsl(var(--color-emphasis))]'
                : 'text-[hsl(var(--text-muted))] active:text-[hsl(var(--text-default))]'
          }`}
          title="Metronome"
        >
          <MetronomeIcon className="size-[26px]" />
          <span className="text-[14px] font-display font-semibold leading-none">Metronome</span>
          {store.isPlaying && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[hsl(142_71%_45%)]" />
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className={`
            flex items-center justify-center w-[45px] h-[45px] rounded-lg border transition-all duration-200
            ${store.isPlaying
              ? 'border-[hsl(142_71%_45%/0.4)] bg-[hsl(142_71%_45%/0.12)] text-[hsl(142_71%_45%)]'
              : open
                ? 'border-[hsl(var(--color-emphasis)/0.4)] bg-[hsl(var(--color-emphasis)/0.08)] text-[hsl(var(--color-emphasis))]'
                : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-emphasis))] hover:bg-[hsl(var(--bg-overlay))]'
            }
          `}
          title="Metronome"
        >
          <MetronomeIcon className="size-[32px]" />
          {store.isPlaying && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(142_71%_45%)] animate-pulse" />
          )}
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className={`fixed left-2 right-2 z-50 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl overflow-hidden ${
          position === 'bottom'
            ? 'bottom-[64px] sm:absolute sm:left-auto sm:right-0 sm:bottom-full sm:mb-2 sm:w-[400px]'
            : 'top-[58px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-center px-4 py-3.5 sm:py-3 border-b border-[hsl(var(--border-subtle))]">
            <div className="flex items-center gap-2">
              <MetronomeIcon className="size-5 sm:size-4 text-[hsl(var(--color-emphasis))]" />
              <span className="font-display text-base sm:text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Metronome</span>
            </div>
          </div>

          <div className="p-4 sm:p-4 space-y-5 sm:space-y-4 max-h-[calc(100vh-6rem)] sm:max-h-[70vh] overflow-y-auto">
            {/* BPM control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Tempo</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-xs font-body italic text-[hsl(var(--text-subtle))]">{getTempoMarking(store.bpm)}</span>
                  <span className="text-base sm:text-sm font-display font-bold text-[hsl(var(--color-primary))] tabular-nums">
                    {store.bpm} <span className="text-xs sm:text-[10px] font-body font-normal text-[hsl(var(--text-muted))]">BPM</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-2">
                <button onClick={() => store.setBpm(store.bpm - 1)} className="size-10 sm:size-7 flex items-center justify-center rounded-lg sm:rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors active:scale-95">
                  <Minus className="size-4 sm:size-3" />
                </button>
                <input type="range" min={30} max={260} step={1} value={store.bpm} onChange={(e) => store.setBpm(Number(e.target.value))} className="volume-slider flex-1" />
                <button onClick={() => store.setBpm(store.bpm + 1)} className="size-10 sm:size-7 flex items-center justify-center rounded-lg sm:rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors active:scale-95">
                  <Plus className="size-4 sm:size-3" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-1.5">
                {presetBpms.map((p) => (
                  <button key={p} onClick={() => store.setBpm(p)} className={`rounded-lg sm:rounded-md px-3 sm:px-2 py-2 sm:py-1 text-xs sm:text-[11px] font-display font-bold transition-all active:scale-95 ${store.bpm === p ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)]' : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] border border-transparent'}`}>
                    {p}
                  </button>
                ))}

              </div>
              <div className="flex items-center gap-2.5 sm:gap-2">
                <div className="size-10 sm:size-7 shrink-0" />
                <button onClick={tapTempo} className="flex-1 rounded-lg sm:rounded-md px-4 sm:px-3 py-3 sm:py-2 text-sm sm:text-xs font-display font-bold uppercase tracking-wider bg-[hsl(var(--color-emphasis)/0.12)] text-[hsl(var(--color-emphasis))] border border-[hsl(var(--color-emphasis)/0.3)] hover:bg-[hsl(var(--color-emphasis)/0.22)] transition-all active:scale-90">
                  Tap Tempo
                </button>
                <div className="size-10 sm:size-7 shrink-0" />
              </div>
            </div>

            {/* Time Signature */}
            <div className="space-y-2.5 sm:space-y-2">
              <span className="text-sm sm:text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Time Signature</span>
              <div className="flex gap-2 sm:gap-1.5">
                {timeSigOptions.map((opt) => (
                  <button key={opt.value} onClick={() => store.setBeatsPerMeasure(opt.value)} className={`flex-1 rounded-lg sm:rounded-md px-2 py-2.5 sm:py-1.5 text-sm sm:text-xs font-display font-bold transition-all active:scale-95 ${store.beatsPerMeasure === opt.value ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]' : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound type */}
            <div className="space-y-2.5 sm:space-y-2">
              <span className="text-sm sm:text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Sound</span>
              <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
                {soundTypes.map((s) => (
                  <button key={s} onClick={() => store.setSoundType(s)} className={`rounded-lg sm:rounded-md px-2 py-3 sm:py-2 text-sm sm:text-xs font-display font-bold transition-all active:scale-95 ${store.soundType === s ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]' : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'}`}>
                    {SOUND_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div className="space-y-2.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Volume</span>
                <span className="text-sm sm:text-xs font-display font-bold text-[hsl(var(--color-primary))] tabular-nums">{Math.round(store.volume * 100)}%</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-2">
                <button onClick={() => store.setVolume(0)} className={`size-10 sm:size-7 flex items-center justify-center rounded-lg sm:rounded-md border transition-colors active:scale-95 ${store.volume === 0 ? 'border-[hsl(var(--semantic-error)/0.4)] bg-[hsl(var(--semantic-error)/0.1)] text-[hsl(var(--semantic-error))]' : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))]'}`}>
                  <VolumeX className="size-4 sm:size-3.5" />
                </button>
                <input type="range" min={0} max={1} step={0.01} value={store.volume} onChange={(e) => store.setVolume(Number(e.target.value))} className="volume-slider flex-1" />
                <button onClick={() => store.setVolume(1)} className="size-10 sm:size-7 flex items-center justify-center rounded-lg sm:rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors active:scale-95">
                  <VolumeIcon className="size-4 sm:size-3.5" />
                </button>
              </div>
            </div>

            {/* Play / Stop */}
            <div className="flex justify-center">
              <button
                onClick={store.toggle}
                className={`
                  flex items-center justify-center gap-2.5 sm:gap-2 rounded-xl w-3/4 py-3.5 sm:py-2.5 text-base sm:text-sm font-display font-bold transition-all duration-200 active:scale-95
                  ${store.isPlaying
                    ? 'bg-[hsl(var(--semantic-error)/0.12)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.3)] hover:bg-[hsl(var(--semantic-error)/0.2)]'
                    : 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.2)]'
                  }
                `}
              >
                {store.isPlaying ? (
                  <><span className="size-3.5 rounded-sm bg-current" /> Stop</>
                ) : (
                  <><Play className="size-4" /> Play</>
                )}
              </button>
            </div>

            {/* Beat indicators */}
            {store.isPlaying && (
              <div className="flex items-center justify-center gap-1.5 sm:gap-1 pt-3 sm:pt-2 border-t border-[hsl(var(--border-subtle))]">
                {Array.from({ length: store.beatsPerMeasure }, (_, i) => {
                  const isActive = i === store.currentBeat;
                  const isAccentBeat = i === 0 || (store.beatsPerMeasure === 6 && i === 3) || (store.beatsPerMeasure === 12 && (i === 3 || i === 6 || i === 9));
                  return (
                    <span
                      key={i}
                      className={`font-display font-bold tabular-nums transition-all duration-100 select-none text-center ${store.beatsPerMeasure === 12 ? 'text-sm sm:text-xs min-w-[18px] sm:min-w-[16px]' : 'text-base sm:text-sm min-w-[24px] sm:min-w-[20px]'} ${isActive ? isAccentBeat ? 'text-[hsl(var(--color-emphasis))] scale-125 drop-shadow-[0_0_8px_hsl(var(--color-emphasis)/0.7)]' : 'text-[hsl(var(--color-primary))] scale-110 drop-shadow-[0_0_6px_hsl(var(--color-primary)/0.6)]' : isAccentBeat ? 'text-[hsl(var(--text-muted)/0.6)]' : 'text-[hsl(var(--text-muted)/0.3)]'}`}
                    >
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
