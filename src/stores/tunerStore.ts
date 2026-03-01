import { create } from 'zustand';

// ─── Constants ───────────────────────────────────────────

const NOTE_STRINGS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const GUITAR_STRINGS = [
  { num: 6, label: '6th String', note: 'Low E', freq: 82.41, noteName: 'E2' },
  { num: 5, label: '5th String', note: 'A', freq: 110.00, noteName: 'A2' },
  { num: 4, label: '4th String', note: 'D', freq: 146.83, noteName: 'D3' },
  { num: 3, label: '3rd String', note: 'G', freq: 196.00, noteName: 'G3' },
  { num: 2, label: '2nd String', note: 'B', freq: 246.94, noteName: 'B3' },
  { num: 1, label: '1st String', note: 'High E', freq: 329.63, noteName: 'E4' },
];

const IN_TUNE_THRESHOLD = 5; // cents

// ─── Audio globals ───────────────────────────────────────

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let rafId: number | null = null;
let dataBuffer: Float32Array | null = null;

// Reference tone
let refOsc: OscillatorNode | null = null;
let refGain: GainNode | null = null;
let refFilter: BiquadFilterNode | null = null;
let refTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Pitch detection ─────────────────────────────────────

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.006) return -1; // noise gate

  // Trim silence from edges
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const trimmed = buf.slice(r1, r2);
  const trimSize = trimmed.length;
  if (trimSize < 64) return -1;

  // Autocorrelation
  const c = new Float32Array(trimSize);
  for (let i = 0; i < trimSize; i++) {
    for (let j = 0; j < trimSize - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find first dip after lag 0
  let d = 0;
  while (d < trimSize - 1 && c[d] > c[d + 1]) d++;
  if (d >= trimSize - 1) return -1;

  // Find max correlation after first dip
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  if (maxpos < 1 || maxpos >= trimSize - 1) return -1;

  // Parabolic interpolation for sub-sample accuracy
  let T0 = maxpos;
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  // Sanity check: guitar range ~60Hz to ~1500Hz
  if (freq < 50 || freq > 1500) return -1;
  return freq;
}

function frequencyToNoteInfo(freq: number) {
  const semitonesFromA4 = 12 * Math.log2(freq / 440);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = (semitonesFromA4 - roundedSemitones) * 100;

  const noteIndex = ((roundedSemitones + 9) % 12 + 12) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);

  return {
    note: NOTE_STRINGS[noteIndex],
    octave,
    cents: Math.round(cents * 10) / 10,
  };
}

// ─── Store ───────────────────────────────────────────────

interface TunerState {
  isListening: boolean;
  detectedNote: string;
  detectedOctave: number;
  detectedFrequency: number;
  centsOff: number;
  isInTune: boolean;
  hasSignal: boolean;
  playingString: number | null;
  permissionDenied: boolean;

  startListening: () => Promise<void>;
  stopListening: () => void;
  playReferenceString: (stringNum: number) => void;
  stopReference: () => void;
}

function ensureAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Smoothing for displayed values
let smoothedCents = 0;
const SMOOTHING = 0.3; // lower = smoother

function detectPitch() {
  if (!analyser || !dataBuffer) return;

  analyser.getFloatTimeDomainData(dataBuffer);
  const freq = autoCorrelate(dataBuffer, analyser.context.sampleRate);

  if (freq === -1) {
    useTunerStore.setState({ hasSignal: false });
  } else {
    const info = frequencyToNoteInfo(freq);
    smoothedCents = smoothedCents * (1 - SMOOTHING) + info.cents * SMOOTHING;
    const displayCents = Math.round(smoothedCents * 10) / 10;
    const inTune = Math.abs(displayCents) <= IN_TUNE_THRESHOLD;

    useTunerStore.setState({
      detectedNote: info.note,
      detectedOctave: info.octave,
      detectedFrequency: Math.round(freq * 10) / 10,
      centsOff: displayCents,
      isInTune: inTune,
      hasSignal: true,
    });
  }

  rafId = requestAnimationFrame(detectPitch);
}

export const useTunerStore = create<TunerState>((set, get) => ({
  isListening: false,
  detectedNote: '-',
  detectedOctave: 0,
  detectedFrequency: 0,
  centsOff: 0,
  isInTune: false,
  hasSignal: false,
  playingString: null,
  permissionDenied: false,

  startListening: async () => {
    if (get().isListening) return;

    try {
      const ctx = ensureAudioCtx();
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      sourceNode = ctx.createMediaStreamSource(mediaStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      dataBuffer = new Float32Array(analyser.fftSize);
      sourceNode.connect(analyser);

      smoothedCents = 0;
      set({ isListening: true, permissionDenied: false, hasSignal: false });
      rafId = requestAnimationFrame(detectPitch);
    } catch (err) {
      console.log('Tuner mic error:', err);
      set({ permissionDenied: true });
    }
  },

  stopListening: () => {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    analyser = null;
    dataBuffer = null;

    set({
      isListening: false,
      hasSignal: false,
      detectedNote: '-',
      detectedOctave: 0,
      detectedFrequency: 0,
      centsOff: 0,
      isInTune: false,
    });
  },

  playReferenceString: (stringNum: number) => {
    // Stop any current reference
    get().stopReference();

    const stringInfo = GUITAR_STRINGS.find((s) => s.num === stringNum);
    if (!stringInfo) return;

    const ctx = ensureAudioCtx();
    const now = ctx.currentTime;

    // Create plucked-string-like tone
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(stringInfo.freq * 6, now);
    filter.frequency.exponentialRampToValueAtTime(stringInfo.freq * 2, now + 0.5);
    filter.Q.value = 1;

    // Use sawtooth for rich harmonics
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = stringInfo.freq;

    // Add a second oscillator slightly detuned for thickness
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = stringInfo.freq;

    const gain2 = ctx.createGain();
    gain2.gain.value = 0.3;

    // Envelope: quick pluck attack, medium sustain, gradual decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(filter);
    osc2.connect(gain2);
    gain2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.6);
    osc2.stop(now + 2.6);

    refOsc = osc;
    refGain = gain;
    refFilter = filter;

    set({ playingString: stringNum });

    refTimeout = setTimeout(() => {
      set({ playingString: null });
      refOsc = null;
      refGain = null;
      refFilter = null;
    }, 2600);
  },

  stopReference: () => {
    if (refTimeout) { clearTimeout(refTimeout); refTimeout = null; }
    if (refGain && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        refGain.gain.cancelScheduledValues(now);
        refGain.gain.setValueAtTime(refGain.gain.value, now);
        refGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      } catch {}
    }
    refOsc = null;
    refGain = null;
    refFilter = null;
    set({ playingString: null });
  },
}));
