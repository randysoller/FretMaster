import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordData } from '@/types/chord';
import { CHORDS } from '@/constants/chords';

// Standard guitar tuning MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

/** Derive the set of pitch classes (0–11) from a chord's frets array */
function getChordPitchClasses(chord: ChordData): Set<number> {
  const pc = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue; // muted
    const midi = OPEN_STRING_MIDI[i] + fret;
    pc.add(((midi % 12) + 12) % 12);
  }
  return pc;
}

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ─── NSDF (YIN-style) pitch detection for chord detection ───

function autoCorrelateNSDF(buffer: Float32Array, sampleRate: number, rmsThreshold: number): number {
  // Use a sub-window of the buffer for faster computation (4096 samples is plenty for guitar)
  const windowSize = Math.min(buffer.length, 4096);
  const offset = Math.floor((buffer.length - windowSize) / 2);

  let rms = 0;
  for (let i = offset; i < offset + windowSize; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / windowSize);
  if (rms < rmsThreshold) return -1;

  const halfSize = Math.floor(windowSize / 2);

  // Apply Hanning window for cleaner spectral analysis
  const windowed = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    windowed[i] = buffer[offset + i] * w;
  }

  // Normalized Square Difference Function (NSDF)
  const nsdf = new Float32Array(halfSize);
  // Only compute for guitar-relevant lag range: ~34 samples (1400Hz@48k) to ~740 samples (65Hz@48k)
  const minLag = Math.max(1, Math.floor(sampleRate / 1500));
  const maxLag = Math.min(halfSize - 1, Math.ceil(sampleRate / 60));

  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let divisor = 0;
    const len = windowSize - tau;
    for (let i = 0; i < len; i++) {
      acf += windowed[i] * windowed[i + tau];
      divisor += windowed[i] * windowed[i] + windowed[i + tau] * windowed[i + tau];
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  const threshold = 0.42; // Lowered for polyphonic guitar chords (multi-string)
  let bestTau = -1;
  let bestVal = -Infinity;

  // Find first zero crossing after minLag
  let firstZero = minLag;
  while (firstZero <= maxLag && nsdf[firstZero] > 0) {
    firstZero++;
  }

  // Collect all positive-region peaks
  const peaks: { tau: number; val: number }[] = [];
  let idx = firstZero;
  while (idx <= maxLag) {
    while (idx <= maxLag && nsdf[idx] <= 0) idx++;
    let peakTau = idx;
    let peakVal = nsdf[idx] ?? 0;
    while (idx <= maxLag && nsdf[idx] > 0) {
      if (nsdf[idx] > peakVal) {
        peakVal = nsdf[idx];
        peakTau = idx;
      }
      idx++;
    }
    if (peakVal >= 0.2) {
      peaks.push({ tau: peakTau, val: peakVal });
    }
  }

  if (peaks.length === 0) return -1;

  // Pick first peak above threshold (lowest frequency fundamental)
  for (const p of peaks) {
    if (p.val >= threshold) {
      bestTau = p.tau;
      bestVal = p.val;
      break;
    }
  }

  // Fallback: strongest peak
  if (bestTau <= 0) {
    for (const p of peaks) {
      if (p.val > bestVal) {
        bestVal = p.val;
        bestTau = p.tau;
      }
    }
  }

  if (bestTau <= 0 || bestVal < 0.3) return -1;

  // Parabolic interpolation for sub-sample precision
  let refinedTau = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const prev = nsdf[bestTau - 1];
    const curr = nsdf[bestTau];
    const next = nsdf[bestTau + 1];
    const denominator = 2 * (2 * curr - prev - next);
    if (Math.abs(denominator) > 1e-10) {
      refinedTau = bestTau + (prev - next) / denominator;
    }
  }

  const frequency = sampleRate / refinedTau;
  // Guitar range ~60Hz to ~1400Hz
  if (frequency < 60 || frequency > 1400) return -1;
  return frequency;
}

export type DetectionResult = 'correct' | 'wrong' | null;

/** Detect if a chord is a barre chord based on its data */
function isBarreChord(chord: ChordData): boolean {
  // Check explicit barre markers
  if (chord.barres && chord.barres.length > 0) return true;
  // Check category
  if (chord.category === 'barre') return true;
  // Heuristic: if most strings are fretted at or above a common minimum fret (>=1)
  const fretted = chord.frets.filter(f => f > 0);
  if (fretted.length >= 4) {
    const minFret = Math.min(...fretted);
    const sameMinCount = fretted.filter(f => f === minFret).length;
    if (sameMinCount >= 3 && minFret >= 1) return true;
  }
  return false;
}

