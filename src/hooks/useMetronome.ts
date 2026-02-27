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

/** Deep wood block — pitched noise burst with resonant bandpass */
function scheduleWoodBlock(ctx: AudioContext, time: number, isAccent: boolean) {
  // Noise buffer (~50ms)
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  // Resonant bandpass for hollow wood character — deep tuning
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = isAccent ? 380 : 300;
  bp.Q.value = 18;

  const noiseGain = ctx.createGain();
  const vol = isAccent ? 0.55 : 0.32;
  noiseGain.gain.setValueAtTime(vol, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

  noise.connect(bp);
  bp.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Pitched "knock" component — low sine for body
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = isAccent ? 420 : 340;

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.45, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Second harmonic for realism
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = isAccent ? 840 : 680;

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(vol * 0.15, time);
  osc2Gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

  osc2.connect(osc2Gain);
  osc2Gain.connect(ctx.destination);

  noise.start(time);
  noise.stop(time + 0.06);
  osc.start(time);
  osc.stop(time + 0.04);
  osc2.start(time);
  osc2.stop(time + 0.03);
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
