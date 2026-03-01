import { create } from 'zustand';

const BPM_KEY = 'fretmaster-metronome-bpm';
const BEATS_KEY = 'fretmaster-metronome-beats';
const SOUND_KEY = 'fretmaster-metronome-sound';
const VOLUME_KEY = 'fretmaster-metronome-volume';
const BEATS_PER_CHORD_KEY = 'fretmaster-metronome-beats-per-chord';
const SYNC_UNIT_KEY = 'fretmaster-metronome-sync-unit';
const AUTO_REVEAL_KEY = 'fretmaster-metronome-auto-reveal';

export type MetronomeSoundType = 'click' | 'woodblock' | 'hihat' | 'sidestick' | 'voice';

export const SOUND_LABELS: Record<MetronomeSoundType, string> = {
  click: 'Click',
  woodblock: 'Wood Block',
  hihat: 'Hi-Hat',
  sidestick: 'Sidestick',
  voice: 'Voice Count',
};

function getStoredBpm(): number {
  try {
    const v = localStorage.getItem(BPM_KEY);
    if (v) { const n = Number(v); if (n >= 30 && n <= 260) return n; }
  } catch {}
  return 100;
}

function getStoredBeats(): number {
  try {
    const v = localStorage.getItem(BEATS_KEY);
    if (v) { const n = Number(v); if ([2, 3, 4, 6, 12].includes(n)) return n; }
  } catch {}
  return 4;
}

function getStoredSound(): MetronomeSoundType {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v && ['click', 'woodblock', 'hihat', 'sidestick', 'voice'].includes(v)) return v as MetronomeSoundType;
  } catch {}
  return 'click';
}

function getStoredVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v) { const n = Number(v); if (n >= 0 && n <= 1) return n; }
  } catch {}
  return 0.75;
}

function getStoredBeatsPerChord(): number {
  try {
    const v = localStorage.getItem(BEATS_PER_CHORD_KEY);
    if (v) { const n = Number(v); if (n >= 1 && n <= 32) return n; }
  } catch {}
  return 4;
}

function getStoredSyncUnit(): 'beats' | 'measures' {
  try {
    const v = localStorage.getItem(SYNC_UNIT_KEY);
    if (v === 'beats' || v === 'measures') return v;
  } catch {}
  return 'beats';
}

