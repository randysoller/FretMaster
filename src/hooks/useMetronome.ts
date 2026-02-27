import { useState, useRef, useCallback, useEffect } from 'react';

const BPM_KEY = 'fretmaster-metronome-bpm';
const BEATS_KEY = 'fretmaster-metronome-beats';
const SOUND_KEY = 'fretmaster-metronome-sound';

export type MetronomeSoundType = 'click' | 'woodblock' | 'voice' | 'hihat';

export const SOUND_LABELS: Record<MetronomeSoundType, string> = {
  click: 'Click',
  woodblock: 'Wood Block',
  voice: 'Voice Count',
  hihat: 'Hi-Hat',
};

function getStoredBpm(): number {
  try {
    const v = localStorage.getItem(BPM_KEY);
    if (v) {
      const n = Number(v);
      if (n >= 30 && n <= 260) return n;
    }
  } catch {}
  return 100;
}

function getStoredBeats(): number {
  try {
    const v = localStorage.getItem(BEATS_KEY);
    if (v) {
      const n = Number(v);
      if ([2, 3, 4, 6].includes(n)) return n;
    }
  } catch {}
  return 4;
}

function getStoredSound(): MetronomeSoundType {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v && ['click', 'woodblock', 'voice', 'hihat'].includes(v)) return v as MetronomeSoundType;
  } catch {}
  return 'click';
}

export interface MetronomeState {
  isPlaying: boolean;
  bpm: number;
  beatsPerMeasure: number;
  currentBeat: number;
  soundType: MetronomeSoundType;
  setBpm: (bpm: number) => void;
  setBeatsPerMeasure: (beats: number) => void;
  setSoundType: (sound: MetronomeSoundType) => void;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

// ─── Sound Synthesis Functions ───────────────────────────

/** Original sine-wave click */
function scheduleClick(ctx: AudioContext, time: number, isAccent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = isAccent ? 1200 : 800;
  osc.type = 'sine';

  const vol = isAccent ? 0.45 : 0.25;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  osc.start(time);
  osc.stop(time + 0.05);
}

// ─── Wood Block Sample Buffer ────────────────────────────

/**
 * Pre-render a realistic wood block hit as an AudioBuffer.
 *
 * Modeled after orchestral wood block recordings:
 * - Hard transient "tok" from stick impact (sub-ms broadband impulse)
 * - 3 resonant noise bands at wood-body frequencies, each with independent fast decay
 * - Subtle low-mid "thump" from the hollow cavity
 * - Total sound ≈50ms, no perceptible pitch or ringing
 */
function generateWoodBlockBuffer(sampleRate: number, isAccent: boolean): AudioBuffer {
  const duration = 0.065;
  const length = Math.floor(sampleRate * duration);
  const buffer = new (window.OfflineAudioContext || window.AudioContext)(1, length, sampleRate).createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let noiseState = 48271;
  function rand() {
    noiseState = (noiseState * 16807) % 2147483647;
    return (noiseState / 2147483647) * 2 - 1;
  }

  // ─── Biquad bandpass helper (stateful) ───
  function makeBP(freq: number, q: number) {
    const w = 2 * Math.PI * freq / sampleRate;
    const a = Math.sin(w) / (2 * q);
    const cosW = Math.cos(w);
    const a0 = 1 + a;
    return {
      b0: a / a0, b2: -a / a0,
      a1: -2 * cosW / a0, a2: (1 - a) / a0,
      x1: 0, x2: 0, y1: 0, y2: 0,
      process(x: number): number {
        const y = this.b0 * x + 0 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x;
        this.y2 = this.y1; this.y1 = y;
        return y;
      },
    };
  }

  // Three resonant body bands — spread across wood-block spectrum
  const bodyLo = makeBP(isAccent ? 1100 : 900, 1.8);   // hollow cavity
  const bodyMid = makeBP(isAccent ? 2200 : 1900, 2.2);  // primary "tok"
  const bodyHi = makeBP(isAccent ? 3800 : 3400, 1.5);   // stick brightness

  // Stick click — very high frequency, ultra-short
  const clickBP = makeBP(isAccent ? 5500 : 4800, 1.0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const n = rand();

    // ── Envelope: 0.15ms attack, then multi-rate decay ──
    const attackEnd = 0.00015;
    const att = t < attackEnd ? t / attackEnd : 1.0;

    // Body layers — each with progressively faster decay
    const loEnv = att * Math.exp(-90 * Math.max(0, t - attackEnd));
    const midEnv = att * Math.exp(-140 * Math.max(0, t - attackEnd));
    const hiEnv = att * Math.exp(-200 * Math.max(0, t - attackEnd));

    const lo = bodyLo.process(n * loEnv) * 0.5;
    const mid = bodyMid.process(n * midEnv) * 1.0;
    const hi = bodyHi.process(n * hiEnv) * 0.6;

    // ── Stick transient — first 1.5ms only ──
    const clickEnv = t < 0.0015 ? Math.exp(-800 * t) : 0;
    const click = clickBP.process(n * clickEnv) * 1.2;

    // ── Sub-ms impulse snap ──
    const snapEnv = t < 0.0003 ? (1.0 - t / 0.0003) : 0;
    const snap = n * snapEnv * 0.6;

    // ── Cavity thump — very brief low-mid content ──
    const thumpFreq = isAccent ? 600 : 480;
    const thumpEnv = t < 0.008 ? Math.exp(-250 * t) : 0;
    const thump = Math.sin(2 * Math.PI * thumpFreq * t) * thumpEnv * 0.15;

    const vol = isAccent ? 0.72 : 0.48;
    data[i] = (lo + mid + hi + click + snap + thump) * vol;
  }

  // Soft-clip + normalize
  for (let i = 0; i < length; i++) {
    data[i] = Math.tanh(data[i] * 1.4);
  }
  let peak = 0;
  for (let i = 0; i < length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak > 0.01) {
    const target = isAccent ? 0.85 : 0.65;
    const scale = target / peak;
    for (let i = 0; i < length; i++) data[i] *= scale;
  }

  return buffer;
}

let woodBlockBufferAccent: AudioBuffer | null = null;
let woodBlockBufferNormal: AudioBuffer | null = null;
let woodBlockSampleRate = 0;

function getWoodBlockBuffer(sampleRate: number, isAccent: boolean): AudioBuffer {
  // Regenerate if sample rate changed (e.g., different AudioContext)
  if (woodBlockSampleRate !== sampleRate) {
    woodBlockBufferAccent = null;
    woodBlockBufferNormal = null;
    woodBlockSampleRate = sampleRate;
  }
  if (isAccent) {
    if (!woodBlockBufferAccent) woodBlockBufferAccent = generateWoodBlockBuffer(sampleRate, true);
    return woodBlockBufferAccent;
  } else {
    if (!woodBlockBufferNormal) woodBlockBufferNormal = generateWoodBlockBuffer(sampleRate, false);
    return woodBlockBufferNormal;
  }
}

/** Play a pre-rendered wood block sample */
function scheduleWoodBlock(ctx: AudioContext, time: number, isAccent: boolean) {
  const buf = getWoodBlockBuffer(ctx.sampleRate, isAccent);
  const source = ctx.createBufferSource();
  source.buffer = buf;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.75, time);
  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(time);
}

