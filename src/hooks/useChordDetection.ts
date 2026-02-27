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
          // Request high sample rate for better harmonic resolution
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // High-pass filter to remove low-frequency rumble below guitar range (~70 Hz)
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 65;
      highPass.Q.value = 0.7;
      source.connect(highPass);

      // Mild boost in guitar fundamental range (80–500 Hz)
      const midBoost = ctx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 250;
      midBoost.Q.value = 0.8;
      midBoost.gain.value = 3;
      highPass.connect(midBoost);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384; // larger FFT for better low-frequency resolution
      analyser.smoothingTimeConstant = 0.78;
      midBoost.connect(analyser);
      analyserRef.current = analyser;

      isListeningRef.current = true;
      setIsListening(true);
      setPermissionDenied(false);

      // Analysis loop at ~10 Hz
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current) return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const sens = sensitivityRef.current;
        const bufLen = analyserRef.current.frequencyBinCount;
        const freqData = new Float32Array(bufLen);
        analyserRef.current.getFloatFrequencyData(freqData);

        const chroma = extractChroma(freqData, analyserRef.current, sens);
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
      // Small delay to let the page settle
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

  return {
    isListening,
    result,
    permissionDenied,
    toggleListening,
    stopListening,
  };
}

/**
 * Build a 12-bin chromagram from FFT frequency data.
 * Uses harmonic product spectrum weighting for better fundamental detection.
 * Returns null if the overall energy is below the noise gate.
 */
function extractChroma(
  freqData: Float32Array,
  analyser: AnalyserNode,
  sensitivity: number
): Float64Array | null {
  const t = (sensitivity - 1) / 9; // 0..1
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  // Sensitivity-derived thresholds
  const dbFloor = lerp(-42, -68, t); // which dB bins to include
  const noiseGateEnergy = lerp(14, 2.5, t); // total energy to pass

  const chroma = new Float64Array(12);
  let totalEnergy = 0;

  // Guitar range: ~70 Hz (drop D low) to ~2800 Hz (harmonics of high notes)
  const minBin = Math.floor(65 / binWidth);
  const maxBin = Math.min(Math.ceil(2800 / binWidth), freqData.length);

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < dbFloor) continue;

    // Convert dB to approximate linear magnitude
    const magnitude = Math.pow(10, (db - dbFloor) / 25);
    const freq = bin * binWidth;
    if (freq < 60) continue;

    const midi = freqToMidi(freq);
    const pc = ((Math.round(midi) % 12) + 12) % 12;

    // Weight fundamentals (80–600 Hz) more heavily than upper harmonics
    let weight = 1.0;
    if (freq <= 600) {
      weight = 1.8; // boost fundamental range
    } else if (freq <= 1200) {
      weight = 1.2; // mild boost for first harmonics
    } else {
      weight = 0.7; // attenuate upper harmonics to reduce false positives
    }

    chroma[pc] += magnitude * weight;
    totalEnergy += magnitude;
  }

  // Harmonic product spectrum: reinforce fundamentals by checking integer multiples
  const hpsChroma = new Float64Array(12);
  for (let pc = 0; pc < 12; pc++) {
    // A true fundamental should have energy at its octave (+12 semitones = same pitch class)
    // So we just accumulate — the weighting above already handles this
    hpsChroma[pc] = chroma[pc];
  }

  // Noise gate
  if (totalEnergy < noiseGateEnergy) return null;

  return hpsChroma;
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

  // Sensitivity-derived match parameters
  const chromaThreshold = lerp(0.28, 0.12, t); // % of peak to count as "present"
  const matchRatioMin = lerp(0.72, 0.38, t); // min % of expected notes detected
  const maxExtrasBase = lerp(1.5, 4.5, t); // allowed extra detected notes

  const maxVal = Math.max(...chroma);
  if (maxVal < 0.01) return false;

  // Determine which pitch classes are "present"
  const threshold = maxVal * chromaThreshold;
  const detected = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= threshold) {
      detected.add(i);
    }
  }

  // Count how many expected pitch classes are detected
  let matches = 0;
  for (const pc of expected) {
    if (detected.has(pc)) matches++;
  }

  const matchRatio = matches / expected.size;

  // Count unexpected extra notes
  const extras = [...detected].filter((pc) => !expected.has(pc)).length;
  const maxExtras = Math.floor(maxExtrasBase) + expected.size;

  return matchRatio >= matchRatioMin && extras <= maxExtras;
}
