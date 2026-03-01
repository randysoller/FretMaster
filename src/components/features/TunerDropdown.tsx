import { useState, useRef, useEffect } from 'react';
import { useTunerStore, GUITAR_STRINGS } from '@/stores/tunerStore';
import { Volume2 } from 'lucide-react';

/** Tuning fork SVG icon */
function TuningForkIcon({ className }: { className?: string }) {
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
      {/* Left prong */}
      <path d="M9 2v10" />
      {/* Right prong */}
      <path d="M15 2v10" />
      {/* Rounded base connecting prongs */}
      <path d="M9 12a3 3 0 0 0 6 0" />
      {/* Handle */}
      <line x1="12" y1="15" x2="12" y2="22" />
    </svg>
  );
}

/** Needle gauge SVG */
function NeedleGauge({ cents, isInTune, hasSignal }: { cents: number; isInTune: boolean; hasSignal: boolean }) {
  // Map cents to angle: -50 cents = -90°, 0 = 0°, +50 = +90°
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const angle = hasSignal ? (clampedCents / 50) * 90 : 0;
  const needleColor = !hasSignal
    ? 'hsl(var(--text-muted))'
    : isInTune
      ? 'hsl(142, 71%, 45%)'
      : 'hsl(0, 84%, 60%)';

  // Generate tick marks
  const ticks: { angle: number; major: boolean }[] = [];
  for (let c = -50; c <= 50; c += 5) {
    ticks.push({ angle: (c / 50) * 90, major: c % 10 === 0 });
  }

  return (
    <svg viewBox="0 0 240 130" className="w-full max-w-[280px]">
      {/* Outer arc */}
      <path
        d="M 20 120 A 100 100 0 0 1 220 120"
        fill="none"
        stroke="hsl(var(--border-default))"
        strokeWidth="2"
        opacity="0.5"
      />

      {/* Green zone arc (center ±5 cents) */}
      <path
        d={describeArc(120, 120, 98, -9, 9)}
        fill="none"
        stroke="hsl(142, 71%, 45%)"
        strokeWidth="3"
        opacity="0.4"
      />

      {/* Tick marks */}
      {ticks.map((t, i) => {
        const rad = ((t.angle - 90) * Math.PI) / 180;
        const innerR = t.major ? 85 : 90;
        const outerR = 98;
        const x1 = 120 + innerR * Math.cos(rad);
        const y1 = 120 + innerR * Math.sin(rad);
        const x2 = 120 + outerR * Math.cos(rad);
        const y2 = 120 + outerR * Math.sin(rad);
        const isCenterTick = t.angle === 0;
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isCenterTick ? 'hsl(142, 71%, 45%)' : 'hsl(var(--text-muted))'}
            strokeWidth={t.major ? 1.5 : 0.8}
            opacity={isCenterTick ? 0.9 : t.major ? 0.5 : 0.25}
          />
        );
      })}

      {/* Labels */}
      <text x="28" y="118" textAnchor="middle" fill="hsl(var(--text-muted))" fontSize="11" fontFamily="inherit" opacity="0.6">♭</text>
      <text x="212" y="118" textAnchor="middle" fill="hsl(var(--text-muted))" fontSize="11" fontFamily="inherit" opacity="0.6">♯</text>

      {/* Needle */}
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '120px 120px', transition: 'transform 150ms ease-out' }}>
        <line
          x1="120" y1="120" x2="120" y2="30"
          stroke={needleColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Needle tip */}
        <circle cx="120" cy="32" r="3" fill={needleColor} />
      </g>

      {/* Center pivot */}
      <circle cx="120" cy="120" r="5" fill={needleColor} />
      <circle cx="120" cy="120" r="2.5" fill="hsl(var(--bg-elevated))" />
    </svg>
  );
}