function getStoredAutoReveal(): boolean {
  try {
    const v = localStorage.getItem(AUTO_REVEAL_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {}
  return true;
}

// ─── Beat callback system ────────────────────────────────
// Pages subscribe to beat events. Each beat tick increments a counter.
// When the counter reaches beatsPerChord, a "chord advance" event fires.

type BeatListener = (beat: number, measure: number) => void;
type ChordAdvanceListener = () => void;

const beatListeners = new Set<BeatListener>();
const chordAdvanceListeners = new Set<ChordAdvanceListener>();
const autoRevealListeners = new Set<ChordAdvanceListener>();
const countInCompleteListeners = new Set<() => void>();

export function onBeat(listener: BeatListener): () => void {
  beatListeners.add(listener);
  return () => { beatListeners.delete(listener); };
}

export function onChordAdvance(listener: ChordAdvanceListener): () => void {
  chordAdvanceListeners.add(listener);
  return () => { chordAdvanceListeners.delete(listener); };
}

export function onAutoReveal(listener: ChordAdvanceListener): () => void {
  autoRevealListeners.add(listener);
  return () => { autoRevealListeners.delete(listener); };
}

export function onCountInComplete(listener: () => void): () => void {
  countInCompleteListeners.add(listener);
  return () => { countInCompleteListeners.delete(listener); };
}

function notifyBeat(beat: number, measure: number) {
  beatListeners.forEach((l) => l(beat, measure));
}

function notifyChordAdvance() {
  chordAdvanceListeners.forEach((l) => l());
}

function notifyAutoReveal() {
  autoRevealListeners.forEach((l) => l());
}

function notifyCountInComplete() {
  countInCompleteListeners.forEach((l) => l());
}

// ─── Audio engine (module-scoped, singleton) ─────────────

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let metronomeOutput: AudioNode | null = null;
let timerHandle: number = 0;
let nextNoteTime = 0;
let currentBeatInternal = 0;
let beatsSinceChordChange = 0;
let countInBeatsRemaining = 0;

function getOutput(ctx: AudioContext): AudioNode {
  return metronomeOutput || ctx.destination;
}

function sliderToGain(v: number): number {
  if (v <= 0) return 0;
  return Math.pow(v, 1.2) * 7;
}

// ─── Sound scheduling (imported from useMetronome) ───────

function scheduleClick(ctx: AudioContext, time: number, isAccent: boolean) {
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.connect(g1); g1.connect(getOutput(ctx));
  osc1.frequency.value = isAccent ? 1500 : 1000;
  osc1.type = 'sine';
  g1.gain.setValueAtTime(isAccent ? 0.4 : 0.22, time);
  g1.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  osc1.start(time); osc1.stop(time + 0.035);

  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.connect(g2); g2.connect(getOutput(ctx));
  osc2.frequency.value = isAccent ? 3200 : 2400;
  osc2.type = 'triangle';
  g2.gain.setValueAtTime(isAccent ? 0.18 : 0.1, time);
  g2.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
  osc2.start(time); osc2.stop(time + 0.02);

  const bufSize = Math.floor(ctx.sampleRate * 0.008);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  let ns = 12345;
  for (let i = 0; i < bufSize; i++) {
    ns = (ns * 16807) % 2147483647;
    noiseData[i] = ((ns / 2147483647) * 2 - 1) * Math.exp(-600 * (i / ctx.sampleRate));
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(isAccent ? 0.15 : 0.08, time);
  noiseSrc.connect(gn); gn.connect(getOutput(ctx));
  noiseSrc.start(time);
}

// ─── Sample loaders ──────────────────────────────────────

async function fetchAudioBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return ctx.decodeAudioData(await response.arrayBuffer());
}

// Wood Block
const WOODBLOCK_URLS = {
  normal: 'https://raw.githubusercontent.com/studiorack/avl-percussions/main/Samples/37-Woodblock-1.flac',
  accent: 'https://raw.githubusercontent.com/studiorack/avl-percussions/main/Samples/37-Woodblock-5.flac',
};
let wbNormal: AudioBuffer | null = null;
let wbAccent: AudioBuffer | null = null;
let wbState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let wbPromise: Promise<void> | null = null;

function loadWoodBlock(ctx: AudioContext): Promise<void> {
  if (wbState === 'loaded') return Promise.resolve();
  if (wbPromise) return wbPromise;
  wbState = 'loading';
  wbPromise = Promise.all([fetchAudioBuffer(WOODBLOCK_URLS.normal, ctx), fetchAudioBuffer(WOODBLOCK_URLS.accent, ctx)])
    .then(([n, a]) => { wbNormal = n; wbAccent = a; wbState = 'loaded'; })
    .catch(() => { wbState = 'failed'; wbPromise = null; });
  return wbPromise;
}

function scheduleWoodBlock(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? wbAccent : wbNormal;
  if (!sample) { if (wbState !== 'loading') loadWoodBlock(ctx); scheduleClick(ctx, time, isAccent); return; }
  const source = ctx.createBufferSource(); source.buffer = sample;
  source.playbackRate.value = Math.pow(2, -2 / 12);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250; hp.Q.value = 0.7;
  const pr = ctx.createBiquadFilter(); pr.type = 'peaking'; pr.frequency.value = 2500; pr.Q.value = 1.5; pr.gain.value = isAccent ? 4 : 3;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 6000; air.gain.value = isAccent ? 2 : 1.5;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + (isAccent ? 0.18 : 0.14));
  source.connect(hp); hp.connect(pr); pr.connect(air); air.connect(gain); gain.connect(getOutput(ctx));
  source.start(time);
}

// Hi-Hat
const HIHAT_URLS = {
  normal: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh5.wav',
  accent: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh14.wav',
};
let hhNormal: AudioBuffer | null = null;
let hhAccent: AudioBuffer | null = null;
let hhState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let hhPromise: Promise<void> | null = null;

function loadHiHat(ctx: AudioContext): Promise<void> {
  if (hhState === 'loaded') return Promise.resolve();
  if (hhPromise) return hhPromise;
  hhState = 'loading';
  hhPromise = Promise.all([fetchAudioBuffer(HIHAT_URLS.normal, ctx), fetchAudioBuffer(HIHAT_URLS.accent, ctx)])
    .then(([n, a]) => { hhNormal = n; hhAccent = a; hhState = 'loaded'; })
    .catch(() => { hhState = 'failed'; hhPromise = null; });
  return hhPromise;
}

function scheduleHiHat(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? hhAccent : hhNormal;
  if (!sample) { if (hhState !== 'loading') loadHiHat(ctx); scheduleClick(ctx, time, isAccent); return; }
  const source = ctx.createBufferSource(); source.buffer = sample;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;
  const pr = ctx.createBiquadFilter(); pr.type = 'peaking'; pr.frequency.value = 5500; pr.Q.value = 1.2; pr.gain.value = isAccent ? 4 : 3;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 10000; air.gain.value = isAccent ? 3 : 2;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(isAccent ? 1.1 : 0.85, time);
  source.connect(hp); hp.connect(pr); pr.connect(air); air.connect(gain); gain.connect(getOutput(ctx));
  source.start(time);
}

// Sidestick
const RIMCLICK_URLS = {
  normal: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/sidestick/sidestick1.wav',
  accent: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/sidestick/sidestick10.wav',
};
let rcNormal: AudioBuffer | null = null;
let rcAccent: AudioBuffer | null = null;
let rcState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let rcPromise: Promise<void> | null = null;

function loadRimClick(ctx: AudioContext): Promise<void> {
  if (rcState === 'loaded') return Promise.resolve();
  if (rcPromise) return rcPromise;
  rcState = 'loading';
  rcPromise = Promise.all([fetchAudioBuffer(RIMCLICK_URLS.normal, ctx), fetchAudioBuffer(RIMCLICK_URLS.accent, ctx)])
    .then(([n, a]) => { rcNormal = n; rcAccent = a; rcState = 'loaded'; })
    .catch(() => { rcState = 'failed'; rcPromise = null; });
  return rcPromise;
}

function scheduleRimClick(ctx: AudioContext, time: number, isAccent: boolean) {
  const sample = isAccent ? rcAccent : rcNormal;
  if (!sample) { if (rcState !== 'loading') loadRimClick(ctx); scheduleClick(ctx, time, isAccent); return; }
  const source = ctx.createBufferSource(); source.buffer = sample;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(isAccent ? 0.75 : 0.5, time);
  source.connect(gain); gain.connect(getOutput(ctx));
  source.start(time);
}

// Voice
const VOICE_URLS: Record<number, string> = {
  1: 'https://upload.wikimedia.org/wikipedia/commons/7/71/LL-Q1860_%28eng%29-Back_ache-one.wav',
  2: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/LL-Q1860_%28eng%29-Back_ache-two.wav',
  3: 'https://upload.wikimedia.org/wikipedia/commons/9/99/LL-Q1860_%28eng%29-Back_ache-three.wav',
  4: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/LL-Q1860_%28eng%29-Back_ache-four.wav',
  5: 'https://upload.wikimedia.org/wikipedia/commons/9/96/LL-Q1860_%28eng%29-Back_ache-five.wav',
  6: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/LL-Q1860_%28eng%29-Back_ache-six.wav',
  7: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/LL-Q1860_%28eng%29-Back_ache-seven.wav',
  8: 'https://upload.wikimedia.org/wikipedia/commons/4/49/LL-Q1860_%28eng%29-Back_ache-eight.wav',
  9: 'https://upload.wikimedia.org/wikipedia/commons/3/33/LL-Q1860_%28eng%29-Back_ache-nine.wav',
  10: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/LL-Q1860_%28eng%29-Back_ache-ten.wav',
  11: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/LL-Q1860_%28eng%29-Back_ache-eleven.wav',
  12: 'https://upload.wikimedia.org/wikipedia/commons/2/26/LL-Q1860_%28eng%29-Back_ache-twelve.wav',
};

const VOICE_ONSET_OFFSETS: Record<number, number> = {
  1: 0.058, 2: 0.048, 3: 0.088, 4: 0.058, 5: 0.058, 6: 0.068,
  7: 0.052, 8: 0.012, 9: 0.045, 10: 0.048, 11: 0.015, 12: 0.055,
};

const voiceBuffers = new Map<number, AudioBuffer>();
const voiceOnsets = new Map<number, number>();
let voiceState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let voicePromise: Promise<void> | null = null;

function detectOnset(buffer: AudioBuffer, threshold = 0.02): number {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) { if (Math.abs(data[i]) > threshold) return i / buffer.sampleRate; }
  return 0;
}

