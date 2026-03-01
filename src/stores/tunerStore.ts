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
    const duration = 4.0;
    const numSamples = Math.floor(sampleRate * duration);

    // Stereo buffer with slight detuning for natural chorus
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const detuneCents = 3;
    const freqL = stringInfo.freq * Math.pow(2, -detuneCents / 1200);
    const freqR = stringInfo.freq * Math.pow(2, detuneCents / 1200);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      const freq = ch === 0 ? freqL : freqR;
      const period = Math.round(sampleRate / freq);

      // Shaped noise burst: mix noise with sinusoidal pluck shape
      for (let i = 0; i < period; i++) {
        const pos = i / period;
        const noise = Math.random() * 2 - 1;
        const pluckShape = Math.sin(Math.PI * pos);
        data[i] = (noise * 0.65 + pluckShape * 0.35) * 0.9;
      }

      // Two-pass smoothing for warmer initial burst
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < period; i++) {
          data[i] = 0.55 * data[i] + 0.45 * data[i - 1];
        }
      }

      // Karplus-Strong with allpass dispersion for string stiffness
      const isLow = stringInfo.freq < 150;
      const isMid = stringInfo.freq >= 150 && stringInfo.freq < 250;
      const decay = isLow ? 0.9988 : isMid ? 0.998 : 0.9972;
      const blend = 0.498;
      const dispersion = isLow ? 0.2 : 0.1;

      let prevAllpass = 0;
      for (let i = period; i < numSamples; i++) {
        const avg = blend * data[i - period] + (1 - blend) * data[i - period + 1];
        const allpassed = dispersion * avg + data[i - period] - dispersion * prevAllpass;
        prevAllpass = allpassed;
        data[i] = decay * allpassed;
      }

      // Attack bloom (0–20ms fade-in)
      const bloomEnd = Math.floor(sampleRate * 0.02);
      for (let i = 0; i < Math.min(bloomEnd, numSamples); i++) {
        data[i] *= i / bloomEnd;
      }

      // Cosine fade-out in last 30%
      const fadeStart = Math.floor(numSamples * 0.7);
      for (let i = fadeStart; i < numSamples; i++) {
        const t = (i - fadeStart) / (numSamples - fadeStart);
        data[i] *= Math.cos(t * Math.PI * 0.5);
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // EQ chain for realistic guitar tone
    const gain = ctx.createGain();
    gain.gain.value = 0.55;

    // Body resonance — low warmth
    const bodyLow = ctx.createBiquadFilter();
    bodyLow.type = 'peaking';
    bodyLow.frequency.value = 200;
    bodyLow.Q.value = 1.5;
    bodyLow.gain.value = 4;

    // Body resonance — mid character
    const bodyMid = ctx.createBiquadFilter();
    bodyMid.type = 'peaking';
    bodyMid.frequency.value = stringInfo.freq * 1.5;
    bodyMid.Q.value = 2;
    bodyMid.gain.value = 2.5;

    // Presence definition
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = stringInfo.freq < 150 ? 800 : 1200;
    presence.Q.value = 1;
    presence.gain.value = 2;

    // High-frequency rolloff for warmth
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = stringInfo.freq < 150 ? 2000 : stringInfo.freq < 250 ? 2800 : 3500;
    lowpass.Q.value = 0.7;

    // High shelf cut to tame harshness
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 4000;
    highShelf.gain.value = -4;

    // Chain: source → bodyLow → bodyMid → presence → lowpass → highShelf → gain → out
    source.connect(bodyLow);
    bodyLow.connect(bodyMid);
    bodyMid.connect(presence);
    presence.connect(lowpass);
    lowpass.connect(highShelf);
    highShelf.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    refSource = source;
    refGain = gain;
    set({ playingString: stringNum });

    source.onended = () => {
      if (get().playingString === stringNum) set({ playingString: null });
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
