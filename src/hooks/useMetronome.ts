import { useState, useRef, useCallback, useEffect } from 'react';

const BPM_KEY = 'fretmaster-metronome-bpm';
const BEATS_KEY = 'fretmaster-metronome-beats';
const SOUND_KEY = 'fretmaster-metronome-sound';

export type MetronomeSoundType = 'click' | 'woodblock' | 'hihat' | 'rimclick';

export const SOUND_LABELS: Record<MetronomeSoundType, string> = {
  click: 'Click',
  woodblock: 'Wood Block',
  hihat: 'Hi-Hat',
  rimclick: 'Rim Click',
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
      if ([2, 3, 4, 6, 12].includes(n)) return n;
    }
  } catch {}
  return 4;
}

function getStoredSound(): MetronomeSoundType {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v && ['click', 'woodblock', 'hihat', 'rimclick'].includes(v)) return v as MetronomeSoundType;
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

/**
 * Improved click — layered transient with body.
 * Punchy "tick" with a sharp attack impulse + tuned sine body + subtle noise snap.
 */
function scheduleClick(ctx: AudioContext, time: number, isAccent: boolean) {
  // Layer 1: Primary tone — short sine ping
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.connect(g1);
  g1.connect(ctx.destination);
  osc1.frequency.value = isAccent ? 1500 : 1000;
  osc1.type = 'sine';
  const vol1 = isAccent ? 0.4 : 0.22;
  g1.gain.setValueAtTime(vol1, time);
  g1.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  osc1.start(time);
  osc1.stop(time + 0.035);

  // Layer 2: High harmonic for "snap" presence
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.frequency.value = isAccent ? 3200 : 2400;
  osc2.type = 'triangle';
  const vol2 = isAccent ? 0.18 : 0.1;
  g2.gain.setValueAtTime(vol2, time);
  g2.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
  osc2.start(time);
  osc2.stop(time + 0.02);

  // Layer 3: Noise burst for stick attack texture
  const bufSize = Math.floor(ctx.sampleRate * 0.008);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  let ns = 12345;
  for (let i = 0; i < bufSize; i++) {
    ns = (ns * 16807) % 2147483647;
    const env = Math.exp(-600 * (i / ctx.sampleRate));
    noiseData[i] = ((ns / 2147483647) * 2 - 1) * env;
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(isAccent ? 0.15 : 0.08, time);
  noiseSrc.connect(gn);
  gn.connect(ctx.destination);
  noiseSrc.start(time);
}

// ─── Wood Block Real Sample Loader ───────────────────────

/**
 * Load real wood block samples from AVL Drum Kit Percussions (CC-BY-SA).
 * Uses two different velocity samples for accent vs regular hits.
 * Falls back to basic synthesis if fetch fails.
 */

const WOODBLOCK_URLS = {
  // Real wood block recordings from AVL Drumkits Percussion by Glen MacArthur
  normal: 'https://raw.githubusercontent.com/studiorack/avl-percussions/main/Samples/37-Woodblock-1.flac',
  accent: 'https://raw.githubusercontent.com/studiorack/avl-percussions/main/Samples/37-Woodblock-5.flac',
};

let woodBlockSampleNormal: AudioBuffer | null = null;
let woodBlockSampleAccent: AudioBuffer | null = null;
let woodBlockLoadState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let woodBlockLoadPromise: Promise<void> | null = null;

function loadWoodBlockSamples(ctx: AudioContext): Promise<void> {
  if (woodBlockLoadState === 'loaded') return Promise.resolve();
  if (woodBlockLoadPromise) return woodBlockLoadPromise;

  woodBlockLoadState = 'loading';
  woodBlockLoadPromise = Promise.all([
    fetchAudioBuffer(WOODBLOCK_URLS.normal, ctx),
    fetchAudioBuffer(WOODBLOCK_URLS.accent, ctx),
  ])
    .then(([normal, accent]) => {
      woodBlockSampleNormal = normal;
      woodBlockSampleAccent = accent;
      woodBlockLoadState = 'loaded';
      console.log('[Metronome] Wood block samples loaded successfully');
    })
    .catch((err) => {
      console.warn('[Metronome] Failed to load wood block samples, falling back to synthesis:', err);
      woodBlockLoadState = 'failed';
      woodBlockLoadPromise = null;
    });

  return woodBlockLoadPromise;
}

/** Fallback synthesis for wood block when samples fail to load */
function scheduleWoodBlockFallback(ctx: AudioContext, time: number, isAccent: boolean) {
  const dur = isAccent ? 0.06 : 0.04;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let ns = 48271;
  for (let i = 0; i < bufSize; i++) {
    ns = (ns * 16807) % 2147483647;
    const t = i / ctx.sampleRate;
    data[i] = ((ns / 2147483647) * 2 - 1) * Math.exp(-120 * t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000;
  bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(isAccent ? 0.6 : 0.4, time);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(time);
}

/** Play a real wood block sample, or fallback if not loaded */
function scheduleWoodBlock(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? woodBlockSampleAccent : woodBlockSampleNormal;
  if (!sample) {
    if (woodBlockLoadState !== 'loading') loadWoodBlockSamples(ctx);
    scheduleWoodBlockFallback(ctx, time, isAccent);
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = sample;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(time);
}

// ─── Hi-Hat Real Sample Loader ───────────────────────────

/**
 * Load real hi-hat samples from The Open Source Drum Kit (public domain).
 * Uses two different velocity samples for accent vs regular hits.
 * Falls back to basic synthesis if fetch fails.
 */

const HIHAT_URLS = {
  // Real closed hi-hat recordings from The Open Source Drum Kit by Real Music Media
  normal: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh1.wav',
  accent: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh10.wav',
};

let hiHatSampleNormal: AudioBuffer | null = null;
let hiHatSampleAccent: AudioBuffer | null = null;
let hiHatLoadState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let hiHatLoadPromise: Promise<void> | null = null;

/**
 * Fetch and decode a WAV file from a URL into an AudioBuffer.
 */
async function fetchAudioBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

/**
 * Load both hi-hat samples (normal + accent). Caches the result.
 * Safe to call multiple times — deduplicates concurrent loads.
 */
function loadHiHatSamples(ctx: AudioContext): Promise<void> {
  if (hiHatLoadState === 'loaded') return Promise.resolve();
  if (hiHatLoadPromise) return hiHatLoadPromise;

  hiHatLoadState = 'loading';
  hiHatLoadPromise = Promise.all([
    fetchAudioBuffer(HIHAT_URLS.normal, ctx),
    fetchAudioBuffer(HIHAT_URLS.accent, ctx),
  ])
    .then(([normal, accent]) => {
      hiHatSampleNormal = normal;
      hiHatSampleAccent = accent;
      hiHatLoadState = 'loaded';
      console.log('[Metronome] Hi-hat samples loaded successfully');
    })
    .catch((err) => {
      console.warn('[Metronome] Failed to load hi-hat samples, falling back to synthesis:', err);
      hiHatLoadState = 'failed';
      hiHatLoadPromise = null;
    });

  return hiHatLoadPromise;
}

/**
 * Fallback synthesis for hi-hat when samples fail to load.
 * Simple highpass-filtered noise burst.
 */
function scheduleHiHatFallback(ctx: AudioContext, time: number, isAccent: boolean) {
  const dur = isAccent ? 0.08 : 0.05;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let ns = 31337;
  for (let i = 0; i < bufSize; i++) {
    ns = (ns * 16807) % 2147483647;
    const t = i / ctx.sampleRate;
    data[i] = ((ns / 2147483647) * 2 - 1) * Math.exp(-80 * t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // Highpass
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  hp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(isAccent ? 0.5 : 0.3, time);
  src.connect(hp);
  hp.connect(g);
  g.connect(ctx.destination);
  src.start(time);
}

/** Play a real hi-hat sample, or fallback if not loaded */
function scheduleHiHat(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? hiHatSampleAccent : hiHatSampleNormal;
  if (!sample) {
    // Try loading in background for next time, use fallback now
    if (hiHatLoadState !== 'loading') loadHiHatSamples(ctx);
    scheduleHiHatFallback(ctx, time, isAccent);
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = sample;

  // Boosted gain to match perceived loudness of wood block samples
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.7 : 1.35, time);
  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(time);
}

// ─── Rim Click (Sidestick) Real Sample Loader ────────────

/**
 * Load real sidestick / cross-stick samples from The Open Source Drum Kit.
 * Uses two different velocity samples for accent vs regular hits.
 * Falls back to basic synthesis if fetch fails.
 */

const RIMCLICK_URLS = {
  // Real sidestick recordings from The Open Source Drum Kit by Real Music Media
  normal: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/sidestick/sidestick1.wav',
  accent: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/sidestick/sidestick10.wav',
};

let rimClickSampleNormal: AudioBuffer | null = null;
let rimClickSampleAccent: AudioBuffer | null = null;
let rimClickLoadState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let rimClickLoadPromise: Promise<void> | null = null;

function loadRimClickSamples(ctx: AudioContext): Promise<void> {
  if (rimClickLoadState === 'loaded') return Promise.resolve();
  if (rimClickLoadPromise) return rimClickLoadPromise;

  rimClickLoadState = 'loading';
  rimClickLoadPromise = Promise.all([
    fetchAudioBuffer(RIMCLICK_URLS.normal, ctx),
    fetchAudioBuffer(RIMCLICK_URLS.accent, ctx),
  ])
    .then(([normal, accent]) => {
      rimClickSampleNormal = normal;
      rimClickSampleAccent = accent;
      rimClickLoadState = 'loaded';
      console.log('[Metronome] Rim click samples loaded successfully');
    })
    .catch((err) => {
      console.warn('[Metronome] Failed to load rim click samples, falling back to synthesis:', err);
      rimClickLoadState = 'failed';
      rimClickLoadPromise = null;
    });

  return rimClickLoadPromise;
}

/** Fallback synthesis for rim click when samples fail to load */
function scheduleRimClickFallback(ctx: AudioContext, time: number, isAccent: boolean) {
  const dur = isAccent ? 0.04 : 0.03;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let ns = 77773;
  for (let i = 0; i < bufSize; i++) {
    ns = (ns * 16807) % 2147483647;
    const t = i / ctx.sampleRate;
    data[i] = ((ns / 2147483647) * 2 - 1) * Math.exp(-200 * t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2800;
  bp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(isAccent ? 0.7 : 0.45, time);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(time);
}

/** Play a real rim click sample, or fallback if not loaded */
function scheduleRimClick(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? rimClickSampleAccent : rimClickSampleNormal;
  if (!sample) {
    if (rimClickLoadState !== 'loading') loadRimClickSamples(ctx);
    scheduleRimClickFallback(ctx, time, isAccent);
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = sample;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(time);
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

  // Keep refs synced
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);

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
      case 'rimclick':
        scheduleRimClick(ctx, time, isAccent);
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
      // Accent logic: beat 1 always; 6/8 adds beat 4; 12/8 adds beats 4, 7, 10
      const isAccent = beatRef.current === 0
        || (beatsRef.current === 6 && beatRef.current === 3)
        || (beatsRef.current === 12 && (beatRef.current === 3 || beatRef.current === 6 || beatRef.current === 9));
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

    // Pre-load all real samples when starting (non-blocking)
    loadHiHatSamples(ctx);
    loadWoodBlockSamples(ctx);
    loadRimClickSamples(ctx);


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