function trimBuffer(ctx: AudioContext, buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0, end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  start = Math.max(0, start - 256);
  end = Math.min(data.length - 1, end + 64);
  const length = end - start + 1;
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.getChannelData(ch).set(buffer.getChannelData(ch).subarray(start, end + 1));
  }
  const fadeInSamples = Math.min(Math.floor(0.005 * buffer.sampleRate), length);
  const fadeOutSamples = Math.min(Math.floor(0.050 * buffer.sampleRate), length);
  for (let ch = 0; ch < trimmed.numberOfChannels; ch++) {
    const chData = trimmed.getChannelData(ch);
    for (let i = 0; i < fadeInSamples; i++) { chData[i] *= 0.5 * (1 - Math.cos(Math.PI * (i / fadeInSamples))); }
    chData[0] = 0;
    const fadeStart = chData.length - fadeOutSamples;
    for (let i = 0; i < fadeOutSamples; i++) { chData[fadeStart + i] *= 0.5 * (1 + Math.cos(Math.PI * (i / fadeOutSamples))); }
    chData[chData.length - 1] = 0;
  }
  return trimmed;
}

function loadVoice(ctx: AudioContext): Promise<void> {
  if (voiceState === 'loaded') return Promise.resolve();
  if (voicePromise) return voicePromise;
  voiceState = 'loading';
  const nums = [1,2,3,4,5,6,7,8,9,10,11,12];
  voicePromise = Promise.all(nums.map((n) => fetchAudioBuffer(VOICE_URLS[n], ctx).then((buf) => ({ n, buf }))))
    .then((results) => {
      for (const { n, buf } of results) {
        const tb = trimBuffer(ctx, buf);
        voiceBuffers.set(n, tb);
        voiceOnsets.set(n, detectOnset(tb) + (VOICE_ONSET_OFFSETS[n] ?? 0.04));
      }
      voiceState = 'loaded';
    })
    .catch(() => { voiceState = 'failed'; voicePromise = null; });
  return voicePromise;
}

