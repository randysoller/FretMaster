import { create } from 'zustand';

// ─── Constants ───────────────────────────────────────────

const NOTE_STRINGS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const GUITAR_STRINGS = [
  { num: 4, label: '4th String D', freq: 146.83 },
  { num: 3, label: '3rd String G', freq: 196.00 },
  { num: 5, label: '5th String A', freq: 110.00 },
  { num: 2, label: '2nd String B', freq: 246.94 },
  { num: 6, label: '6th String Low E', freq: 82.41 },
  { num: 1, label: '1st String High E', freq: 329.63 },
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
let refSource: AudioBufferSourceNode | null = null;
let refGain: GainNode | null = null;
let refTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Pitch detection ─────────────────────────────────────

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.002) return -1; // noise gate — lowered for tuner sensitivity

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
      analyser.fftSize = 8192;
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
    const sampleRate = ctx.sampleRate;
    const duration = 3.5;
    const numSamples = Math.floor(sampleRate * duration);

    // Karplus-Strong plucked string synthesis
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    const period = Math.round(sampleRate / stringInfo.freq);

    // Initialize delay line with shaped noise burst
    for (let i = 0; i < period; i++) {
      // Mix of white noise shaped with a slight body resonance
      data[i] = (Math.random() * 2 - 1) * 0.85;
    }

    // Apply short low-pass filter to initial burst for warmth
    for (let i = 1; i < period; i++) {
      data[i] = 0.6 * data[i] + 0.4 * data[i - 1];
    }

    // Karplus-Strong with tuned decay and damping
    const decay = stringInfo.freq < 120 ? 0.9985 : stringInfo.freq < 200 ? 0.9978 : 0.997;
    const blend = 0.497; // slightly off 0.5 for tonal color
    for (let i = period; i < numSamples; i++) {
      data[i] = decay * (blend * data[i - period] + (1 - blend) * data[i - period + 1]);
    }

    // Gentle fade out in last 25%
    const fadeStart = Math.floor(numSamples * 0.75);
    for (let i = fadeStart; i < numSamples; i++) {
      const t = (i - fadeStart) / (numSamples - fadeStart);
      data[i] *= Math.cos(t * Math.PI * 0.5); // cosine fade
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = 0.6;

    // Body resonance filter
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.frequency.value = stringInfo.freq * 2;
    bodyFilter.Q.value = 2;
    bodyFilter.gain.value = 3;

    source.connect(bodyFilter);
    bodyFilter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    refSource = source;
    refGain = gain;
    set({ playingString: stringNum });

    source.onended = () => {
      if (get().playingString === stringNum) {
        set({ playingString: null });
      }
      refSource = null;
      refGain = null;
    };

    refTimeout = setTimeout(() => {
      set({ playingString: null });
      refSource = null;
      refGain = null;
    }, duration * 1000 + 100);
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
    if (refSource) {
      try { refSource.stop(); } catch {}
      refSource = null;
    }
    refGain = null;
    set({ playingString: null });
  },
}));
