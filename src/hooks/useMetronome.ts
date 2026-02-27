import { useState, useRef, useCallback, useEffect } from 'react';

const BPM_KEY = 'fretmaster-metronome-bpm';
const BEATS_KEY = 'fretmaster-metronome-beats';
const SOUND_KEY = 'fretmaster-metronome-sound';

export type MetronomeSoundType = 'click' | 'woodblock' | 'voice' | 'hihat' | 'rimclick';

export const SOUND_LABELS: Record<MetronomeSoundType, string> = {
  click: 'Click',
  woodblock: 'Wood Block',
  voice: 'Voice Count',
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
    if (v && ['click', 'woodblock', 'voice', 'hihat', 'rimclick'].includes(v)) return v as MetronomeSoundType;
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

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
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

// ─── Voice Count Real Sample Loader ──────────────────────

/**
 * Load real spoken digit samples from the Free Spoken Digit Dataset (FSDD).
 * CC-BY-SA 4.0 licensed, hosted on GitHub. Uses "jackson" speaker (clear male voice).
 * Files are 8kHz WAV — Web Audio API automatically resamples on decode.
 * Loads digits 1–9 as real samples; 10–12 fall back to SpeechSynthesis.
 */

const FSDD_BASE = 'https://raw.githubusercontent.com/Jakobovski/free-spoken-digit-dataset/master/recordings';

// Best sample indices per digit for the "jackson" speaker (selected for clarity)
const VOICE_SAMPLE_MAP: Record<number, string> = {
  1: `${FSDD_BASE}/1_jackson_0.wav`,
  2: `${FSDD_BASE}/2_jackson_0.wav`,
  3: `${FSDD_BASE}/3_jackson_0.wav`,
  4: `${FSDD_BASE}/4_jackson_0.wav`,
  5: `${FSDD_BASE}/5_jackson_0.wav`,
  6: `${FSDD_BASE}/6_jackson_0.wav`,
  7: `${FSDD_BASE}/7_jackson_0.wav`,
  8: `${FSDD_BASE}/8_jackson_0.wav`,
  9: `${FSDD_BASE}/9_jackson_0.wav`,
};

const voiceSamples: Map<number, AudioBuffer> = new Map();
let voiceLoadState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let voiceLoadPromise: Promise<void> | null = null;

function loadVoiceSamples(ctx: AudioContext): Promise<void> {
  if (voiceLoadState === 'loaded') return Promise.resolve();
  if (voiceLoadPromise) return voiceLoadPromise;

  voiceLoadState = 'loading';
  const entries = Object.entries(VOICE_SAMPLE_MAP).map(([digit, url]) => ({
    digit: Number(digit),
    url,
  }));

  voiceLoadPromise = Promise.all(
    entries.map(({ digit, url }) =>
      fetchAudioBuffer(url, ctx)
        .then((buf) => ({ digit, buf }))
        .catch((err) => {
          console.warn(`[Metronome] Failed to load voice sample for digit ${digit}:`, err);
          return null;
        })
    )
  )
    .then((results) => {
      let loaded = 0;
      for (const r of results) {
        if (r) {
          voiceSamples.set(r.digit, r.buf);
          loaded++;
        }
      }
      voiceLoadState = loaded > 0 ? 'loaded' : 'failed';
      console.log(`[Metronome] Voice samples loaded: ${loaded}/9`);
    })
    .catch(() => {
      voiceLoadState = 'failed';
      voiceLoadPromise = null;
    });

  return voiceLoadPromise;
}

/**
 * Voice count — plays real spoken digit samples from FSDD for beats 1–9.
 * Falls back to SpeechSynthesis for beats 10–12 and if samples fail to load.
 * Includes a subtle reference tick for rhythmic precision.
 */
function scheduleVoice(
  ctx: AudioContext,
  time: number,
  isAccent: boolean,
  beatNumber: number,
  voiceRef: React.MutableRefObject<SpeechSynthesisVoice | null>,
) {
  const num = beatNumber + 1; // 1-indexed beat number

  // Subtle reference tick for rhythmic anchor
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.connect(g1);
  g1.connect(ctx.destination);
  osc1.frequency.value = isAccent ? 340 : 290;
  osc1.type = 'sine';
  g1.gain.setValueAtTime(isAccent ? 0.08 : 0.04, time);
  g1.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  osc1.start(time);
  osc1.stop(time + 0.045);

  // Try real sample for digits 1–9
  const sample = voiceSamples.get(num);
  if (sample) {
    const source = ctx.createBufferSource();
    source.buffer = sample;
    source.playbackRate.value = 0.82;

    // Gentle low-pass to tame harsh high frequencies
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
    source.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    source.start(time);
    return;
  }

  // Fallback to SpeechSynthesis for 10–12 or if samples not loaded
  if (voiceLoadState !== 'loading') loadVoiceSamples(ctx);

  const delay = Math.max(0, (time - ctx.currentTime) * 1000);
  if (typeof speechSynthesis !== 'undefined') {
    setTimeout(() => {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(num));
      utterance.rate = 1.5;
      utterance.pitch = 0.44;
      utterance.volume = isAccent ? 1.0 : 0.7;
      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }
      speechSynthesis.speak(utterance);
    }, delay);
  }
}

// ─── Voice Selection Helper (fallback for SpeechSynthesis) ───

function selectMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;

  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

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
      case 'rimclick':
        scheduleRimClick(ctx, time, isAccent);
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
    loadVoiceSamples(ctx);

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
