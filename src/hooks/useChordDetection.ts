import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordData } from '@/types/chord';

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

  const threshold = 0.50;
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







interface UseChordDetectionOptions {
  onCorrect?: () => void;
  targetChord?: ChordData | null;
  /** 1 (strict) – 10 (lenient). Default 6. */
  sensitivity?: number;
  /** If true, auto-start listening on mount */
  autoStart?: boolean;

}

export function useChordDetection({
  onCorrect,
  targetChord,
  sensitivity = 6,
  autoStart = false,
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
  const targetChordRef = useRef(targetChord);
  const sensitivityRef = useRef(sensitivity);
  const isListeningRef = useRef(false);
  const timeDomainBufferRef = useRef<Float32Array | null>(null);
  const prevFreqDataRef = useRef<Float32Array | null>(null);

  // Keep refs in sync
  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);

  useEffect(() => {
    targetChordRef.current = targetChord;
    // Reset result when chord changes
    setResult(null);
    cooldownRef.current = false;
  }, [targetChord]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

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

      // Mild boost in guitar fundamental range (80-500 Hz)
      const midBoost = ctx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 220;
      midBoost.Q.value = 0.6;
      midBoost.gain.value = 4;
      notch2.connect(midBoost);

      // Reduce high-frequency string noise above guitar range
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3500;
      lowPass.Q.value = 0.5;
      midBoost.connect(lowPass);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384;
      // Lower smoothing for faster transient response
      analyser.smoothingTimeConstant = 0.7;
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
      const MATCH_THRESHOLD = 3;    // Need 3 consecutive matches (~210ms) to confirm
      const MISS_THRESHOLD = 3;     // Need 3 consecutive misses to show wrong

      // Analysis loop at ~14 Hz for faster response
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current || !audioContextRef.current) return;
        // Skip if AudioContext got suspended
        if (audioContextRef.current.state !== 'running') return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const sens = sensitivityRef.current;
        const t = (sens - 1) / 9; // 0..1 sensitivity normalization
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
          const rmsThreshold = lerp(0.018, 0.005, t);
          // Compute RMS over the buffer
          let rmsSum = 0;
          const buf = timeDomainBufferRef.current;
          const rmsLen = Math.min(buf.length, 4096);
          for (let i = 0; i < rmsLen; i++) rmsSum += buf[i] * buf[i];
          const rms = Math.sqrt(rmsSum / rmsLen);
          if (rms < rmsThreshold) {
            // Signal is too quiet — silence, skip analysis entirely
            consecutiveMatches = 0;
            consecutiveMisses = 0;
            return;
          }
          nsdfPitch = autoCorrelateNSDF(buf, audioContextRef.current.sampleRate, rmsThreshold);
        }

        // Voice rejection: require NSDF to find a clean periodic signal
        // Guitar produces clean pitched tones; voice is quasi-periodic with lower NSDF peaks
        if (nsdfPitch <= 0) {
          // No clean pitch detected — likely noise or voice, skip
          consecutiveMatches = 0;
          return;
        }

        const chroma = extractChroma(freqData, analyserRef.current, sens, nsdfPitch);
        if (!chroma) {
          // No signal — reset counters
          consecutiveMatches = 0;
          consecutiveMisses = 0;
          return;
        }

        // Spectral crest factor: guitar has sharp harmonic peaks, voice has broad formants
        const crestFactor = computeSpectralCrest(freqData, analyserRef.current);
        const minCrest = lerp(4.5, 2.5, t); // stricter at low sensitivity
        if (crestFactor < minCrest) {
          // Spectrum too flat / voice-like — reject
          consecutiveMatches = 0;
          return;
        }

        // Spectral flux gate: reject signals with high frame-to-frame change
        // Voice formants shift continuously → high flux; guitar is stable after attack → low flux
        if (spectralFlux >= 0) {
          const maxFlux = lerp(1.5, 3.5, t); // avg dB/bin; stricter at low sensitivity
          if (spectralFlux > maxFlux) {
            // High spectral instability — likely voice or other non-guitar source
            consecutiveMatches = 0;
            return;
          }
        }

        const expectedPc = getChordPitchClasses(chord);
        const isMatch = matchChroma(chroma, expectedPc, sens);

        if (isMatch) {
          consecutiveMatches++;
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
          consecutiveMisses++;
          consecutiveMatches = 0;

          if (consecutiveMisses >= MISS_THRESHOLD) {
            consecutiveMisses = 0;
            cooldownRef.current = true;
            setResult('wrong');
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

  // Guitar range: ~70 Hz to ~2500 Hz (tighter upper bound reduces noise)
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

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < dbFloor) continue;

    const magnitude = Math.pow(10, (db - dbFloor) / 20);
    const freq = bin * binWidth;
    if (freq < 65) continue;

    const midi = freqToMidi(freq);
    const pc = ((Math.round(midi) % 12) + 12) % 12;

    // Determine which octave band this falls in for normalization
    let bandIdx = 0;
    for (let b = 0; b < octaveBands.length - 1; b++) {
      if (freq >= octaveBands[b] && freq < octaveBands[b + 1]) { bandIdx = b; break; }
    }
    const normFactor = bandEnergies[bandIdx] > 0.001 ? 1.0 / bandEnergies[bandIdx] : 1.0;

    // Weight fundamentals more heavily than upper harmonics
    let weight = 1.0;
    if (freq <= 500) {
      weight = 2.2;  // Strong weight on fundamentals
    } else if (freq <= 1000) {
      weight = 1.4;
    } else {
      weight = 0.5;  // Reduced weight on upper harmonics
    }

    // Apply spectral whitening normalization (capped to prevent extreme values)
    const normalizedMag = magnitude * Math.min(normFactor, 5.0);
    chroma[pc] += normalizedMag * weight;
    totalEnergy += magnitude;
  }

  // Noise gate
  if (totalEnergy < noiseGateEnergy) return null;

  // If NSDF detected a valid pitch, boost that pitch class modestly
  if (nsdfPitch > 0) {
    const nsdfMidi = freqToMidi(nsdfPitch);
    const nsdfPc = ((Math.round(nsdfMidi) % 12) + 12) % 12;
    const maxChroma = Math.max(...chroma);
    if (maxChroma > 0) {
      // Moderate boost to NSDF-confirmed fundamental (reduced from 0.7 to avoid false positives)
      chroma[nsdfPc] += maxChroma * 0.35;
    }
  }

  // Normalize chroma to [0, 1] range for more consistent matching
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
 */