function scheduleVoice(ctx: AudioContext, time: number, beatNumber: number, isAccent: boolean, secondsPerBeat = 0.5) {
  const buffer = voiceBuffers.get(beatNumber);
  if (!buffer) { if (voiceState !== 'loading') loadVoice(ctx); scheduleClick(ctx, time, isAccent); return; }
  const source = ctx.createBufferSource(); source.buffer = buffer;
  if (beatNumber === 11) source.playbackRate.value = 1.40;
  else if (beatNumber === 7) source.playbackRate.value = 1.30;
  else if (beatNumber === 12) source.playbackRate.value = 1.25;
  else source.playbackRate.value = 1.18;

  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; hp.Q.value = 0.7;
  const pr = ctx.createBiquadFilter(); pr.type = 'peaking'; pr.frequency.value = 2800; pr.Q.value = 1.5; pr.gain.value = isAccent ? 2.0 : 1.2;
  const deEss = ctx.createBiquadFilter(); deEss.type = 'highshelf'; deEss.frequency.value = 7000; deEss.gain.value = -2;

  const gain = ctx.createGain();
  const vol = isAccent ? 0.55 : 0.38;
  const onsetOffset = voiceOnsets.get(beatNumber) ?? 0.03;
  const startTime = Math.max(ctx.currentTime, time - onsetOffset);

  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, Math.max(0, startTime - 0.002));
  gain.gain.linearRampToValueAtTime(vol, startTime);

  const decayTime = Math.min(0.30, Math.max(0.10, secondsPerBeat * 0.50));
  const decayRatio = secondsPerBeat > 0.5 ? 0.65 : secondsPerBeat > 0.35 ? 0.55 : 0.45;
  const decayTarget = Math.max(vol * decayRatio, 0.001);
  gain.gain.exponentialRampToValueAtTime(decayTarget, startTime + decayTime);

  const effectiveDuration = buffer.duration / source.playbackRate.value;
  const bufferEndTime = startTime + effectiveDuration;
  const gainFadeStart = Math.max(startTime + decayTime + 0.005, bufferEndTime - 0.06);
  if (gainFadeStart < bufferEndTime) {
    gain.gain.setValueAtTime(decayTarget, gainFadeStart);
    gain.gain.linearRampToValueAtTime(0, bufferEndTime);
  }

  source.connect(hp); hp.connect(pr); pr.connect(deEss); deEss.connect(gain); gain.connect(getOutput(ctx));
  source.start(startTime);
  source.stop(bufferEndTime + 0.01);
}

