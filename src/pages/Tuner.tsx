import { useState, useMemo, useRef, useEffect } from 'react';
import { useTuner, TUNING_PRESETS, midiToFreq, midiToNoteOnly } from '@/hooks/useTuner';
import type { TuningPreset } from '@/hooks/useTuner';
import { Mic, MicOff, ChevronDown, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Strobe Bars ─────────────────────────────────────────

function StrobeDisplay({ cents, isActive }: { cents: number; isActive: boolean }) {
  const barsCount = 32;
  const strobeRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const centsRef = useRef(cents);

  useEffect(() => {
    centsRef.current = cents;
  }, [cents]);

  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Speed proportional to cents deviation — freezes near 0
      const speed = centsRef.current * 4;
      offsetRef.current = (offsetRef.current + speed * dt) % 100;

      if (strobeRef.current) {
        strobeRef.current.style.transform = `translateX(${offsetRef.current}%)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive]);

  const absCents = Math.abs(cents);
  // Color: green when in-tune (<5), yellow when close (<15), orange/red when far
  const getBarColor = () => {
    if (!isActive) return 'bg-[hsl(var(--border-default))]';
    if (absCents < 3) return 'bg-[hsl(var(--semantic-success))]';
    if (absCents < 8) return 'bg-[hsl(142_71%_45%/0.7)]';
    if (absCents < 15) return 'bg-[hsl(var(--semantic-warning))]';
    if (absCents < 30) return 'bg-[hsl(var(--color-emphasis))]';
    return 'bg-[hsl(var(--semantic-error))]';
  };

  const barColor = getBarColor();
  const glowColor = !isActive
    ? ''
    : absCents < 3
      ? 'drop-shadow-[0_0_8px_hsl(142_71%_45%/0.6)]'
      : absCents < 15
        ? 'drop-shadow-[0_0_6px_hsl(43_96%_56%/0.4)]'
        : 'drop-shadow-[0_0_4px_hsl(0_84%_60%/0.3)]';

  return (
    <div className="relative w-full h-20 sm:h-24 rounded-xl overflow-hidden bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">
      {/* Center line indicator */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-px w-0.5 bg-[hsl(var(--text-default))] z-10 opacity-80" />
      <div className="absolute top-0 left-1/2 -translate-x-1 w-2 h-2 bg-[hsl(var(--text-default))] z-10" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1 w-2 h-2 bg-[hsl(var(--text-default))] z-10" style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }} />

      {/* Scrolling bars */}
      <div ref={strobeRef} className={`absolute inset-y-2 flex items-stretch gap-[3px] ${glowColor}`} style={{ left: '-50%', width: '200%' }}>
        {Array.from({ length: barsCount * 3 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-colors duration-150 ${barColor}`}
            style={{ opacity: isActive ? (absCents < 3 ? 1 : 0.7 + Math.random() * 0.3) : 0.2 }}
          />
        ))}
      </div>

      {/* In-tune indicator */}
      <AnimatePresence>
        {isActive && absCents < 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <span className="font-display text-lg sm:text-xl font-extrabold text-[hsl(var(--semantic-success))] uppercase tracking-widest"
              style={{ textShadow: '0 0 20px hsl(142 71% 45% / 0.6)' }}>
              In Tune
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Cents Meter ─────────────────────────────────────────

function CentsMeter({ cents, isActive }: { cents: number; isActive: boolean }) {
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const position = ((clampedCents + 50) / 100) * 100; // 0% to 100%
  const absCents = Math.abs(cents);

  const needleColor = !isActive
    ? 'bg-[hsl(var(--text-muted))]'
    : absCents < 3
      ? 'bg-[hsl(var(--semantic-success))]'
      : absCents < 15
        ? 'bg-[hsl(var(--semantic-warning))]'
        : 'bg-[hsl(var(--semantic-error))]';

  const needleGlow = !isActive
    ? ''
    : absCents < 3
      ? 'shadow-[0_0_12px_hsl(142_71%_45%/0.6)]'
      : absCents < 15
        ? 'shadow-[0_0_8px_hsl(43_96%_56%/0.4)]'
        : 'shadow-[0_0_8px_hsl(0_84%_60%/0.4)]';

  return (
    <div className="w-full space-y-2">
      {/* Scale labels */}
      <div className="flex items-center justify-between px-1 text-[10px] font-body text-[hsl(var(--text-muted))]">
        <span>-50¢</span>
        <span className="text-[hsl(var(--text-subtle))]">♭ flat</span>
        <span className="font-bold text-[hsl(var(--text-default))]">0</span>
        <span className="text-[hsl(var(--text-subtle))]">sharp ♯</span>
        <span>+50¢</span>
      </div>

      {/* Track */}
      <div className="relative h-8 rounded-lg bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] overflow-hidden">
        {/* Graduation marks */}
        {[-40, -30, -20, -10, 0, 10, 20, 30, 40].map((mark) => {
          const x = ((mark + 50) / 100) * 100;
          return (
            <div
              key={mark}
              className={`absolute top-1 bottom-1 w-px ${mark === 0 ? 'bg-[hsl(var(--text-default)/0.5)]' : 'bg-[hsl(var(--border-default)/0.5)]'}`}
              style={{ left: `${x}%` }}
            />
          );
        })}

        {/* Green zone around center */}
        <div className="absolute top-0 bottom-0 bg-[hsl(142_71%_45%/0.08)]" style={{ left: '44%', width: '12%' }} />

        {/* Needle */}
        <motion.div
          className={`absolute top-1 bottom-1 w-1 rounded-full ${needleColor} ${needleGlow}`}
          animate={{ left: `calc(${position}% - 2px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      </div>

      {/* Cents readout */}
      <div className="text-center">
        <span className={`font-display text-lg font-bold tabular-nums ${
          !isActive
            ? 'text-[hsl(var(--text-muted))]'
            : absCents < 3
              ? 'text-[hsl(var(--semantic-success))]'
              : absCents < 15
                ? 'text-[hsl(var(--semantic-warning))]'
                : 'text-[hsl(var(--semantic-error))]'
        }`}>
          {isActive ? `${cents > 0 ? '+' : ''}${cents.toFixed(1)}¢` : '--'}
        </span>
      </div>
    </div>
  );
}

// ─── String Selector ─────────────────────────────────────

function StringSelector({ tuning, targetString, onSelect, detectedMidi }: {
  tuning: TuningPreset;
  targetString: number | null;
  onSelect: (idx: number | null) => void;
  detectedMidi: number | null;
}) {
  // Find which string best matches the detected note
  const autoDetectedString = useMemo(() => {
    if (detectedMidi === null) return null;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < tuning.notes.length; i++) {
      const dist = Math.abs(detectedMidi - tuning.notes[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestDist <= 4 ? bestIdx : null; // within ~4 semitones
  }, [detectedMidi, tuning.notes]);

  const activeString = targetString ?? autoDetectedString;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Strings</span>
        {targetString !== null && (
          <button onClick={() => onSelect(null)} className="text-[10px] font-body text-[hsl(var(--color-primary))] hover:underline">
            Auto-detect
          </button>
        )}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {tuning.notes.map((midi, idx) => {
          const isActive = activeString === idx;
          const stringNum = 6 - idx; // Display as 6th→1st string
          const freq = Math.round(midiToFreq(midi) * 10) / 10;
          return (
            <button
              key={idx}
              onClick={() => onSelect(targetString === idx ? null : idx)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-3 px-1 transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[hsl(var(--color-primary)/0.15)] border-2 border-[hsl(var(--color-primary)/0.5)] scale-105'
                  : 'bg-[hsl(var(--bg-surface))] border-2 border-transparent hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'
              }`}
            >
              <span className={`text-[10px] font-body ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>
                {stringNum}
              </span>
              <span className={`font-display text-base sm:text-lg font-bold ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'}`}>
                {midiToNoteOnly(midi)}
              </span>
              <span className={`text-[9px] font-body tabular-nums ${isActive ? 'text-[hsl(var(--color-primary)/0.7)]' : 'text-[hsl(var(--text-muted)/0.6)]'}`}>
                {freq}Hz
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tuning Dropdown ─────────────────────────────────────

function TuningSelector({ value, onChange }: { value: TuningPreset; onChange: (t: TuningPreset) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-4 py-3 text-sm font-body text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
      >
        <span className="font-display font-semibold">{value.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[hsl(var(--text-muted))]">{value.labels.join(' ')}</span>
          <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {TUNING_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${
                t.id === value.id
                  ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]'
                  : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
              }`}
            >
              <span className="text-sm font-display font-semibold">{t.name}</span>
              <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">{t.labels.join(' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Tuner Page ─────────────────────────────────────

export default function Tuner() {
  const tuner = useTuner();
  const [selectedTuning, setSelectedTuning] = useState<TuningPreset>(TUNING_PRESETS[0]);
  const [targetString, setTargetString] = useState<number | null>(null);

  // Compute cents relative to target string if locked
  const targetCents = useMemo(() => {
    if (tuner.nearestMidi === null || tuner.frequency === null) return tuner.cents;
    if (targetString === null) return tuner.cents;

    const targetMidi = selectedTuning.notes[targetString];
    const targetFreq = midiToFreq(targetMidi);
    const centsFromTarget = 1200 * Math.log2(tuner.frequency / targetFreq);
    return Math.round(centsFromTarget * 10) / 10;
  }, [tuner.frequency, tuner.nearestMidi, tuner.cents, targetString, selectedTuning.notes]);

  const targetNoteName = targetString !== null
    ? midiToNoteOnly(selectedTuning.notes[targetString])
    : tuner.noteOnly;

  const isActive = tuner.isListening && tuner.frequency !== null;

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Header */}
      <div className="relative px-4 sm:px-6 pt-8 pb-4 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4"
        >
          <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
          <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Guitar Tuner</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
          className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight"
        >
          <span className="text-[hsl(var(--text-default))]">Tune Your </span>
          <span className="text-gradient">Guitar</span>
        </motion.h1>
      </div>

      <div className="px-4 sm:px-6 pb-12 max-w-xl mx-auto space-y-5">
        {/* Tuning Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <TuningSelector value={selectedTuning} onChange={(t) => { setSelectedTuning(t); setTargetString(null); }} />
        </motion.div>

        {/* Main Display Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.7)] backdrop-blur-sm p-5 sm:p-6 space-y-5"
        >
          {/* Detected note display */}
          <div className="text-center space-y-1">
            <AnimatePresence mode="wait">
              <motion.span
                key={targetNoteName}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className={`font-display text-7xl sm:text-8xl md:text-9xl font-extrabold leading-none block ${
                  !isActive
                    ? 'text-[hsl(var(--text-muted)/0.3)]'
                    : Math.abs(targetCents) < 3
                      ? 'text-[hsl(var(--semantic-success))]'
                      : Math.abs(targetCents) < 15
                        ? 'text-[hsl(var(--semantic-warning))]'
                        : 'text-[hsl(var(--text-default))]'
                }`}
                style={isActive && Math.abs(targetCents) < 3 ? { textShadow: '0 0 40px hsl(142 71% 45% / 0.3)' } : undefined}
              >
                {targetNoteName}
              </motion.span>
            </AnimatePresence>
            <p className="text-sm font-body tabular-nums text-[hsl(var(--text-muted))]">
              {isActive && tuner.frequency ? `${tuner.frequency} Hz` : 'Play a string'}
            </p>
          </div>

          {/* Strobe Display */}
          <StrobeDisplay cents={isActive ? targetCents : 0} isActive={isActive} />

          {/* Cents Meter */}
          <CentsMeter cents={isActive ? targetCents : 0} isActive={isActive} />

          {/* String Selector */}
          <StringSelector
            tuning={selectedTuning}
            targetString={targetString}
            onSelect={setTargetString}
            detectedMidi={tuner.nearestMidi}
          />

          {/* Mic button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={tuner.toggleListening}
              className={`flex items-center justify-center gap-2.5 rounded-xl w-3/4 py-3.5 text-base font-display font-bold transition-all duration-200 active:scale-95 ${
                tuner.isListening
                  ? 'bg-[hsl(var(--semantic-error)/0.12)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.3)] hover:bg-[hsl(var(--semantic-error)/0.2)]'
                  : 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.2)]'
              }`}
            >
              {tuner.isListening ? (
                <><MicOff className="size-5" /> Stop Tuner</>
              ) : (
                <><Mic className="size-5" /> Start Tuner</>
              )}
            </button>
          </div>

          {/* Volume meter */}
          {tuner.isListening && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase tracking-wider shrink-0">Input</span>
              <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--border-default))] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[hsl(var(--semantic-success))]"
                  animate={{ width: `${Math.min(100, tuner.volume * 100)}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </div>
          )}

          {tuner.permissionDenied && (
            <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5">
              <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
              <span className="text-xs font-body text-[hsl(var(--semantic-error))]">Microphone access denied. Please allow in browser settings.</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