// Pre-compute pitch class sets for all known chords for confusion matching
const ALL_CHORD_TEMPLATES: { chord: ChordData; pitchClasses: Set<number>; chromaTemplate: Float64Array }[] = (() => {
  const templates: typeof ALL_CHORD_TEMPLATES = [];
  // Use a Set to avoid duplicate symbols (some chords appear in multiple categories)
  const seenSymbols = new Set<string>();
  for (const chord of CHORDS) {
    if (seenSymbols.has(chord.symbol)) continue;
    seenSymbols.add(chord.symbol);
    const pc = getChordPitchClasses(chord);
    const template = new Float64Array(12);
    for (const p of pc) template[p] = 1.0;
    templates.push({ chord, pitchClasses: pc, chromaTemplate: template });
  }
  return templates;
})();

/**
 * Identify the best-matching chord from the full library given a chromagram.
 * Returns the chord symbol or null if no good match.
 */
function identifyBestMatch(chroma: Float64Array, excludeSymbol?: string): string | null {
  let bestSim = -1;
  let bestSymbol: string | null = null;

  for (const { chord, chromaTemplate } of ALL_CHORD_TEMPLATES) {
    if (chord.symbol === excludeSymbol) continue;
    // Cosine similarity
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < 12; i++) {
      dot += chroma[i] * chromaTemplate[i];
      normA += chroma[i] * chroma[i];
      normB += chromaTemplate[i] * chromaTemplate[i];
    }
    const sim = (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    if (sim > bestSim) {
      bestSim = sim;
      bestSymbol = chord.symbol;
    }
  }

  // Only return if similarity is reasonably high
  return bestSim >= 0.35 ? bestSymbol : null;
}







export interface AdvancedDetectionSettings {
  noiseGate: number;       // 0-100
  harmonicBoost: number;   // 0-100
  fluxTolerance: number;   // 0-100
}

interface UseChordDetectionOptions {
  onCorrect?: () => void;
  onWrongDetected?: (detectedSymbol: string) => void;
  targetChord?: ChordData | null;
  /** 1 (strict) – 10 (lenient). Default 6. */
  sensitivity?: number;
  /** If true, auto-start listening on mount */
  autoStart?: boolean;
  /** Optional advanced per-parameter overrides. When provided, overrides sensitivity-derived values. */
  advancedSettings?: AdvancedDetectionSettings | null;
}

