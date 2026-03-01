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
    const sr = ctx.sampleRate;
    const duration = 3.5;
    const numSamples = Math.floor(sr * duration);
    const freq = stringInfo.freq;
    const period = sr / freq;
    const periodInt = Math.floor(period);
    const periodFrac = period - periodInt;

    // Mono Karplus-Strong with realistic acoustic guitar modelling
    const buffer = ctx.createBuffer(1, numSamples, sr);
    const data = buffer.getChannelData(0);

    // --- Excitation: noise burst shaped by pick position comb filter ---
    const pickPos = 0.12; // Near bridge for natural brightness
    const burstLen = periodInt * 2;
    const excitation = new Float32Array(burstLen);

    for (let i = 0; i < burstLen; i++) {
      excitation[i] = Math.random() * 2 - 1;
    }

    // Pick position comb filter — notches at harmonics of 1/pickPos
    const pickDelay = Math.max(1, Math.round(periodInt * pickPos));
    for (let i = pickDelay; i < burstLen; i++) {
      excitation[i] = excitation[i] - 0.9 * excitation[i - pickDelay];
    }

    // Light lowpass on excitation for realism
    for (let i = 1; i < burstLen; i++) {
      excitation[i] = 0.6 * excitation[i] + 0.4 * excitation[i - 1];
    }

    // Half-sine envelope on burst
    for (let i = 0; i < burstLen; i++) {
      excitation[i] *= Math.sin(Math.PI * i / burstLen) * 0.85;
    }

    for (let i = 0; i < burstLen && i < numSamples; i++) {
      data[i] = excitation[i];
    }

    // --- Karplus-Strong loop with one-pole lowpass and fractional delay ---
    const isLow = freq < 130;
    const isMid = freq >= 130 && freq < 250;

    // Lowpass coefficient: controls how fast brightness decays
    // Higher = brighter longer
    const lpCoeff = isLow ? 0.38 : isMid ? 0.44 : 0.50;

    // String decay
    const decayFactor = isLow ? 0.9994 : isMid ? 0.9988 : 0.9980;

    // Allpass coefficient for fractional delay tuning
    const C = (1 - periodFrac) / (1 + periodFrac);

    let prevLp = 0;
    let prevAllpass = 0;
    const loopStart = Math.max(periodInt + 1, burstLen);

    for (let i = loopStart; i < numSamples; i++) {
      const d0 = data[i - periodInt];
      const d1 = i - periodInt + 1 < numSamples ? data[i - periodInt + 1] : 0;

      // Allpass interpolation for fractional delay
      const ap = C * (d0 - prevAllpass) + d1;
      prevAllpass = ap;

      // One-pole lowpass in the feedback loop
      const lp = (1 - lpCoeff) * ap + lpCoeff * prevLp;
      prevLp = lp;

      data[i] += lp * decayFactor;
    }

    // --- Envelope: gentle attack, natural decay tail ---
    const attackSamples = Math.floor(sr * 0.0015);
    for (let i = 0; i < attackSamples && i < numSamples; i++) {
      data[i] *= i / attackSamples;
    }

    const fadeStart = Math.floor(numSamples * 0.82);
    for (let i = fadeStart; i < numSamples; i++) {
      const t = (i - fadeStart) / (numSamples - fadeStart);
      data[i] *= Math.cos(t * Math.PI * 0.5);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // --- Acoustic guitar body resonance filter bank ---
    const gain = ctx.createGain();
    gain.gain.value = 0.65;

    // Air resonance (~98 Hz — sound hole)
    const bodyAir = ctx.createBiquadFilter();
    bodyAir.type = 'peaking';
    bodyAir.frequency.value = 98;
    bodyAir.Q.value = 4;
    bodyAir.gain.value = 5;

    // Top plate resonance (~200 Hz — warmth)
    const bodyTop = ctx.createBiquadFilter();
    bodyTop.type = 'peaking';
    bodyTop.frequency.value = 200;
    bodyTop.Q.value = 2.5;
    bodyTop.gain.value = 4;

    // Back plate / mid body (~400 Hz)
    const bodyBack = ctx.createBiquadFilter();
    bodyBack.type = 'peaking';
    bodyBack.frequency.value = 400;
    bodyBack.Q.value = 2;
    bodyBack.gain.value = 2;

    // String presence (~1.2–2 kHz)
    const presenceEq = ctx.createBiquadFilter();
    presenceEq.type = 'peaking';
    presenceEq.frequency.value = isLow ? 1200 : isMid ? 1600 : 2000;
    presenceEq.Q.value = 1.2;
    presenceEq.gain.value = 1.5;

    // High cut — acoustic guitars naturally roll off
    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = isLow ? 3000 : isMid ? 4000 : 5000;
    highCut.Q.value = 0.5;

    // Tame harsh overtones
    const hShelf = ctx.createBiquadFilter();
    hShelf.type = 'highshelf';
    hShelf.frequency.value = 5000;
    hShelf.gain.value = -5;

    // Low cut to remove sub rumble
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = isLow ? 55 : 70;
    lowCut.Q.value = 0.7;

    // Chain: source → lowCut → bodyAir → bodyTop → bodyBack → presenceEq → highCut → hShelf → gain → out
    source.connect(lowCut);
    lowCut.connect(bodyAir);
    bodyAir.connect(bodyTop);
    bodyTop.connect(bodyBack);
    bodyBack.connect(presenceEq);
    presenceEq.connect(highCut);
    highCut.connect(hShelf);
    hShelf.connect(gain);
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
