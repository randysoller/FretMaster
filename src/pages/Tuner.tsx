import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Music } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Constants ───────────────────────────────────────────

const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const GUITAR_STRINGS = [
  { string: 6, note: 'E2', freq: 82.41, display: 'E' },
  { string: 5, note: 'A2', freq: 110.00, display: 'A' },
  { string: 4, note: 'D3', freq: 146.83, display: 'D' },
  { string: 3, note: 'G3', freq: 196.00, display: 'G' },
  { string: 2, note: 'B3', freq: 246.94, display: 'B' },
  { string: 1, note: 'E4', freq: 329.63, display: 'E' },
];

// ─── Pitch detection utilities ───────────────────────────

function frequencyToNoteInfo(freq: number): { note: string; octave: number; cents: number; noteIndex: number } {
  const semitoneOffset = 12 * Math.log2(freq / 440);
  const roundedSemitone = Math.round(semitoneOffset);
  const cents = Math.round((semitoneOffset - roundedSemitone) * 100);
  const rawIndex = roundedSemitone + 9; // A = index 9
  const noteIndex = ((rawIndex % 12) + 12) % 12;
  const octave = Math.floor((roundedSemitone + 9) / 12) + 4;
  return { note: NOTE_STRINGS[noteIndex], octave, cents, noteIndex };
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  // Check signal level
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.008) return -1;

  const size = buffer.length;
  const halfSize = Math.floor(size / 2);

  // Compute autocorrelation for lags up to half buffer
  const correlations = new Float32Array(halfSize);
  for (let lag = 0; lag < halfSize; lag++) {
    let sum = 0;
    for (let i = 0; i < halfSize; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find first zero crossing (dip)
  let dip = 1;
  while (dip < halfSize - 1 && correlations[dip] > correlations[dip + 1]) {
    dip++;
  }

  // Find the peak after the dip
  let maxVal = -Infinity;
  let maxPos = dip;
  for (let i = dip; i < halfSize - 1; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  // Validate: peak should be significant relative to zero-lag
  if (maxPos <= 0 || maxVal < correlations[0] * 0.25) return -1;

  // Parabolic interpolation for sub-sample accuracy
  let refinedPos = maxPos;
  if (maxPos > 0 && maxPos < halfSize - 1) {
    const prev = correlations[maxPos - 1];
    const curr = correlations[maxPos];
    const next = correlations[maxPos + 1];
    const denominator = 2 * (prev - 2 * curr + next);
    if (Math.abs(denominator) > 1e-10) {
      const shift = (prev - next) / denominator;
      refinedPos = maxPos + shift;
    }
  }

  const frequency = sampleRate / refinedPos;

  // Sanity check: guitar range ~70Hz to ~1200Hz
  if (frequency < 60 || frequency > 1400) return -1;

  return frequency;
}

function findClosestString(freq: number): typeof GUITAR_STRINGS[number] | null {
  let closest = GUITAR_STRINGS[0];
  let minDist = Infinity;
  for (const gs of GUITAR_STRINGS) {
    const dist = Math.abs(1200 * Math.log2(freq / gs.freq));
    if (dist < minDist) {
      minDist = dist;
      closest = gs;
    }
  }
  return minDist < 400 ? closest : null;
}

// ─── Component ───────────────────────────────────────────

export default function Tuner() {
  const [isListening, setIsListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [noteInfo, setNoteInfo] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [closestString, setClosestString] = useState<typeof GUITAR_STRINGS[number] | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedString, setSelectedString] = useState<typeof GUITAR_STRINGS[number] | null>(null);
  const startedRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array | null>(null);

  const stopListening = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    bufferRef.current = null;
    setIsListening(false);
    setFrequency(null);
    setNoteInfo(null);
    setClosestString(null);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      sourceRef.current = source;
      bufferRef.current = new Float32Array(analyser.fftSize);

      setIsListening(true);
      setPermissionDenied(false);

      const detect = () => {
        if (!analyserRef.current || !bufferRef.current || !audioCtxRef.current) return;

        analyserRef.current.getFloatTimeDomainData(bufferRef.current);
        const freq = autoCorrelate(bufferRef.current, audioCtxRef.current.sampleRate);

        if (freq > 0) {
          setFrequency(freq);
          const info = frequencyToNoteInfo(freq);
          setNoteInfo(info);
          setClosestString(findClosestString(freq));
        } else {
          setFrequency(null);
          setNoteInfo(null);
          setClosestString(null);
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    } catch {
      setPermissionDenied(true);
      setIsListening(false);
    }
  }, []);

  // Auto-start listening on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  // Determine tuning accuracy
  const cents = noteInfo?.cents ?? 0;
  const isInTune = Math.abs(cents) <= 5;
  const isClose = Math.abs(cents) <= 15;

  // For meter display
  const meterPosition = Math.max(-50, Math.min(50, cents));

  // Determine what string we're comparing against
  const targetString = selectedString ?? closestString;
  const centsFromTarget = targetString && frequency
    ? Math.round(1200 * Math.log2(frequency / targetString.freq))
    : cents;
  const isTargetInTune = Math.abs(centsFromTarget) <= 5;
  const isTargetClose = Math.abs(centsFromTarget) <= 15;
  const targetMeterPosition = Math.max(-50, Math.min(50, centsFromTarget));

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Header */}
      <div className="relative px-4 sm:px-6 pt-8 pb-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4">
          <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
          <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Guitar Tuner</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
          <span className="text-[hsl(var(--text-default))]">Tune Your </span>
          <span className="text-gradient">Guitar</span>
        </h1>
        <p className="mt-2 font-body text-sm text-[hsl(var(--text-subtle))] max-w-md mx-auto">
          Tap the mic to start. Play a string and the tuner will detect the pitch.
        </p>
      </div>

      <div className="px-4 sm:px-6 pb-12 max-w-xl mx-auto space-y-6">
        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-3 rounded-xl px-6 py-3 bg-[hsl(142_71%_45%/0.08)] border border-[hsl(142_71%_45%/0.2)]">
            <div className="flex items-center gap-1">
              {[0,1,2,3,4].map((i) => (
                <motion.div key={i} className="w-0.5 rounded-full bg-[hsl(142_71%_45%)]" animate={{ height: [4, 14, 4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }} />
              ))}
            </div>
            <span className="text-sm font-body font-medium text-[hsl(142_71%_45%)]">
              Listening — play a string
            </span>
            <span className="size-2 rounded-full bg-[hsl(142_71%_45%)] animate-pulse" />
          </div>
        )}

        {permissionDenied && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5 text-center justify-center">
            <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">
              Microphone access denied. Please allow mic access in browser settings.
            </span>
          </div>
        )}

        {/* String selector */}
        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-5">
          <h3 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-3">
            Select String <span className="normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(or auto-detect)</span>
          </h3>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setSelectedString(null)}
              className={`rounded-lg px-3 py-2.5 text-sm font-display font-bold transition-all active:scale-95 ${
                !selectedString
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
              }`}
            >
              Auto
            </button>
            {GUITAR_STRINGS.map((gs) => {
              const isActive = selectedString?.string === gs.string;
              const isDetected = !selectedString && closestString?.string === gs.string && isListening && frequency !== null;
              return (
                <button
                  key={gs.string}
                  onClick={() => setSelectedString(isActive ? null : gs)}
                  className={`
                    relative rounded-lg px-3 py-2.5 min-w-[44px] text-sm font-display font-bold transition-all active:scale-95
                    ${isActive
                      ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                      : isDetected
                        ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.4)]'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                    }
                  `}
                >
                  <span>{gs.display}</span>
                  <span className="block text-[9px] font-body font-normal opacity-60">{gs.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main tuner display */}
        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6 sm:p-8">
          {isListening && noteInfo ? (
            <motion.div
              key={`${noteInfo.note}${noteInfo.octave}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Detected note */}
              <div className="text-center">
                <p className={`font-display text-7xl sm:text-8xl font-extrabold leading-none transition-colors duration-200 ${
                  isTargetInTune
                    ? 'text-[hsl(142_71%_45%)]'
                    : isTargetClose
                      ? 'text-[hsl(var(--color-emphasis))]'
                      : 'text-[hsl(var(--text-default))]'
                }`}
                  style={isTargetInTune ? { textShadow: '0 0 30px hsl(142 71% 45% / 0.4)' } : undefined}
                >
                  {noteInfo.note}<span className="text-3xl sm:text-4xl opacity-50">{noteInfo.octave}</span>
                </p>
                {frequency && (
                  <p className="mt-2 text-sm font-body text-[hsl(var(--text-muted))] tabular-nums">
                    {frequency.toFixed(1)} Hz
                  </p>
                )}
                {targetString && (
                  <p className="mt-1 text-xs font-body text-[hsl(var(--text-muted))]">
                    Target: {targetString.note} ({targetString.freq.toFixed(1)} Hz)
                  </p>
                )}
              </div>

              {/* Cents meter */}
              <div className="space-y-2">
                <div className="relative h-8 rounded-full bg-[hsl(var(--bg-surface))] overflow-hidden border border-[hsl(var(--border-subtle))]">
                  {/* Center line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[hsl(var(--text-muted)/0.3)]" />
                  {/* Tick marks */}
                  {[-40, -30, -20, -10, 10, 20, 30, 40].map((tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 w-px bg-[hsl(var(--border-subtle)/0.5)]"
                      style={{ left: `${50 + tick}%` }}
                    />
                  ))}
                  {/* Indicator */}
                  <motion.div
                    className={`absolute top-1 bottom-1 w-3 rounded-full transition-colors duration-200 ${
                      isTargetInTune
                        ? 'bg-[hsl(142_71%_45%)] shadow-[0_0_12px_hsl(142_71%_45%/0.6)]'
                        : isTargetClose
                          ? 'bg-[hsl(var(--color-emphasis))] shadow-[0_0_8px_hsl(var(--color-emphasis)/0.5)]'
                          : 'bg-[hsl(var(--semantic-error))] shadow-[0_0_8px_hsl(var(--semantic-error)/0.5)]'
                    }`}
                    animate={{ left: `calc(${50 + targetMeterPosition}% - 6px)` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-body text-[hsl(var(--text-muted))]">
                  <span>♭ Flat</span>
                  <span className={`font-display font-bold tabular-nums ${
                    isTargetInTune ? 'text-[hsl(142_71%_45%)]' : isTargetClose ? 'text-[hsl(var(--color-emphasis))]' : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {centsFromTarget > 0 ? '+' : ''}{centsFromTarget} cents
                  </span>
                  <span>Sharp ♯</span>
                </div>
              </div>

              {/* Status text */}
              <div className="text-center">
                {isTargetInTune ? (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="font-display text-lg font-bold text-[hsl(142_71%_45%)] uppercase tracking-wider"
                    style={{ textShadow: '0 0 20px hsl(142 71% 45% / 0.3)' }}
                  >
                    In Tune ✓
                  </motion.p>
                ) : (
                  <p className="font-body text-sm text-[hsl(var(--text-muted))]">
                    {centsFromTarget < 0 ? 'Tune up ↑' : 'Tune down ↓'}
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-8">
              <div className={`size-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                isListening
                  ? 'bg-[hsl(var(--semantic-success)/0.1)] border border-[hsl(var(--semantic-success)/0.2)]'
                  : 'bg-[hsl(var(--bg-surface))]'
              }`}>
                {isListening ? (
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 rounded-full bg-[hsl(var(--semantic-success))]"
                        animate={{ height: [4, 14, 4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                ) : (
                  <Mic className="size-7 text-[hsl(var(--text-muted))]" />
                )}
              </div>
              <p className="font-body text-sm text-[hsl(var(--text-muted))]">
                {isListening ? 'Play a string to detect pitch...' : 'Tap "Start Tuner" to begin'}
              </p>
            </div>
          )}
        </div>

        {/* Reference frequencies */}
        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-5">
          <h3 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-3">
            Standard Tuning Reference
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {GUITAR_STRINGS.map((gs) => {
              const isDetected = isListening && closestString?.string === gs.string && frequency !== null;
              const isSelected = selectedString?.string === gs.string;
              return (
                <div
                  key={gs.string}
                  className={`
                    flex flex-col items-center rounded-lg px-2 py-3 transition-all duration-200
                    ${isDetected
                      ? isTargetInTune
                        ? 'bg-[hsl(142_71%_45%/0.1)] border border-[hsl(142_71%_45%/0.3)]'
                        : 'bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.3)]'
                      : isSelected
                        ? 'bg-[hsl(var(--color-primary)/0.06)] border border-[hsl(var(--color-primary)/0.2)]'
                        : 'bg-[hsl(var(--bg-surface))] border border-transparent'
                    }
                  `}
                >
                  <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">String {gs.string}</span>
                  <span className={`font-display text-lg font-bold ${
                    isDetected
                      ? isTargetInTune ? 'text-[hsl(142_71%_45%)]' : 'text-[hsl(var(--color-primary))]'
                      : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {gs.note}
                  </span>
                  <span className="text-[10px] font-body text-[hsl(var(--text-muted))] tabular-nums">{gs.freq.toFixed(1)} Hz</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