// ─── Preload ─────────────────────────────────────────────

let preloadDone = false;

export async function preloadMetronomeSamples(): Promise<void> {
  if (preloadDone) return;
  preloadDone = true;
  try {
    const ctx = new AudioContext();
    await Promise.allSettled([loadWoodBlock(ctx), loadHiHat(ctx), loadRimClick(ctx), loadVoice(ctx)]);
    await ctx.close();
  } catch {
    preloadDone = false;
  }
}

// ─── Schedule beat ───────────────────────────────────────

function scheduleBeat(ctx: AudioContext, time: number, isAccent: boolean, beat: number, secPerBeat: number, soundType: MetronomeSoundType) {
  switch (soundType) {
    case 'woodblock': scheduleWoodBlock(ctx, time, isAccent); break;
    case 'hihat': scheduleHiHat(ctx, time, isAccent); break;
    case 'sidestick': scheduleRimClick(ctx, time, isAccent); break;
    case 'voice': scheduleVoice(ctx, time, beat + 1, isAccent, secPerBeat); break;
    default: scheduleClick(ctx, time, isAccent); break;
  }
}

// ─── Zustand Store ───────────────────────────────────────

interface MetronomeStore {
  isPlaying: boolean;
  bpm: number;
  beatsPerMeasure: number;
  currentBeat: number;
  soundType: MetronomeSoundType;
  volume: number;
  /** How many beats/measures before auto-advancing to next chord */
  beatsPerChord: number;
  /** Whether beat-sync auto-advance is enabled */
  syncEnabled: boolean;
  /** Whether to count beats or measures for advancing */
  syncUnit: 'beats' | 'measures';
  /** Whether to auto-reveal the chord before advancing */
  autoRevealBeforeAdvance: boolean;
  /** Beats remaining until the next chord advance (for countdown UI) */
  beatsUntilAdvance: number;
  /** Whether currently in a count-in phase */
  isCountingIn: boolean;
  /** Current beat of the count-in (1-based, 0 = not started) */
  countInBeat: number;
  /** Total beats in the count-in (2 * beatsPerMeasure) */
  countInTotal: number;

