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
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < rmsThreshold) return -1;

  const size = buffer.length;
  const halfSize = Math.floor(size / 2);

  // Normalized Square Difference Function (NSDF)
  const nsdf = new Float32Array(halfSize);
  for (let tau = 0; tau < halfSize; tau++) {
    let acf = 0;
    let divisor = 0;
    for (let i = 0; i < halfSize; i++) {
      acf += buffer[i] * buffer[i + tau];
      divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  const threshold = 0.5;
  let bestTau = -1;
  let bestVal = -Infinity;

  // Find first zero crossing
  let firstZero = 1;
  while (firstZero < halfSize - 1 && nsdf[firstZero] > 0) {
    firstZero++;
  }

  // Search positive regions
  let idx = firstZero;
  while (idx < halfSize - 1) {
    while (idx < halfSize - 1 && nsdf[idx] <= 0) idx++;
    let peakTau = idx;
    let peakVal = nsdf[idx];
    while (idx < halfSize - 1 && nsdf[idx] > 0) {
      if (nsdf[idx] > peakVal) {
        peakVal = nsdf[idx];
        peakTau = idx;
      }
      idx++;
    }
    if (peakVal >= threshold && peakVal > bestVal) {
      bestVal = peakVal;
      bestTau = peakTau;
      break;
    }
  }

  // Fallback: strongest peak
  if (bestTau <= 0) {
    idx = firstZero;
    while (idx < halfSize - 1) {
      while (idx < halfSize - 1 && nsdf[idx] <= 0) idx++;
      let peakTau = idx;
      let peakVal = nsdf[idx];
      while (idx < halfSize - 1 && nsdf[idx] > 0) {
        if (nsdf[idx] > peakVal) { peakVal = nsdf[idx]; peakTau = idx; }
        idx++;
      }
      if (peakVal > bestVal) { bestVal = peakVal; bestTau = peakTau; }
    }
  }

  if (bestTau <= 0 || bestVal < 0.25) return -1;

  // Parabolic interpolation
  let refinedTau = bestTau;
  if (bestTau > 0 && bestTau < halfSize - 1) {
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
  /** 1 (strict) – 10 (lenient). Default 5. */
  sensitivity?: number;
  /** If true, auto-start listening on mount */
  autoStart?: boolean;
}

export function useChordDetection({
  onCorrect,
  targetChord,
  sensitivity = 5,
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
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // High-pass filter to remove low-frequency rumble below guitar range
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 65;
      highPass.Q.value = 0.7;
      source.connect(highPass);

      // Mild boost in guitar fundamental range
      const midBoost = ctx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 250;
      midBoost.Q.value = 0.8;
      midBoost.gain.value = 3;
      highPass.connect(midBoost);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384;
      // Use minimal smoothing — we need both frequency-domain AND clean time-domain
      analyser.smoothingTimeConstant = 0.78;
      midBoost.connect(analyser);
      analyserRef.current = analyser;
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize);

      isListeningRef.current = true;
      setIsListening(true);
      setPermissionDenied(false);

      // Analysis loop at ~10 Hz
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current || !audioContextRef.current) return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const sens = sensitivityRef.current;
        const bufLen = analyserRef.current.frequencyBinCount;
        const freqData = new Float32Array(bufLen);
        analyserRef.current.getFloatFrequencyData(freqData);

        // Also do NSDF time-domain pitch detection for primary pitch
        let nsdfPitch = -1;
        if (timeDomainBufferRef.current) {
          analyserRef.current.getFloatTimeDomainData(timeDomainBufferRef.current);
          const t = (sens - 1) / 9;
          const rmsThreshold = lerp(0.015, 0.003, t);
          nsdfPitch = autoCorrelateNSDF(timeDomainBufferRef.current, audioContextRef.current.sampleRate, rmsThreshold);
        }

        const chroma = extractChroma(freqData, analyserRef.current, sens, nsdfPitch);
        if (!chroma) return; // below noise gate

        const expected = getChordPitchClasses(chord);
        const isMatch = matchChroma(chroma, expected, sens);

        // Enter cooldown
        cooldownRef.current = true;

        if (isMatch) {
          setResult('correct');
          setTimeout(() => {
            onCorrectRef.current?.();
            setResult(null);
            cooldownRef.current = false;
          }, 3000);
        } else {
          setResult('wrong');
          setTimeout(() => {
            setResult(null);
            cooldownRef.current = false;
          }, 1800);
        }
      }, 100);
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
  const dbFloor = lerp(-42, -68, t);
  const noiseGateEnergy = lerp(14, 2.5, t);

  const chroma = new Float64Array(12);
  let totalEnergy = 0;

  // Guitar range: ~70 Hz to ~2800 Hz
  const minBin = Math.floor(65 / binWidth);
  const maxBin = Math.min(Math.ceil(2800 / binWidth), freqData.length);

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < dbFloor) continue;

    const magnitude = Math.pow(10, (db - dbFloor) / 25);
    const freq = bin * binWidth;
    if (freq < 60) continue;

    const midi = freqToMidi(freq);
    const pc = ((Math.round(midi) % 12) + 12) % 12;

    // Weight fundamentals more heavily than upper harmonics
    let weight = 1.0;
    if (freq <= 600) {
      weight = 1.8;
    } else if (freq <= 1200) {
      weight = 1.2;
    } else {
      weight = 0.7;
    }

    chroma[pc] += magnitude * weight;
    totalEnergy += magnitude;
  }

  // Noise gate
  if (totalEnergy < noiseGateEnergy) return null;

  // If NSDF detected a valid pitch, boost that pitch class for higher confidence
  if (nsdfPitch > 0) {
    const nsdfMidi = freqToMidi(nsdfPitch);
    const nsdfPc = ((Math.round(nsdfMidi) % 12) + 12) % 12;
    const maxChroma = Math.max(...chroma);
    if (maxChroma > 0) {
      // Give the NSDF-confirmed pitch class a significant boost
      chroma[nsdfPc] += maxChroma * 0.5;
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

  const chromaThreshold = lerp(0.28, 0.12, t);
  const matchRatioMin = lerp(0.72, 0.38, t);
  const maxExtrasBase = lerp(1.5, 4.5, t);

  const maxVal = Math.max(...chroma);
  if (maxVal < 0.01) return false;

  const threshold = maxVal * chromaThreshold;
  const detected = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= threshold) {
      detected.add(i);
    }
  }

  let matches = 0;
  for (const pc of expected) {
    if (detected.has(pc)) matches++;
  }

  const matchRatio = matches / expected.size;
  const extras = [...detected].filter((pc) => !expected.has(pc)).length;
  const maxExtras = Math.floor(maxExtrasBase) + expected.size;

  return matchRatio >= matchRatioMin && extras <= maxExtras;
}