export function useChordDetection({
  onCorrect,
  onWrongDetected,
  targetChord,
  sensitivity = 6,
  autoStart = false,
  advancedSettings = null,
}: UseChordDetectionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<DetectionResult>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);


  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const onCorrectRef = useRef(onCorrect);
  const onWrongDetectedRef = useRef(onWrongDetected);
  const targetChordRef = useRef(targetChord);
  const sensitivityRef = useRef(sensitivity);
  const isListeningRef = useRef(false);
  const timeDomainBufferRef = useRef<Float32Array | null>(null);
  const prevFreqDataRef = useRef<Float32Array | null>(null);
  const advancedSettingsRef = useRef(advancedSettings);
  const lastDetectedChromaRef = useRef<Float64Array | null>(null);

  // Keep refs in sync
  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);

  useEffect(() => {
    onWrongDetectedRef.current = onWrongDetected;
  }, [onWrongDetected]);

  useEffect(() => {
    targetChordRef.current = targetChord;
    // Reset result when chord changes
    setResult(null);
    cooldownRef.current = false;
  }, [targetChord]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    advancedSettingsRef.current = advancedSettings;
  }, [advancedSettings]);

  const stopListening = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    timeDomainBufferRef.current = null;
    prevFreqDataRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    setResult(null);
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return; // prevent double-start
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      // Ensure AudioContext is running (may be suspended without direct user gesture)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // High-pass filter to remove low-frequency rumble below guitar range
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 70;
      highPass.Q.value = 0.71;
      source.connect(highPass);

      // Notch out 50/60 Hz mains hum harmonics
      const notch1 = ctx.createBiquadFilter();
      notch1.type = 'notch';
      notch1.frequency.value = 50;
      notch1.Q.value = 10;
      highPass.connect(notch1);

      const notch2 = ctx.createBiquadFilter();
      notch2.type = 'notch';
      notch2.frequency.value = 60;
      notch2.Q.value = 10;
      notch1.connect(notch2);

      // Broader boost in guitar fundamental range (80-400 Hz)
      const midBoost = ctx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 200;
      midBoost.Q.value = 0.5;
      midBoost.gain.value = 5;
      notch2.connect(midBoost);

      // Secondary boost for 2nd/3rd harmonic range (400-800 Hz)
      const harmonicBoostFilter = ctx.createBiquadFilter();
      harmonicBoostFilter.type = 'peaking';
      harmonicBoostFilter.frequency.value = 500;
      harmonicBoostFilter.Q.value = 0.7;
      harmonicBoostFilter.gain.value = 3;
      midBoost.connect(harmonicBoostFilter);

      // Tighter low-pass: guitar useful harmonics are below 3kHz
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3000;
      lowPass.Q.value = 0.5;
      harmonicBoostFilter.connect(lowPass);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384;
      // Balanced smoothing for harmonic clarity + transient response
      analyser.smoothingTimeConstant = 0.65;
      lowPass.connect(analyser);
      analyserRef.current = analyser;
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize);

      isListeningRef.current = true;
      setIsListening(true);
      setPermissionDenied(false);

      // Double-check AudioContext is running before starting analysis
      if (ctx.state !== 'running') {
        console.warn('[FretMaster] AudioContext not running, state:', ctx.state);
        await ctx.resume();
      }

      // Consecutive match tracking for debounced confirmation
      let consecutiveMatches = 0;
      let consecutiveMisses = 0;
      let activeSignalFrames = 0;   // Frames with signal above noise floor
      let silenceFrames = 0;        // Track sustained silence to know when to reset miss counter
      const MATCH_THRESHOLD = 3;    // Need 3 consecutive matches (~210ms) to confirm — brief plosives can't sustain this
      const MISS_THRESHOLD = 2;     // Need 2 consecutive misses to show wrong (lowered for responsiveness)
      const MIN_ACTIVE_FRAMES = 3;  // Signal must be present for 3+ frames (~210ms) before matches count
      const SILENCE_RESET_FRAMES = 8; // Only reset miss counter after ~560ms sustained silence

      // Analysis loop at ~14 Hz for faster response
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current || !audioContextRef.current) return;
        // Skip if AudioContext got suspended
        if (audioContextRef.current.state !== 'running') return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const sens = sensitivityRef.current;
        const t = (sens - 1) / 9; // 0..1 sensitivity normalization
        const adv = advancedSettingsRef.current;
        // Advanced per-parameter overrides
        const tNoise = adv ? adv.noiseGate / 100 : t;
        const tFlux = adv ? adv.fluxTolerance / 100 : t;
        const effectiveSensForChroma = adv ? 1 + (adv.harmonicBoost / 100) * 9 : sens;
        const bufLen = analyserRef.current.frequencyBinCount;
        const freqData = new Float32Array(bufLen);
        analyserRef.current.getFloatFrequencyData(freqData);

        // ─── Spectral Flux: frame-to-frame spectral change ───
        // Voice has high flux (shifting formants); guitar is stable after attack
        let spectralFlux = -1; // -1 = no previous frame available
        const prevFreq = prevFreqDataRef.current;
        if (prevFreq && prevFreq.length === bufLen && audioContextRef.current) {
          const sr = audioContextRef.current.sampleRate;
          const ffts = analyserRef.current.fftSize;
          const bw = sr / ffts;
          const fMinBin = Math.floor(70 / bw);
          const fMaxBin = Math.min(Math.ceil(2500 / bw), bufLen);
          let flux = 0;
          let fluxCount = 0;
          for (let bin = fMinBin; bin < fMaxBin; bin++) {
            const diff = freqData[bin] - prevFreq[bin];
            if (diff > 0) flux += diff; // half-wave rectified (captures spectral onsets)
            fluxCount++;
          }
          spectralFlux = fluxCount > 0 ? flux / fluxCount : 0;
        }
        // Always store current frame for next comparison
        if (!prevFreqDataRef.current || prevFreqDataRef.current.length !== bufLen) {
          prevFreqDataRef.current = new Float32Array(bufLen);
        }
        prevFreqDataRef.current.set(freqData);

        // Hard RMS silence gate on time-domain signal before any analysis
        let nsdfPitch = -1;
        if (timeDomainBufferRef.current) {
          analyserRef.current.getFloatTimeDomainData(timeDomainBufferRef.current);
          const rmsThreshold = lerp(0.018, 0.005, tNoise);
          // Compute RMS over the buffer
          let rmsSum = 0;
          const buf = timeDomainBufferRef.current;
          const rmsLen = Math.min(buf.length, 4096);
          for (let i = 0; i < rmsLen; i++) rmsSum += buf[i] * buf[i];
          const rms = Math.sqrt(rmsSum / rmsLen);
          if (rms < rmsThreshold) {
            // Signal is too quiet — silence, skip analysis entirely
            consecutiveMatches = 0;
            activeSignalFrames = 0;
            silenceFrames++;
            // Only reset miss counter after sustained silence — brief gaps between
            // strums should NOT reset it, otherwise "wrong" never accumulates
            if (silenceFrames >= SILENCE_RESET_FRAMES) {
              consecutiveMisses = 0;
            }
            return;
          }
          silenceFrames = 0; // Signal present, reset silence counter
          nsdfPitch = autoCorrelateNSDF(buf, audioContextRef.current.sampleRate, rmsThreshold);
        }

        // NSDF pitch is a bonus signal for chroma extraction, NOT a hard gate.
        // Polyphonic chords (multiple simultaneous strings) often don't produce
        // a single clean periodic signal, so gating on NSDF rejects valid chords.
        // Voice rejection relies on crest factor + spectral flux instead.

        // Determine if target is a barre chord for adapted thresholds
        const isBarre = isBarreChord(chord);

        const chroma = extractChroma(freqData, analyserRef.current, effectiveSensForChroma, nsdfPitch);
        if (!chroma) {
          // Signal present but too weak for chroma — reset match counter
          // but do NOT reset miss counter, otherwise wrong never triggers
          consecutiveMatches = 0;
          return;
        }

        // Store latest chroma for confusion identification
        lastDetectedChromaRef.current = chroma;

        // Track how long signal has been active — prevents transient bursts
        // (plosive consonants, claps, etc.) from immediately counting as matches
        activeSignalFrames++;

        // Spectral flatness gate: broadband noise (plosives like "ha", "ka", claps)
        // has energy uniformly spread across all frequencies → high flatness.
        // Guitar chords concentrate energy at harmonic peaks → low flatness.
        // Barre chords produce more dampened harmonics with slightly higher flatness,
        // so we relax the threshold when targeting a barre chord.
        const spectralFlatness = computeSpectralFlatness(freqData, analyserRef.current);
        const barreFlat = isBarre ? 0.08 : 0; // allow more spectral spread for barre chords
        const maxFlatness = lerp(0.20, 0.40, tNoise) + barreFlat;
        let gateBlocked = false;
        if (spectralFlatness > maxFlatness) {
          // Energy is too uniformly distributed — broadband noise, not guitar harmonics
          gateBlocked = true;
        }

        // Spectral crest factor: guitar has sharp harmonic peaks, voice has broad formants
        // Barre chords have weaker/muffled harmonics → lower crest factor than open chords,
        // so we reduce the minimum threshold when targeting a barre chord.
        const crestFactor = computeSpectralCrest(freqData, analyserRef.current);
        const barreCrestReduction = isBarre ? 0.6 : 0;
        const minCrest = lerp(3.0, 1.5, tNoise) - barreCrestReduction;
        if (!gateBlocked && crestFactor < minCrest) {
          // Spectrum too flat / voice-like — reject
          gateBlocked = true;
        }

        // Formant detection: voice has characteristic F1/F2 two-hump spectral envelope
        // Guitar chords produce a flatter smoothed envelope without the formant dip
        const formantScore = computeFormantScore(freqData, analyserRef.current);
        const maxFormant = lerp(0.25, 0.55, tNoise); // stricter at low sensitivity
        if (!gateBlocked && formantScore > maxFormant) {
          // Spectral envelope matches human vowel formant pattern — reject
          gateBlocked = true;
        }

        // Spectral flux gate: reject signals with high frame-to-frame change
        // Voice formants shift continuously → high flux; guitar is stable after attack → low flux
        if (!gateBlocked && spectralFlux >= 0) {
          const maxFlux = lerp(1.5, 3.5, tFlux); // avg dB/bin; stricter at low sensitivity
          if (spectralFlux > maxFlux) {
            // High spectral instability — likely voice or other non-guitar source
            gateBlocked = true;
          }
        }

        const expectedPc = getChordPitchClasses(chord);
        const isMatch = !gateBlocked && matchChroma(chroma, expectedPc, effectiveSensForChroma, isBarre);

        if (isMatch) {
          // Only count matches after signal has been stable for enough frames
          // This prevents brief plosive bursts from triggering false positives
          if (activeSignalFrames >= MIN_ACTIVE_FRAMES) {
            consecutiveMatches++;
          }
          consecutiveMisses = 0;

          if (consecutiveMatches >= MATCH_THRESHOLD) {
            consecutiveMatches = 0;
            cooldownRef.current = true;
            setResult('correct');
            setTimeout(() => {
              onCorrectRef.current?.();
              setResult(null);
              cooldownRef.current = false;
            }, 1500);
          }
        } else {
          // Gate-blocked signals (voice, noise) should NOT count as wrong guitar chord.
          // Only count as a miss if we have valid chroma (real signal) that doesn't match.
          if (!gateBlocked && activeSignalFrames >= MIN_ACTIVE_FRAMES) {
            consecutiveMisses++;
          }
          consecutiveMatches = 0;

          if (consecutiveMisses >= MISS_THRESHOLD) {
            consecutiveMisses = 0;
            cooldownRef.current = true;
            setResult('wrong');

            // Identify what chord was actually detected for confusion tracking
            const lastChroma = lastDetectedChromaRef.current;
            if (lastChroma && onWrongDetectedRef.current) {
              const detectedSymbol = identifyBestMatch(lastChroma, chord.symbol);
              if (detectedSymbol) {
                onWrongDetectedRef.current(detectedSymbol);
              }
            }

            setTimeout(() => {
              setResult(null);
              cooldownRef.current = false;
            }, 1800);
          }
        }
      }, 70);
    } catch (e) {
      console.error('[FretMaster] Microphone access denied:', e);
      setPermissionDenied(true);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Auto-start mic on mount
  useEffect(() => {
    if (autoStart && !isListeningRef.current) {
      const t = setTimeout(() => {
        startListening();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [autoStart, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const pauseDetection = useCallback((ms: number) => {
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, ms);
  }, []);

  return {
    isListening,
    result,
    permissionDenied,
    toggleListening,
    stopListening,
    pauseDetection,

  };
}

/**
 * Build a 12-bin chromagram from FFT frequency data + NSDF pitch.
 * Uses NSDF-detected fundamental to boost confidence in the correct pitch class.
 * Returns null if the overall energy is below the noise gate.
 */
/**
 * Compute spectral crest factor (peakiness) over the guitar range.
 * Guitar has sharp harmonic peaks → high crest; voice has broad formants → low crest.
 */
/**
 * Detect human voice formant structure in the spectral envelope.
 * Voice has characteristic broad peaks at F1 (300-900Hz) and F2 (900-2500Hz)
 * with a valley between them. Guitar harmonics are sharper and more evenly
 * distributed, producing a flatter smoothed envelope.
 * Returns 0..1 where higher = more voice-like.
 */
/**
 * Spectral flatness (Wiener entropy): geometric mean / arithmetic mean of magnitude spectrum.
 * Broadband noise (plosive consonants like "ha", "ka") → flatness close to 1.0
 * Harmonic signals (guitar chords with discrete peaks) → flatness close to 0.0
 * This is mathematically distinct from crest factor: crest measures peak prominence,
 * flatness measures how uniformly energy is distributed across frequencies.
 */
function computeSpectralFlatness(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  // Analyze guitar-relevant range: 70–2500 Hz
  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  let logSum = 0;
  let linSum = 0;
  let count = 0;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < -80) continue;
    const lin = Math.pow(10, db / 20);
    logSum += Math.log(lin + 1e-12);
    linSum += lin;
    count++;
  }

  if (count < 10 || linSum <= 0) return 0;

  const geometricMean = Math.exp(logSum / count);
  const arithmeticMean = linSum / count;

  return arithmeticMean > 1e-12 ? geometricMean / arithmeticMean : 0;
}

function computeFormantScore(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  // Analyze 200–3000 Hz (covers both F1 and F2 ranges)
  const rangeMinHz = 200;
  const rangeMaxHz = 3000;
  const minBin = Math.floor(rangeMinHz / binWidth);
  const maxBin = Math.min(Math.ceil(rangeMaxHz / binWidth), freqData.length);
  const rangeLen = maxBin - minBin;
  if (rangeLen < 30) return 0;

  // Convert dB → linear magnitude
  const linear = new Float64Array(rangeLen);
  for (let i = 0; i < rangeLen; i++) {
    const db = freqData[minBin + i];
    linear[i] = db > -80 ? Math.pow(10, db / 20) : 0;
  }

  // Heavy moving-average smoothing (~100 Hz window) to blur individual harmonics
  // but preserve the broad formant peaks that define vowel sounds
  const smoothWindow = Math.max(7, Math.round(100 / binWidth));
  const halfWin = Math.floor(smoothWindow / 2);
  const envelope = new Float64Array(rangeLen);
  for (let i = 0; i < rangeLen; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(rangeLen - 1, i + halfWin);
    for (let j = lo; j <= hi; j++) {
      sum += linear[j];
      count++;
    }
    envelope[i] = count > 0 ? sum / count : 0;
  }

  // Find peak in F1 range (300–900 Hz)
  const f1Lo = Math.max(0, Math.floor((300 - rangeMinHz) / binWidth));
  const f1Hi = Math.min(rangeLen, Math.ceil((900 - rangeMinHz) / binWidth));
  let f1Peak = 0;
  let f1PeakIdx = f1Lo;
  for (let i = f1Lo; i < f1Hi; i++) {
    if (envelope[i] > f1Peak) { f1Peak = envelope[i]; f1PeakIdx = i; }
  }

  // Find peak in F2 range (900–2500 Hz)
  const f2Lo = Math.max(0, Math.floor((900 - rangeMinHz) / binWidth));
  const f2Hi = Math.min(rangeLen, Math.ceil((2500 - rangeMinHz) / binWidth));
  let f2Peak = 0;
  let f2PeakIdx = f2Lo;
  for (let i = f2Lo; i < f2Hi; i++) {
    if (envelope[i] > f2Peak) { f2Peak = envelope[i]; f2PeakIdx = i; }
  }

  // Both formant peaks must have meaningful energy
  if (f1Peak < 1e-6 || f2Peak < 1e-6) return 0;

  // Find the valley (minimum) between the two peaks
  // Voice formants create a characteristic "two-hump" shape with a dip between F1 and F2
  const valleyStart = Math.min(f1PeakIdx, f2PeakIdx) + 1;
  const valleyEnd = Math.max(f1PeakIdx, f2PeakIdx);
  let valleyMin = Infinity;
  for (let i = valleyStart; i < valleyEnd && i < rangeLen; i++) {
    if (envelope[i] < valleyMin) valleyMin = envelope[i];
  }
  if (!isFinite(valleyMin) || valleyMin < 1e-8) valleyMin = 1e-8;

  // Compute prominence: how much each peak stands above the valley
  const f1Prominence = f1Peak / valleyMin;
  const f2Prominence = f2Peak / valleyMin;

  // Measure F1 bandwidth: count smoothed bins above 70% of peak
  // Voice F1 formants are broad (80–200+ Hz); guitar harmonics even after smoothing are narrower
  const f1Thresh = f1Peak * 0.7;
  let f1WidthBins = 0;
  for (let i = f1Lo; i < f1Hi; i++) {
    if (envelope[i] >= f1Thresh) f1WidthBins++;
  }
  const f1BandwidthHz = f1WidthBins * binWidth;

  // Measure F2 bandwidth similarly
  const f2Thresh = f2Peak * 0.7;
  let f2WidthBins = 0;
  for (let i = f2Lo; i < f2Hi; i++) {
    if (envelope[i] >= f2Thresh) f2WidthBins++;
  }
  const f2BandwidthHz = f2WidthBins * binWidth;

  // Voice requires:
  //  - Both peaks prominent above valley (prominence > 1.4)
  //  - F1 bandwidth ≥ 60 Hz (broad, not a single harmonic)
  //  - F2 bandwidth ≥ 40 Hz
  //  - Peaks must be in separate regions (not both clustered in the same spot)
  const peakSeparationHz = Math.abs(f2PeakIdx - f1PeakIdx) * binWidth;
  const hasTwoHumpStructure =
    f1Prominence > 1.4 &&
    f2Prominence > 1.3 &&
    f1BandwidthHz >= 60 &&
    f2BandwidthHz >= 40 &&
    peakSeparationHz > 300; // F1 and F2 must be well-separated

  if (!hasTwoHumpStructure) return 0;

  // Score: combine prominence depth and bandwidth broadness
  // Higher score = more voice-like
  const prominenceScore = Math.min(1.0,
    ((f1Prominence - 1.0) * 0.25) + ((f2Prominence - 1.0) * 0.25)
  );
  const bandwidthScore = Math.min(1.0,
    (Math.min(f1BandwidthHz, 250) / 250) * 0.3 + (Math.min(f2BandwidthHz, 200) / 200) * 0.2
  );

  return Math.min(1.0, prominenceScore + bandwidthScore);
}

function computeSpectralCrest(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  let sumLin = 0;
  let maxLin = 0;
  let count = 0;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < -80) continue;
    const lin = Math.pow(10, db / 20);
    sumLin += lin;
    if (lin > maxLin) maxLin = lin;
    count++;
  }

  if (count < 5 || sumLin <= 0) return 0;
  const meanLin = sumLin / count;
  return meanLin > 0 ? maxLin / meanLin : 0;
}

function extractChroma(
  freqData: Float32Array,
  analyser: AnalyserNode,
  sensitivity: number,
  nsdfPitch: number
): Float64Array | null {
  const t = (sensitivity - 1) / 9; // 0..1
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  // Sensitivity-derived thresholds
  const dbFloor = lerp(-40, -72, t);
  const noiseGateEnergy = lerp(18, 4, t);

  const chroma = new Float64Array(12);
  let totalEnergy = 0;

  // Guitar range: ~70 Hz to ~2500 Hz
  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  // Spectral whitening: compute average energy per octave band to normalize
  const octaveBands = [70, 140, 280, 560, 1120, 2500];
  const bandEnergies: number[] = [];
  for (let b = 0; b < octaveBands.length - 1; b++) {
    let sum = 0;
    let count = 0;
    const lo = Math.floor(octaveBands[b] / binWidth);
    const hi = Math.min(Math.ceil(octaveBands[b + 1] / binWidth), freqData.length);
    for (let bin = lo; bin < hi; bin++) {
      if (freqData[bin] > dbFloor) {
        sum += Math.pow(10, (freqData[bin] - dbFloor) / 20);
        count++;
      }
    }
    bandEnergies.push(count > 0 ? sum / count : 0.001);
  }

  // Gaussian interpolation: spread bin energy to nearby pitch classes
  // Prevents energy loss when notes fall between integer MIDI bins
  const gaussSigma = 0.35; // semitones
  const gaussDenom = 2 * gaussSigma * gaussSigma;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < dbFloor) continue;

    const magnitude = Math.pow(10, (db - dbFloor) / 20);
    const freq = bin * binWidth;
    if (freq < 65) continue;

    const midi = freqToMidi(freq);
    const fractionalPc = ((midi % 12) + 12) % 12; // fractional pitch class

    // Determine which octave band this falls in for normalization
    let bandIdx = 0;
    for (let b = 0; b < octaveBands.length - 1; b++) {
      if (freq >= octaveBands[b] && freq < octaveBands[b + 1]) { bandIdx = b; break; }
    }
    const normFactor = bandEnergies[bandIdx] > 0.001 ? 1.0 / bandEnergies[bandIdx] : 1.0;

    // Smooth exponential frequency weighting (guitar fundamentals strongest)
    const weight = Math.max(0.3, Math.min(2.5, Math.exp(-0.0012 * (freq - 100))));

    // Apply spectral whitening normalization (capped to prevent extreme values)
    const normalizedMag = magnitude * Math.min(normFactor, 5.0) * weight;

    // Distribute energy via Gaussian interpolation across nearby pitch classes
    for (let pc = 0; pc < 12; pc++) {
      let dist = Math.abs(fractionalPc - pc);
      if (dist > 6) dist = 12 - dist; // wrap around circle
      const gaussWeight = Math.exp(-(dist * dist) / gaussDenom);
      if (gaussWeight > 0.01) {
        chroma[pc] += normalizedMag * gaussWeight;
      }
    }

    totalEnergy += magnitude;
  }

  // Noise gate
  if (totalEnergy < noiseGateEnergy) return null;

  // Harmonic series reinforcement:
  // If a pitch class has energy AND its expected harmonics (3rd=+7, 5th=+4 semitones)
  // also have energy, boost the fundamental — confirms it's a real played note
  const harmonicReinforcement = new Float64Array(12);
  for (let pc = 0; pc < 12; pc++) {
    if (chroma[pc] < 0.01) continue;
    const h3pc = (pc + 7) % 12; // 3rd harmonic (perfect 5th above)
    const h5pc = (pc + 4) % 12; // 5th harmonic (major 3rd two octaves up)
    const h3strength = chroma[h3pc];
    const h5strength = chroma[h5pc];
    // Reinforce fundamental when harmonics confirm it
    harmonicReinforcement[pc] += (h3strength + h5strength) * 0.15;
  }
  for (let pc = 0; pc < 12; pc++) {
    chroma[pc] += harmonicReinforcement[pc];
  }

  // NSDF pitch boost: reinforce detected fundamental AND its harmonic series
  if (nsdfPitch > 0) {
    const nsdfMidi = freqToMidi(nsdfPitch);
    const nsdfPc = ((Math.round(nsdfMidi) % 12) + 12) % 12;
    const maxChroma = Math.max(...chroma);
    if (maxChroma > 0) {
      chroma[nsdfPc] += maxChroma * 0.30;
      // Mildly boost expected harmonics of the NSDF fundamental
      const h3 = (nsdfPc + 7) % 12;
      const h5 = (nsdfPc + 4) % 12;
      chroma[h3] += maxChroma * 0.10;
      chroma[h5] += maxChroma * 0.08;
    }
  }

  // Normalize chroma to [0, 1] range for consistent matching
  const maxVal = Math.max(...chroma);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }

  return chroma;
}