// ─── Hi-Hat Sample Buffer ────────────────────────────────

/**
 * Pre-render a realistic closed hi-hat as an AudioBuffer.
 *
 * Real hi-hats are two bronze discs producing inharmonic metallic overtones.
 * Key characteristics:
 * - Metallic "chick" from inharmonic frequency ratios (not integer harmonics)
 * - Broadband noise component for the "wash"
 * - Sharp attack, controlled exponential decay (~60-120ms)
 * - Accent hits are slightly more open (longer decay, brighter)
 */
function generateHiHatBuffer(sampleRate: number, isAccent: boolean): AudioBuffer {
  const duration = isAccent ? 0.14 : 0.09;
  const length = Math.floor(sampleRate * duration);
  const buffer = new (window.OfflineAudioContext || window.AudioContext)(1, length, sampleRate).createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let noiseState = 31337;
  function rand() {
    noiseState = (noiseState * 16807) % 2147483647;
    return (noiseState / 2147483647) * 2 - 1;
  }

  // Inharmonic metallic partials — ratios from real cymbal analysis
  // These are NOT integer multiples, which gives cymbals their characteristic shimmer
  const partials = [
    { freq: isAccent ? 3150 : 2900, amp: 0.35, decay: isAccent ? 55 : 70 },
    { freq: isAccent ? 4230 : 3950, amp: 0.30, decay: isAccent ? 65 : 85 },
    { freq: isAccent ? 5710 : 5400, amp: 0.22, decay: isAccent ? 80 : 100 },
    { freq: isAccent ? 7340 : 6800, amp: 0.15, decay: isAccent ? 95 : 120 },
    { freq: isAccent ? 9870 : 9200, amp: 0.10, decay: isAccent ? 110 : 140 },
    { freq: isAccent ? 12600 : 11800, amp: 0.06, decay: isAccent ? 130 : 160 },
  ];

  // Biquad highpass for noise component
  function makeHP(freq: number, q: number) {
    const w = 2 * Math.PI * freq / sampleRate;
    const cosW = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    const a0 = 1 + a;
    return {
      b0: ((1 + cosW) / 2) / a0,
      b1: (-(1 + cosW)) / a0,
      b2: ((1 + cosW) / 2) / a0,
      a1: (-2 * cosW) / a0,
      a2: (1 - a) / a0,
      x1: 0, x2: 0, y1: 0, y2: 0,
      process(x: number): number {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = x;
        this.y2 = this.y1; this.y1 = y;
        return y;
      },
    };
  }

  const noiseHP = makeHP(isAccent ? 5500 : 6500, 0.7);

  // Phase accumulators for partials
  const phases = partials.map(() => 0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const n = rand();

    // ── Metallic partials with inharmonic frequencies ──
    let metallic = 0;
    for (let p = 0; p < partials.length; p++) {
      const { freq, amp, decay } = partials[p];
      phases[p] += 2 * Math.PI * freq / sampleRate;
      if (phases[p] > 2 * Math.PI) phases[p] -= 2 * Math.PI;

      // Use mix of sine and slightly clipped sine for metallic edge
      const raw = Math.sin(phases[p]);
      const clipped = Math.tanh(raw * 1.8);
      const mix = raw * 0.6 + clipped * 0.4;

      const env = Math.exp(-decay * t);
      metallic += mix * amp * env;
    }

    // ── Filtered noise "wash" component ──
    const noiseEnv = Math.exp(-(isAccent ? 40 : 60) * t);
    const filteredNoise = noiseHP.process(n * noiseEnv);

    // ── Stick transient — very brief broadband click ──
    const stickEnv = t < 0.001 ? Math.exp(-1200 * t) : 0;
    const stick = n * stickEnv * 0.5;

    // Mix: metallic dominates for realistic cymbal character
    const vol = isAccent ? 0.55 : 0.35;
    data[i] = (metallic * 0.55 + filteredNoise * 0.35 + stick) * vol;
  }

  // Soft-clip + normalize
  for (let i = 0; i < length; i++) {
    data[i] = Math.tanh(data[i] * 1.6);
  }
  let peak = 0;
  for (let i = 0; i < length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak > 0.01) {
    const target = isAccent ? 0.7 : 0.5;
    const scale = target / peak;
    for (let i = 0; i < length; i++) data[i] *= scale;
  }

  return buffer;
}

