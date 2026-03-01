import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Tuning Presets ──────────────────────────────────────

export interface TuningPreset {
  id: string;
  name: string;
  /** MIDI note numbers for strings 6→1 (low E to high E in standard) */
  notes: number[];
  /** Display labels for each string */
  labels: string[];
}

export const TUNING_PRESETS: TuningPreset[] = [
  { id: 'standard',   name: 'Standard',        notes: [40, 45, 50, 55, 59, 64], labels: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'dropD',      name: 'Drop D',          notes: [38, 45, 50, 55, 59, 64], labels: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'halfDown',   name: 'Half Step Down',   notes: [39, 44, 49, 54, 58, 63], labels: ['Eb2','Ab2','Db3','Gb3','Bb3','Eb4'] },
  { id: 'fullDown',   name: 'Full Step Down',   notes: [38, 43, 48, 53, 57, 62], labels: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'openG',      name: 'Open G',          notes: [38, 43, 50, 55, 59, 62], labels: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'openD',      name: 'Open D',          notes: [38, 45, 50, 54, 57, 62], labels: ['D2', 'A2', 'D3', 'F#3','A3', 'D4'] },
  { id: 'openE',      name: 'Open E',          notes: [40, 47, 52, 56, 59, 64], labels: ['E2', 'B2', 'E3', 'G#3','B3', 'E4'] },
  { id: 'openA',      name: 'Open A',          notes: [40, 45, 52, 57, 61, 64], labels: ['E2', 'A2', 'E3', 'A3', 'C#4','E4'] },
  { id: 'dadgad',     name: 'DADGAD',          notes: [38, 45, 50, 55, 57, 62], labels: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  { id: 'dropC',      name: 'Drop C',          notes: [36, 43, 48, 53, 57, 62], labels: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
];

// ─── Note Helpers ────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function midiToNoteOnly(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

// ─── YIN Pitch Detection ─────────────────────────────────

/**
 * YIN autocorrelation algorithm for fundamental frequency detection.
 * Returns frequency in Hz, or null if no clear pitch detected.
 */
function yinDetect(buffer: Float32Array, sampleRate: number, threshold: number = 0.15): number | null {
  const halfLen = Math.floor(buffer.length / 2);
  const yinBuffer = new Float32Array(halfLen);

  // Step 1: Difference function
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const diff = buffer[i] - buffer[i + tau];
      sum += diff * diff;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] *= tau / runningSum;
  }

  // Step 3: Absolute threshold — find first dip below threshold
  // Start from tau corresponding to ~2000 Hz max (skip very high freqs)
  const minTau = Math.max(2, Math.floor(sampleRate / 2000));
  // End at tau corresponding to ~60 Hz (lowest guitar note ~65Hz for drop tunings, with some margin)
  const maxTau = Math.min(halfLen - 1, Math.floor(sampleRate / 55));

  let bestTau = -1;
  for (let tau = minTau; tau < maxTau; tau++) {
    if (yinBuffer[tau] < threshold) {
      // Find the local minimum in this dip
      while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) return null;

  // Step 4: Parabolic interpolation for sub-sample accuracy
  const s0 = yinBuffer[bestTau - 1] ?? yinBuffer[bestTau];
  const s1 = yinBuffer[bestTau];
  const s2 = yinBuffer[bestTau + 1] ?? yinBuffer[bestTau];
  const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
  const refinedTau = bestTau + (isFinite(shift) ? shift : 0);

  const freq = sampleRate / refinedTau;

  // Sanity check: guitar range ~55 Hz (Drop C low string) to ~1400 Hz (high fret, high string)
  if (freq < 55 || freq > 1400) return null;

  return freq;
}

// ─── Hook ────────────────────────────────────────────────

export interface TunerState {
  isListening: boolean;
  permissionDenied: boolean;
  /** Detected frequency in Hz */
  frequency: number | null;
  /** Nearest MIDI note number */
  nearestMidi: number | null;
  /** Cents deviation from nearest note (-50 to +50) */
  cents: number;
  /** Note name string e.g. "A4" */
  noteName: string;
  /** Note letter only e.g. "A" */
  noteOnly: string;
  /** RMS volume level 0..1 */
  volume: number;
}

export function useTuner() {
  const [state, setState] = useState<TunerState>({
    isListening: false,
    permissionDenied: false,
    frequency: null,
    nearestMidi: null,
    cents: 0,
    noteName: '--',
    noteOnly: '--',
    volume: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const isListeningRef = useRef(false);

  // Smoothing buffers for stable readings
  const freqHistoryRef = useRef<number[]>([]);
  const centsHistoryRef = useRef<number[]>([]);

  const stopListening = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    isListeningRef.current = false;
    freqHistoryRef.current = [];
    centsHistoryRef.current = [];
    setState((s) => ({
      ...s,
      isListening: false,
      frequency: null,
      nearestMidi: null,
      cents: 0,
      noteName: '--',
      noteOnly: '--',
      volume: 0,
    }));
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
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
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // High-pass to remove rumble
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 50;
      highPass.Q.value = 0.7;
      source.connect(highPass);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096; // Good balance of resolution and speed for YIN
      analyser.smoothingTimeConstant = 0;
      highPass.connect(analyser);
      analyserRef.current = analyser;

      isListeningRef.current = true;
      setState((s) => ({ ...s, isListening: true, permissionDenied: false }));

      const timeBuffer = new Float32Array(analyser.fftSize);

      const detect = () => {
        if (!isListeningRef.current || !analyserRef.current) return;

        analyserRef.current.getFloatTimeDomainData(timeBuffer);

        // Calculate RMS volume
        let sumSq = 0;
        for (let i = 0; i < timeBuffer.length; i++) {
          sumSq += timeBuffer[i] * timeBuffer[i];
        }
        const rms = Math.sqrt(sumSq / timeBuffer.length);
        const vol = Math.min(1, rms * 10); // scale up for visibility

        // Only detect if there's enough signal
        if (rms < 0.008) {
          setState((s) => ({
            ...s,
            frequency: null,
            nearestMidi: null,
            cents: 0,
            noteName: '--',
            noteOnly: '--',
            volume: vol,
          }));
          freqHistoryRef.current = [];
          centsHistoryRef.current = [];
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        const freq = yinDetect(timeBuffer, ctx.sampleRate, 0.15);

        if (freq !== null) {
          // Smooth frequency readings
          const fHist = freqHistoryRef.current;
          fHist.push(freq);
          if (fHist.length > 5) fHist.shift();

          // Median filter for stability
          const sorted = [...fHist].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];

          const midi = freqToMidi(median);
          const nearestMidi = Math.round(midi);
          const rawCents = (midi - nearestMidi) * 100;

          // Smooth cents
          const cHist = centsHistoryRef.current;
          cHist.push(rawCents);
          if (cHist.length > 4) cHist.shift();
          const avgCents = cHist.reduce((a, b) => a + b, 0) / cHist.length;

          setState((s) => ({
            ...s,
            frequency: Math.round(median * 10) / 10,
            nearestMidi,
            cents: Math.round(avgCents * 10) / 10,
            noteName: midiToNoteName(nearestMidi),
            noteOnly: midiToNoteOnly(nearestMidi),
            volume: vol,
          }));
        } else {
          setState((s) => ({ ...s, volume: vol }));
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    } catch (e) {
      console.error('[FretMaster] Tuner mic access denied:', e);
      setState((s) => ({ ...s, permissionDenied: true }));
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
  };
}