function matchChroma(
  chroma: Float64Array,
  expected: Set<number>,
  sensitivity: number
): boolean {
  if (expected.size === 0) return false;

  const t = (sensitivity - 1) / 9; // 0..1

  // Adaptive threshold based on the number of expected pitch classes
  // Smaller chords (2-3 notes) need stricter matching; larger chords (5-6) can be more lenient
  const sizeBonus = Math.min((expected.size - 3) * 0.02, 0.06);
  const chromaThreshold = lerp(0.25, 0.08, t) - sizeBonus;
  const matchRatioMin = lerp(0.72, 0.40, t);
  const maxExtrasBase = lerp(2, 5, t);

  // Chroma is already normalized to [0,1] from extractChroma
  const maxVal = Math.max(...chroma);
  if (maxVal < 0.01) return false;

  const threshold = chromaThreshold;
  const detected = new Set<number>();
  const detectedStrengths = new Map<number, number>();
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= threshold) {
      detected.add(i);
      detectedStrengths.set(i, chroma[i]);
    }
  }

  // Weighted match: stronger detected notes count more
  let weightedMatches = 0;
  let totalWeight = 0;
  for (const pc of expected) {
    const strength = chroma[pc];
    // Use the raw chroma value, not just binary presence
    if (strength >= threshold * 0.6) {
      // Partial credit for notes just below threshold
      weightedMatches += Math.min(strength / threshold, 1.5);
    }
    totalWeight += 1;
  }

  const weightedRatio = totalWeight > 0 ? weightedMatches / totalWeight : 0;

  // Also compute simple binary match ratio
  let binaryMatches = 0;
  for (const pc of expected) {
    if (detected.has(pc)) binaryMatches++;
  }
  const binaryRatio = binaryMatches / expected.size;

  // Use the higher of weighted and binary ratios
  const effectiveRatio = Math.max(weightedRatio, binaryRatio);

  const extras = [...detected].filter((pc) => !expected.has(pc)).length;
  const maxExtras = Math.floor(maxExtrasBase) + expected.size;

  // Require a minimum number of detected expected notes (at least 2, or all if chord has ≤2)
  const minDetectedNotes = Math.min(2, expected.size);
  if (binaryMatches < minDetectedNotes) return false;

  // Penalize excessive extra notes more at lower sensitivity
  const extraPenalty = extras > maxExtras ? (extras - maxExtras) * lerp(0.08, 0.02, t) : 0;

  return (effectiveRatio - extraPenalty) >= matchRatioMin;
}