let hiHatBufferAccent: AudioBuffer | null = null;
let hiHatBufferNormal: AudioBuffer | null = null;
let hiHatSampleRate = 0;

function getHiHatBuffer(sampleRate: number, isAccent: boolean): AudioBuffer {
  if (hiHatSampleRate !== sampleRate) {
    hiHatBufferAccent = null;
    hiHatBufferNormal = null;
    hiHatSampleRate = sampleRate;
  }
  if (isAccent) {
    if (!hiHatBufferAccent) hiHatBufferAccent = generateHiHatBuffer(sampleRate, true);
    return hiHatBufferAccent;
  } else {
    if (!hiHatBufferNormal) hiHatBufferNormal = generateHiHatBuffer(sampleRate, false);
    return hiHatBufferNormal;
  }
}

/** Play a pre-rendered hi-hat sample */
function scheduleHiHat(ctx: AudioContext, time: number, isAccent: boolean) {
  const buf = getHiHatBuffer(ctx.sampleRate, isAccent);
  const source = ctx.createBufferSource();
  source.buffer = buf;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.8, time);
  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(time);
}

/**
 * Voice count — uses SpeechSynthesis API to speak beat numbers aloud.
 * Falls back to a tonal "blip" if speech synthesis is unavailable.
 */
function scheduleVoice(
  ctx: AudioContext,
  time: number,
  isAccent: boolean,
  beatNumber: number,
  voiceRef: React.MutableRefObject<SpeechSynthesisVoice | null>,
) {
  const delay = Math.max(0, (time - ctx.currentTime) * 1000);

  // Also play a very subtle reference tick so there's always audio feedback
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = isAccent ? 600 : 500;
  osc.type = 'sine';
  gain.gain.setValueAtTime(isAccent ? 0.06 : 0.03, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
  osc.start(time);
  osc.stop(time + 0.03);

  // Schedule speech
  if (typeof speechSynthesis !== 'undefined') {
    setTimeout(() => {
      // Cancel any still-pending utterance to prevent overlap at fast tempos
      speechSynthesis.cancel();

      const num = beatNumber + 1; // 1-indexed for humans
      const utterance = new SpeechSynthesisUtterance(String(num));
      utterance.rate = 1.6;
      utterance.pitch = 0.75; // lower pitch for calm male voice
      utterance.volume = isAccent ? 1.0 : 0.75;

      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }

      speechSynthesis.speak(utterance);
    }, delay);
  }
}