/** Helper: describe SVG arc path */
function describeArc(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number): string {
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180;
  const endRad = ((endAngleDeg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function TunerDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const store = useTunerStore();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const centsDisplay = store.hasSignal
    ? store.centsOff > 0
      ? `+${Math.round(store.centsOff)}¢`
      : `${Math.round(store.centsOff)}¢`
    : '—';

  const noteColor = !store.hasSignal
    ? 'text-[hsl(var(--text-muted))]'
    : store.isInTune
      ? 'text-[hsl(142_71%_45%)]'
      : 'text-[hsl(0_84%_60%)]';

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => {
          if (store.isListening) {
            store.stopListening();
            setOpen(false);
          } else {
            store.startListening();
            setOpen(true);
          }
        }}
        className={`
          flex items-center justify-center gap-1.5 h-[45px] px-2.5 rounded-lg border transition-all duration-200
          ${store.isListening
            ? 'border-[hsl(var(--semantic-success)/0.6)] bg-[hsl(var(--semantic-success)/0.12)] text-[hsl(var(--semantic-success))]'
            : open
              ? 'border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]'
              : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--bg-overlay))]'
          }
        `}
        title={store.isListening ? 'Stop Tuner' : 'Start Tuner'}
      >
        <TuningForkIcon className="w-[22px] h-[22px]" />
        <span className="text-xs font-display font-bold uppercase tracking-wider hidden sm:inline">Tuner</span>
        {store.isListening && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed left-2 right-2 top-[58px] z-50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-center px-4 py-3.5 sm:py-3 border-b border-[hsl(var(--border-subtle))]">
            <div className="flex items-center gap-2">
              <TuningForkIcon className="size-5 sm:size-4 text-[hsl(var(--color-primary))]" />
              <span className="font-display text-base sm:text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Chromatic Tuner</span>
            </div>
          </div>

          <div className="p-4 sm:p-4 space-y-4 max-h-[calc(100vh-6rem)] sm:max-h-[70vh] overflow-y-auto">
            {/* Note Display */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-baseline gap-1">
                <span className={`font-display text-6xl sm:text-5xl font-extrabold transition-colors duration-200 ${noteColor}`}>
                  {store.hasSignal ? store.detectedNote : '—'}
                </span>
                {store.hasSignal && store.detectedOctave > 0 && (
                  <span className={`font-display text-2xl sm:text-xl font-bold transition-colors duration-200 ${noteColor}`}>
                    {store.detectedOctave}
                  </span>
                )}
              </div>
              <span className={`text-sm sm:text-xs font-display font-bold tabular-nums transition-colors duration-200 ${noteColor}`}>
                {centsDisplay}
              </span>
            </div>

            {/* Needle Gauge */}
            <div className="flex justify-center -mt-1 -mb-2">
              <NeedleGauge cents={store.centsOff} isInTune={store.isInTune} hasSignal={store.hasSignal} />
            </div>

            {/* Permission denied warning */}
            {store.permissionDenied && (
              <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-3 py-2">
                <span className="text-xs font-body text-[hsl(var(--semantic-error))]">Microphone access denied. Please allow access in browser settings.</span>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[hsl(var(--border-subtle))]" />

            {/* Reference Pitch Generator */}
            <div className="space-y-2.5 sm:space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 sm:size-3.5 text-[hsl(var(--color-emphasis))]" />
                <span className="text-sm sm:text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Reference Pitches — Standard Tuning</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-1.5">
                {GUITAR_STRINGS.map((s) => {
                  const isPlaying = store.playingString === s.num;
                  return (
                    <button
                      key={s.num}
                      onClick={() => store.playReferenceString(s.num)}
                      className={`
                        flex items-center justify-between gap-2 rounded-lg sm:rounded-md px-3 py-3 sm:py-2.5 text-left transition-all duration-150 active:scale-95
                        ${isPlaying
                          ? 'bg-[hsl(var(--color-emphasis)/0.15)] border border-[hsl(var(--color-emphasis)/0.4)] ring-1 ring-[hsl(var(--color-emphasis)/0.2)]'
                          : 'bg-[hsl(var(--bg-surface))] border border-transparent hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'
                        }
                      `}
                    >
                      <span className={`text-sm sm:text-xs font-display font-bold leading-tight ${isPlaying ? 'text-[hsl(var(--color-emphasis))]' : 'text-[hsl(var(--text-default))]'}`}>
                        {s.label}
                      </span>
                      {isPlaying && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[0,1,2].map((i) => (
                            <div key={i} className="w-0.5 rounded-full bg-[hsl(var(--color-emphasis))] animate-pulse" style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
