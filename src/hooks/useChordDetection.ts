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

export type DetectionResult = 'correct' | 'wrong' | null;

interface UseChordDetectionOptions {
  onCorrect?: () => void;
  targetChord?: ChordData | null;
}

export function useChordDetection({ onCorrect, targetChord }: UseChordDetectionOptions) {
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
    setIsListening(false);
    setResult(null);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      setPermissionDenied(false);

      // Analysis loop at ~8 Hz
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current) return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const bufLen = analyserRef.current.frequencyBinCount;
        const freqData = new Float32Array(bufLen);
        analyserRef.current.getFloatFrequencyData(freqData);

        const chroma = extractChroma(freqData, analyserRef.current);
        if (!chroma) return; // below noise gate

        const expected = getChordPitchClasses(chord);
        const isMatch = matchChroma(chroma, expected);

        // Enter cooldown
        cooldownRef.current = true;

        if (isMatch) {
          setResult('correct');
          setTimeout(() => {
            onCorrectRef.current?.();
            setResult(null);
            cooldownRef.current = false;
          }, 1400);
        } else {
          setResult('wrong');
          setTimeout(() => {
            setResult(null);
            cooldownRef.current = false;
          }, 1800);
        }
      }, 130);
    } catch (e) {
      console.error('[FretMaster] Microphone access denied:', e);
      setPermissionDenied(true);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

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
 * Returns null if the overall energy is below the noise gate.
 */
function extractChroma(
  freqData: Float32Array,
  analyser: AnalyserNode
): Float64Array | null {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  const chroma = new Float64Array(12);
  let totalEnergy = 0;

  // Guitar fundamental range: ~75 Hz (E2) to ~1400 Hz (upper harmonics)
  const minBin = Math.floor(75 / binWidth);
  const maxBin = Math.min(Math.ceil(1400 / binWidth), freqData.length);

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < -55) continue; // skip very quiet bins

    // Convert dB to approximate linear magnitude (shifted so -55 dB → 0)
    const magnitude = Math.pow(10, (db + 55) / 30);
    const freq = bin * binWidth;
    if (freq < 70) continue;

    const midi = freqToMidi(freq);
    const pc = ((Math.round(midi) % 12) + 12) % 12;

    chroma[pc] += magnitude;
    totalEnergy += magnitude;
  }

  // Noise gate — reject very low energy (silence / ambient)
  if (totalEnergy < 8) return null;

  return chroma;
}

/**
 * Compare a detected chromagram against expected pitch classes.
 * Returns true if the detected audio likely matches the chord.
 */
function matchChroma(chroma: Float64Array, expected: Set<number>): boolean {
  if (expected.size === 0) return false;

  const maxVal = Math.max(...chroma);
  if (maxVal < 0.01) return false;

  // Determine which pitch classes are "present" (above 22% of peak)
  const threshold = maxVal * 0.22;
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

  // Guitar harmonics naturally add extra frequencies, so allow a few extras.
  // Need ≥ 55% of expected notes detected and extras shouldn't vastly outnumber expected.
  return matchRatio >= 0.55 && extras <= expected.size + 2;
}