// ─── Voice Selection Helper ──────────────────────────────

function selectMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;

  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Preferred voice names (deeper / male)
  const preferred = [
    'google us english', 'daniel', 'james', 'david', 'alex',
    'tom', 'male', 'en-us', 'en-gb',
  ];

  for (const keyword of preferred) {
    const match = voices.find(
      (v) => v.name.toLowerCase().includes(keyword) && v.lang.startsWith('en')
    );
    if (match) return match;
  }

  // Fallback: any English voice
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

// ─── Hook ────────────────────────────────────────────────

export function useMetronome(): MetronomeState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(getStoredBpm);
  const [beatsPerMeasure, setBeatsState] = useState(getStoredBeats);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [soundType, setSoundTypeState] = useState<MetronomeSoundType>(getStoredSound);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number>(0);
  const beatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerMeasure);
  const soundTypeRef = useRef(soundType);
  const isPlayingRef = useRef(false);
  const nextNoteTimeRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Keep refs synced
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);

  // Load speech synthesis voices (they can load asynchronously)
  useEffect(() => {
    const loadVoices = () => {
      voiceRef.current = selectMaleVoice();
    };
    loadVoices();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
  }, []);

  const setBpm = useCallback((v: number) => {
    const clamped = Math.max(30, Math.min(260, v));
    setBpmState(clamped);
    try { localStorage.setItem(BPM_KEY, String(clamped)); } catch {}
  }, []);

  const setBeatsPerMeasure = useCallback((v: number) => {
    setBeatsState(v);
    try { localStorage.setItem(BEATS_KEY, String(v)); } catch {}
  }, []);

  const setSoundType = useCallback((v: MetronomeSoundType) => {
    setSoundTypeState(v);
    soundTypeRef.current = v;
    try { localStorage.setItem(SOUND_KEY, v); } catch {}
  }, []);

  /** Schedule a single beat sound */
  const scheduleBeat = useCallback((ctx: AudioContext, time: number, isAccent: boolean, beat: number) => {
    switch (soundTypeRef.current) {
      case 'woodblock':
        scheduleWoodBlock(ctx, time, isAccent);
        break;
      case 'hihat':
        scheduleHiHat(ctx, time, isAccent);
        break;
      case 'voice':
        scheduleVoice(ctx, time, isAccent, beat, voiceRef);
        break;
      case 'click':
      default:
        scheduleClick(ctx, time, isAccent);
        break;
    }
  }, []);

  const schedulerLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isPlayingRef.current) return;

    const lookahead = 0.1;
    while (nextNoteTimeRef.current < ctx.currentTime + lookahead) {
      const isAccent = beatRef.current === 0;
      scheduleBeat(ctx, nextNoteTimeRef.current, isAccent, beatRef.current);

      const beatSnap = beatRef.current;
      setTimeout(() => {
        setCurrentBeat(beatSnap);
      }, Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));

      const secondsPerBeat = 60 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat;
      beatRef.current = (beatRef.current + 1) % beatsRef.current;
    }
  }, [scheduleBeat]);

  const start = useCallback(() => {
    if (isPlayingRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setCurrentBeat(0);

    timerRef.current = window.setInterval(schedulerLoop, 25);
  }, [schedulerLoop]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentBeat(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    // Cancel any pending voice utterances
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) stop();
    else start();
  }, [start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return {
    isPlaying,
    bpm,
    beatsPerMeasure,
    currentBeat,
    soundType,
    setBpm,
    setBeatsPerMeasure,
    setSoundType,
    toggle,
    start,
    stop,
  };
}