  setBpm: (v: number) => void;
  setBeatsPerMeasure: (v: number) => void;
  setSoundType: (v: MetronomeSoundType) => void;
  setVolume: (v: number) => void;
  setBeatsPerChord: (v: number) => void;
  setSyncEnabled: (v: boolean) => void;
  setSyncUnit: (v: 'beats' | 'measures') => void;
  setAutoRevealBeforeAdvance: (v: boolean) => void;
  startCountIn: () => void;
  stopCountIn: () => void;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

export const useMetronomeStore = create<MetronomeStore>((set, get) => ({
  isPlaying: false,
  bpm: getStoredBpm(),
  beatsPerMeasure: getStoredBeats(),
  currentBeat: 0,
  soundType: getStoredSound(),
  volume: getStoredVolume(),
  beatsPerChord: getStoredBeatsPerChord(),
  syncEnabled: false,
  syncUnit: getStoredSyncUnit(),
  autoRevealBeforeAdvance: getStoredAutoReveal(),
  beatsUntilAdvance: getStoredBeatsPerChord(),
  isCountingIn: false,
  countInBeat: 0,
  countInTotal: 0,

  setBpm: (v) => {
    const clamped = Math.max(30, Math.min(260, v));
    set({ bpm: clamped });
    try { localStorage.setItem(BPM_KEY, String(clamped)); } catch {}
  },

  setBeatsPerMeasure: (v) => {
    set({ beatsPerMeasure: v });
    try { localStorage.setItem(BEATS_KEY, String(v)); } catch {}
  },

  setSoundType: (v) => {
    set({ soundType: v });
    try { localStorage.setItem(SOUND_KEY, v); } catch {}
  },

  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ volume: clamped });
    try { localStorage.setItem(VOLUME_KEY, String(clamped)); } catch {}
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(0);
      masterGain.gain.value = sliderToGain(clamped);
    }
  },

  setBeatsPerChord: (v) => {
    const clamped = Math.max(1, Math.min(32, v));
    set({ beatsPerChord: clamped });
    beatsSinceChordChange = 0;
    try { localStorage.setItem(BEATS_PER_CHORD_KEY, String(clamped)); } catch {}
  },

  setSyncEnabled: (v) => {
    set({ syncEnabled: v });
    beatsSinceChordChange = 0;
    const s = get();
    const total = s.syncUnit === 'measures' ? s.beatsPerChord * s.beatsPerMeasure : s.beatsPerChord;
    set({ beatsUntilAdvance: total });
  },

  setSyncUnit: (v) => {
    set({ syncUnit: v });
    beatsSinceChordChange = 0;
    const s = get();
    const total = v === 'measures' ? s.beatsPerChord * s.beatsPerMeasure : s.beatsPerChord;
    set({ beatsUntilAdvance: total });
    try { localStorage.setItem(SYNC_UNIT_KEY, v); } catch {}
  },

  setAutoRevealBeforeAdvance: (v) => {
    set({ autoRevealBeforeAdvance: v });
    try { localStorage.setItem(AUTO_REVEAL_KEY, String(v)); } catch {}
  },

  startCountIn: () => {
    const s = get();
    if (!s.syncEnabled) set({ syncEnabled: true });
    const total = 2 * s.beatsPerMeasure;
    countInBeatsRemaining = total;
    set({ isCountingIn: true, countInBeat: 0, countInTotal: total });
    if (s.isPlaying) {
      // Reset timing for clean count-in from beat 1
      currentBeatInternal = 0;
      beatsSinceChordChange = 0;
      if (audioCtx) nextNoteTime = audioCtx.currentTime + 0.05;
    } else {
      get().start();
    }
  },

  stopCountIn: () => {
    countInBeatsRemaining = 0;
    set({ isCountingIn: false, countInBeat: 0 });
    get().stop();
  },

  start: () => {
    if (audioCtx) return;
    const ctx = new AudioContext();
    audioCtx = ctx;

    const mg = ctx.createGain();
    mg.gain.value = sliderToGain(get().volume);
    mg.connect(ctx.destination);
    masterGain = mg;
    metronomeOutput = mg;

    loadWoodBlock(ctx); loadHiHat(ctx); loadRimClick(ctx); loadVoice(ctx);

    currentBeatInternal = 0;
    beatsSinceChordChange = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    set({ isPlaying: true, currentBeat: 0 });

    const loop = () => {
      if (!audioCtx) return;
      const state = get();
      const lookahead = 0.1;
      while (nextNoteTime < ctx.currentTime + lookahead) {
        const beats = state.beatsPerMeasure;
        const isAccent = currentBeatInternal === 0
          || (beats === 6 && currentBeatInternal === 3)
          || (beats === 12 && (currentBeatInternal === 3 || currentBeatInternal === 6 || currentBeatInternal === 9));
        const secPerBeat = 60 / state.bpm;

        scheduleBeat(ctx, nextNoteTime, isAccent, currentBeatInternal, secPerBeat, state.soundType);

        const snapBeat = currentBeatInternal;
        const snapBeatsSince = beatsSinceChordChange + 1;
        const schedTime = nextNoteTime;

        setTimeout(() => {
          const s = get();
          set({ currentBeat: snapBeat });
          notifyBeat(snapBeat, Math.floor(snapBeatsSince / s.beatsPerMeasure));

          // Count-in handling — suppress chord advance during count-in
          if (countInBeatsRemaining > 0) {
            countInBeatsRemaining--;
            const ciTotal = s.countInTotal || (2 * s.beatsPerMeasure);
            const ciCurrent = ciTotal - countInBeatsRemaining; // 1 to ciTotal
            set({ countInBeat: ciCurrent, isCountingIn: true });

            if (countInBeatsRemaining === 0) {
              // Keep "START" visible briefly before transitioning
              setTimeout(() => {
                beatsSinceChordChange = 0;
                const totalSync = s.syncUnit === 'measures' ? s.beatsPerChord * s.beatsPerMeasure : s.beatsPerChord;
                set({ isCountingIn: false, countInBeat: 0, beatsUntilAdvance: totalSync });
                notifyCountInComplete();
              }, 500);
            }
            return;
          }

          // Check chord advance
          if (s.syncEnabled && s.beatsPerChord > 0) {
            const totalBeats = s.syncUnit === 'measures' ? s.beatsPerChord * s.beatsPerMeasure : s.beatsPerChord;
            const remaining = totalBeats - snapBeatsSince;
            set({ beatsUntilAdvance: Math.max(0, remaining) });

            // Auto-reveal before advancing
            const revealThreshold = Math.min(2, totalBeats - 1);
            if (s.autoRevealBeforeAdvance && revealThreshold > 0 && remaining === revealThreshold) {
              notifyAutoReveal();
            }

            if (snapBeatsSince >= totalBeats) {
              beatsSinceChordChange = 0;
              set({ beatsUntilAdvance: totalBeats });
              notifyChordAdvance();
            }
          }
        }, Math.max(0, (schedTime - ctx.currentTime) * 1000));

        beatsSinceChordChange++;
        nextNoteTime += 60 / state.bpm;
        currentBeatInternal = (currentBeatInternal + 1) % state.beatsPerMeasure;
      }
    };

    timerHandle = window.setInterval(loop, 25);
  },

  stop: () => {
    countInBeatsRemaining = 0;
    set({ isPlaying: false, currentBeat: 0, isCountingIn: false, countInBeat: 0 });
    if (timerHandle) { clearInterval(timerHandle); timerHandle = 0; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    masterGain = null;
    metronomeOutput = null;
  },

  toggle: () => {
    if (get().isPlaying) get().stop();
    else get().start();
  },
}));

/** Reset the chord-advance beat counter (call when manually advancing) */
export function resetBeatCounter() {
  beatsSinceChordChange = 0;
  const s = useMetronomeStore.getState();
  const total = s.syncUnit === 'measures' ? s.beatsPerChord * s.beatsPerMeasure : s.beatsPerChord;
  useMetronomeStore.setState({ beatsUntilAdvance: total });
}