/**
 * Compare a detected chromagram against expected pitch classes.
 * Returns true if the detected audio likely matches the chord.
 * When isBarre is true, thresholds are relaxed to account for the
 * muffled, dampened harmonics that barre chords produce.
 */
function matchChroma(
  chroma: Float64Array,
  expected: Set<number>,
  sensitivity: number,
  isBarre: boolean = false
): boolean {
  if (expected.size === 0) return false;

  const t = (sensitivity - 1) / 9; // 0..1

  // Barre chords produce weaker harmonics due to finger damping across all strings.
  // Some notes may be partially muted, so we need:
  // - Lower chroma threshold (notes are quieter)
  // - Lower match ratio requirement (some notes may be missing)
  // - Allow more extra pitch classes (sympathetic string buzz from barre pressure)
  const barreThresholdBonus = isBarre ? 0.04 : 0;
  const barreRatioReduction = isBarre ? 0.06 : 0;
  const barreExtrasBonus = isBarre ? 1.5 : 0;

  // Adaptive threshold based on the number of expected pitch classes
  const sizeBonus = Math.min((expected.size - 3) * 0.02, 0.06);
  const chromaThreshold = lerp(0.25, 0.08, t) - sizeBonus - barreThresholdBonus;
  const matchRatioMin = lerp(0.70, 0.38, t) - barreRatioReduction;
  const maxExtrasBase = lerp(2, 5, t) + barreExtrasBonus;

  const maxVal = Math.max(...chroma);
  if (maxVal < 0.01) return false;

  const detected = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= chromaThreshold) detected.add(i);
  }

  // Binary match ratio
  let binaryMatches = 0;
  for (const pc of expected) {
    if (detected.has(pc)) binaryMatches++;
  }
  const binaryRatio = binaryMatches / expected.size;

  // Weighted match: stronger detected notes get partial credit
  let weightedMatches = 0;
  for (const pc of expected) {
    const strength = chroma[pc];
    if (strength >= chromaThreshold * 0.6) {
      weightedMatches += Math.min(strength / chromaThreshold, 1.5);
    }
  }
  const weightedRatio = weightedMatches / expected.size;

  // Cosine similarity between detected chroma and ideal chord template
  // This captures the overall "shape" match, not just individual note presence
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 12; i++) {
    const templateVal = expected.has(i) ? 1.0 : 0;
    dotProduct += chroma[i] * templateVal;
    normA += chroma[i] * chroma[i];
    normB += templateVal * templateVal;
  }
  const cosineSim = (normA > 0 && normB > 0) ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;

  // Use the best of all three metrics (cosine slightly scaled up as it's naturally lower)
  const effectiveRatio = Math.max(weightedRatio, binaryRatio, cosineSim * 1.15);

  const extras = [...detected].filter((pc) => !expected.has(pc)).length;
  const maxExtras = Math.floor(maxExtrasBase) + expected.size;

  // Require a minimum number of detected expected notes (at least 2, or all if chord has ≤2)
  const minDetectedNotes = Math.min(2, expected.size);
  if (binaryMatches < minDetectedNotes) return false;

  // Penalize excessive extra notes more at lower sensitivity
  const extraPenalty = extras > maxExtras ? (extras - maxExtras) * lerp(0.08, 0.02, t) : 0;

  return (effectiveRatio - extraPenalty) >= matchRatioMin;
}
