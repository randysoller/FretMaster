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
 * Real wood blocks produce almost NO tonal ringing. The sound is:
 * - A sharp "tok/clack" dominated by broadband noise (the stick hitting wood)
 * - Very brief bandpass-filtered noise body (~1.5–4 kHz) that decays in <30ms
 * - Virtually zero sustained pitch — unlike bells which ring with sinusoids
 * - Total sound duration ~40–60ms
 *
 * This uses noise-based synthesis with aggressive bandpass filtering
 * and ultra-fast envelopes — NOT sinusoidal modes (which produce bell sounds).
 */
function generateWoodBlockBuffer(sampleRate: number, isAccent: boolean): AudioBuffer {
  const duration = 0.08; // very short — real wood blocks are ~40-60ms
  const length = Math.floor(sampleRate * duration);
  const buffer = new (window.OfflineAudioContext || window.AudioContext)(1, length, sampleRate).createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Seeded PRNG for consistent noise
  let noiseState = 48271;
  function rand() {
    noiseState = (noiseState * 16807) % 2147483647;
    return (noiseState / 2147483647) * 2 - 1;
  }

  // ─── Parameters tuned to real wood block recordings ───
  const centerFreq = isAccent ? 2400 : 2000;  // bandpass center (wood body resonance)
  const bandwidth = 1800;                      // wide — wood is noisy, not tonal
  const attackMs = 0.3;                        // stick contact (<1ms)
  const bodyDecayRate = isAccent ? 120 : 150;  // very fast exponential decay
  const clickDecayRate = 600;                  // transient click dies almost instantly

  // Two-pole bandpass filter state (resonant noise shaping)
  const Q = centerFreq / bandwidth;
  const omega = 2 * Math.PI * centerFreq / sampleRate;
  const alpha = Math.sin(omega) / (2 * Q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(omega);
  const a2 = 1 - alpha;
  // Normalize
  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0;
  const na1 = a1 / a0, na2 = a2 / a0;

  // Second bandpass at higher freq for the "click" layer
  const clickCenter = isAccent ? 4500 : 3800;
  const clickQ = 1.2;
  const cOmega = 2 * Math.PI * clickCenter / sampleRate;
  const cAlpha = Math.sin(cOmega) / (2 * clickQ);
  const cb0 = cAlpha / (1 + cAlpha);
  const cb2 = -cAlpha / (1 + cAlpha);
  const ca1 = -2 * Math.cos(cOmega) / (1 + cAlpha);
  const ca2 = (1 - cAlpha) / (1 + cAlpha);

  // Filter states
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;     // body bandpass
  let cx1 = 0, cx2 = 0, cy1 = 0, cy2 = 0;  // click bandpass

  const attackSamples = attackMs * 0.001 * sampleRate;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const noise = rand();

    // ── Body layer: bandpass-filtered noise with fast decay ──
    // Attack envelope: ramps up in <0.3ms then decays exponentially
    let bodyEnv: number;
    if (i < attackSamples) {
      bodyEnv = i / attackSamples; // linear ramp up
    } else {
      bodyEnv = Math.exp(-bodyDecayRate * (t - attackMs * 0.001));
    }

    // Apply bandpass filter to noise
    const bodyIn = noise * bodyEnv;
    const bodyOut = nb0 * bodyIn + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1; x1 = bodyIn;
    y2 = y1; y1 = bodyOut;

    // ── Click layer: higher-freq transient for the stick "tick" ──
    const clickEnv = t < 0.002 ? Math.exp(-clickDecayRate * t) : 0;
    const clickIn = noise * clickEnv * 1.5;
    const clickOut = cb0 * clickIn + 0 * cx1 + cb2 * cx2 - ca1 * cy1 - ca2 * cy2;
    cx2 = cx1; cx1 = clickIn;
    cy2 = cy1; cy1 = clickOut;

    // ── Raw transient impulse (first ~0.5ms) ──
    // Adds the percussive "snap" of stick-on-wood contact
    const impulseEnv = t < 0.0005 ? (1.0 - t / 0.0005) : 0;
    const impulse = noise * impulseEnv * 0.8;

    // Mix layers
    const vol = isAccent ? 0.65 : 0.42;
    data[i] = (bodyOut * 0.7 + clickOut * 0.5 + impulse) * vol;
  }

  // Normalize to prevent clipping
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0.92) {
    const scale = 0.88 / peak;
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

/** Deep hi-hat — filtered noise with lower cutoff than typical hi-hat */
function scheduleHiHat(ctx: AudioContext, time: number, isAccent: boolean) {
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  // High-pass but at a lower frequency for "deeper" hi-hat character
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = isAccent ? 3200 : 2800;
  hp.Q.value = 0.8;

  // Gentle bandpass to shape the body
  const bp = ctx.createBiquadFilter();
  bp.type = 'peaking';
  bp.frequency.value = 5000;
  bp.Q.value = 1.5;
  bp.gain.value = 3;

  const gain = ctx.createGain();
  const vol = isAccent ? 0.38 : 0.2;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.1 : 0.07));

  noise.connect(hp);
  hp.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);

  // Metallic sine component for shimmer
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = isAccent ? 6200 : 5800;

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.08, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(time);
  noise.stop(time + 0.12);
  osc.start(time);
  osc.stop(time + 0.05);
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
