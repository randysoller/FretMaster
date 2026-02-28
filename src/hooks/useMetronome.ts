import { useState, useRef, useCallback, useEffect } from 'react';

const BPM_KEY = 'fretmaster-metronome-bpm';
const BEATS_KEY = 'fretmaster-metronome-beats';
const SOUND_KEY = 'fretmaster-metronome-sound';
const VOLUME_KEY = 'fretmaster-metronome-volume';

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
    if (v && ['click', 'woodblock', 'hihat', 'sidestick', 'voice'].includes(v)) return v as MetronomeSoundType;
  } catch {}
  return 'click';
}

function getStoredVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v) {
      const n = Number(v);
      if (n >= 0 && n <= 1) return n;
    }
  } catch {}
  return 0.75;
}

export interface MetronomeState {
  isPlaying: boolean;
  bpm: number;
  beatsPerMeasure: number;
  currentBeat: number;
  soundType: MetronomeSoundType;
  volume: number;
  setBpm: (bpm: number) => void;
  setBeatsPerMeasure: (beats: number) => void;
  setSoundType: (sound: MetronomeSoundType) => void;
  setVolume: (volume: number) => void;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

// ─── Master Output Node ─────────────────────────────────

let metronomeOutput: AudioNode | null = null;

function getOutput(ctx: AudioContext): AudioNode {
  return metronomeOutput || ctx.destination;
}

/**
 * Convert a linear slider value (0–1) to an exponential audio gain (0–5).
 * Uses a gentle power curve so the slider feels natural to human ears.
 * 0 → 0 (mute), 0.5 → ~3.27, 0.75 → ~5.02 (default), 1.0 → 7.0 (max boost).
 * Shallow exponent (v^1.2) and high multiplier ensure adequate loudness on mobile.
 */
function sliderToGain(v: number): number {
  if (v <= 0) return 0;
  return Math.pow(v, 1.2) * 7;
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
  g1.connect(getOutput(ctx));
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
  g2.connect(getOutput(ctx));
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
  gn.connect(getOutput(ctx));
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
  g.connect(getOutput(ctx));
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
  // Pitch down one whole step (2 semitones)
  source.playbackRate.value = Math.pow(2, -2 / 12);

  // High-pass to remove low-end mud introduced by pitch shift
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 250;
  highpass.Q.value = 0.7;

  // Presence boost around 2.5kHz for the woody "knock" attack
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2500;
  presence.Q.value = 1.5;
  presence.gain.value = isAccent ? 4 : 3;

  // High-shelf for clarity / top-end definition
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 6000;
  air.gain.value = isAccent ? 2 : 1.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.7, time);
  // Tight decay envelope to cut the reverb tail
  gain.gain.exponentialRampToValueAtTime(0.01, time + (isAccent ? 0.18 : 0.14));

  source.connect(highpass);
  highpass.connect(presence);
  presence.connect(air);
  air.connect(gain);
  gain.connect(getOutput(ctx));

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
  // Using mid-velocity (chh5) for normal and high-velocity (chh14) for accent — better tonal balance
  normal: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh5.wav',
  accent: 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/hihat/closed-hihat/chh14.wav',
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
  g.connect(getOutput(ctx));
  src.start(time);
}

/** Play a real hi-hat sample with EQ shaping, or fallback if not loaded */
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

  // High-pass filter to remove low-end mud, keeping the hi-hat clean
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 300;
  highpass.Q.value = 0.7;

  // Presence boost around 5–6kHz for crisp "tick" attack
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 5500;
  presence.Q.value = 1.2;
  presence.gain.value = isAccent ? 4 : 3;

  // High-shelf boost for shimmer / air above 10kHz
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 10000;
  air.gain.value = isAccent ? 3 : 2;

  // Output gain — conservative to avoid clipping; EQ provides perceived loudness
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isAccent ? 1.1 : 0.85, time);

  source.connect(highpass);
  highpass.connect(presence);
  presence.connect(air);
  air.connect(gain);
  gain.connect(getOutput(ctx));

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
  g.connect(getOutput(ctx));
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
  gain.gain.setValueAtTime(isAccent ? 0.75 : 0.5, time);
  source.connect(gain);
  gain.connect(getOutput(ctx));

  source.start(time);
}

// ─── Voice Count Sample Loader ───────────────────────────

/**
 * Voice counting (1–12) using Wikimedia Commons "En-us-" pronunciation recordings.
 * All numbers use the same speaker / recording series for tonal consistency.
 *
 * Key challenge: different spoken numbers have different perceptual onset times.
 * We pre-analyze each sample to find the amplitude onset point and schedule
 * playback early by that offset so the perceived sound lands exactly on the beat.
 *
 * Additional per-word manual offsets account for consonant characteristics:
 * - Plosives ("two", "ten", "twelve") have a brief silence before the voice activates
 * - Fricatives ("five", "six", "seven") have noise onset before pitched voice
 * - Vowels ("one", "eight", "eleven") have near-instant perceived onset
 */

// Lingua Libre recordings from Wikimedia Commons — all by the same speaker ("Back ache")
// Using a single speaker ensures consistent voice across all 12 beat numbers.
// WAV format for highest quality; CC-BY-SA license.
const WIKIMEDIA_VOICE_URLS: Record<number, string> = {
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

/**
 * Manual onset compensation offsets (seconds) per number.
 * Positive = schedule earlier; these values account for the time between
 * the sample start and when the listener perceives the "attack" of the word.
 *
 * Calibrated for Lingua Libre "Back ache" recordings after phonetic analysis:
 * - Voiceless fricatives (/θ/, /f/) have the most gradual, quiet onset → largest offsets
 * - Plosives (/t/) have a sharp burst transient but Voice Onset Time delays the vowel
 * - Sibilants (/s/) are loud and percussive → moderate offsets
 * - Vowel-initial words (/eɪ/, /ɪ/) have near-instant perceived onset → minimal offset
 * - Glides (/w/) and nasals (/n/) fall in between
 *
 * These offsets are absolute (not tempo-relative), tuned for the 60–180 BPM sweet spot.
 * At 120 BPM (500ms/beat), a 50ms offset is 10% of the beat — perceptually tight.
 */
const VOICE_ONSET_OFFSETS: Record<number, number> = {
  1: 0.058,  // "one" /w/ — voiced glide, gradual buildup in dictionary-style speech
  2: 0.048,  // "two" /t/ — aspirated plosive, VOT + aspiration gap before vowel
  3: 0.088,  // "three" /θr/ — voiceless dental fricative + liquid cluster; dictionary speech
              //   elongates the nearly-silent /θ/ (~60ms) before the /r/ even begins;
              //   detectOnset may skip /θ/ entirely (below 0.02), so manual offset must
              //   cover the full perceptual gap from fricative noise to vowel peak ★
  4: 0.058,  // "four" /f/ — voiceless labiodental fricative, quiet airflow ~50ms
  5: 0.058,  // "five" /f/ — same /f/ onset profile as "four"
  6: 0.068,  // "six" /s/ — sibilant IS loud (detectOnset finds it early, autoOnset ≈ 0)
              //   but the perceived "hit" is the /ɪ/ vowel, not the /s/ noise;
              //   dictionary speech draws out /s/ to 70-100ms before voicing begins ★
  7: 0.052,  // "seven" /s/ — sibilant onset like "six" but shorter /s/ before /ɛ/
  8: 0.012,  // "eight" /eɪ/ — vowel-initial, near-instant glottal onset
  9: 0.045,  // "nine" /n/ — voiced nasal, quick onset but not percussive
  10: 0.048, // "ten" /t/ — aspirated plosive like "two"
  11: 0.015, // "eleven" /ɪ/ — vowel-initial, near-instant
  12: 0.055, // "twelve" /tw/ — plosive + glide cluster, deliberate articulation
};

/** Stored loaded voice AudioBuffers: index 1–9 from FSDD, 10–12 synthesized */
const voiceBuffers: Map<number, AudioBuffer> = new Map();
/** Detected onset offsets (seconds) for each loaded buffer */
const voiceOnsets: Map<number, number> = new Map();
let voiceLoadState: 'idle' | 'loading' | 'loaded' | 'failed' = 'idle';
let voiceLoadPromise: Promise<void> | null = null;

/**
 * Analyze an AudioBuffer to find the onset point — the first sample
 * where the amplitude exceeds a threshold. Returns time in seconds.
 */
function detectOnset(buffer: AudioBuffer, threshold = 0.02): number {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) {
      return i / buffer.sampleRate;
    }
  }
  return 0;
}

/**
 * Trim silence from the start and end of an AudioBuffer, then bake a
 * smooth fade-out into the last 40ms of audio data.
 *
 * Baking the fade directly into the sample data is the most reliable way to
 * prevent clicks when the BufferSourceNode reaches the end of its buffer.
 * Unlike gain-node-based fades, this approach:
 *   - Has zero timing dependency (no scheduled automation to align)
 *   - Works at any playback rate (fade scales proportionally)
 *   - Guarantees the final sample is exactly 0.0
 */
function trimBuffer(ctx: AudioContext, buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  // Find first sample above threshold
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  // Find last sample above threshold
  while (end > start && Math.abs(data[end]) < threshold) end--;
  // Add small safety margin at the start only (no trailing margin — we'll fade to zero)
  start = Math.max(0, start - 256);
  // Tight trim at the end — no extra padding
  end = Math.min(data.length - 1, end + 64);
  const length = end - start + 1;
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.getChannelData(ch).set(buffer.getChannelData(ch).subarray(start, end + 1));
  }

  // ── Bake fade-in AND fade-out into the buffer data ──
  // Fade-in:  5ms raised-cosine at the start — prevents a click when the
  //           BufferSourceNode begins playback at a non-zero sample value.
  //           5ms is short enough to be imperceptible but eliminates the
  //           transient that especially affects "one" (whose /w/ glide can
  //           have an abrupt waveform edge right after the silence trim).
  // Fade-out: 50ms raised-cosine at the end — ensures the buffer ends at
  //           exactly zero amplitude so there is no click when the source
  //           node finishes, regardless of playback rate or scheduling.
  const fadeInSamples = Math.min(Math.floor(0.005 * buffer.sampleRate), length);
  const fadeOutSamples = Math.min(Math.floor(0.050 * buffer.sampleRate), length);
  for (let ch = 0; ch < trimmed.numberOfChannels; ch++) {
    const chData = trimmed.getChannelData(ch);

    // Fade-in: Hann 0 → 1
    for (let i = 0; i < fadeInSamples; i++) {
      const t = i / fadeInSamples;
      const envelope = 0.5 * (1 - Math.cos(Math.PI * t));
      chData[i] *= envelope;
    }
    // Guarantee the absolute first sample is zero
    chData[0] = 0;

    // Fade-out: Hann 1 → 0
    const fadeStart = chData.length - fadeOutSamples;
    for (let i = 0; i < fadeOutSamples; i++) {
      const t = i / fadeOutSamples;
      const envelope = 0.5 * (1 + Math.cos(Math.PI * t));
      chData[fadeStart + i] *= envelope;
    }
    // Guarantee the absolute last sample is zero
    chData[chData.length - 1] = 0;
  }

  return trimmed;
}

/**
 * Concatenate two AudioBuffers with a small overlap/gap into a single buffer.
 * Used for building "ten" (1+0), "eleven" (1+1), "twelve" (1+2) from digit samples.
 */
function concatenateBuffers(
  ctx: AudioContext,
  buf1: AudioBuffer,
  buf2: AudioBuffer,
  gapSeconds = 0.01
): AudioBuffer {
  const gapSamples = Math.floor(gapSeconds * ctx.sampleRate);
  const totalLength = buf1.length + gapSamples + buf2.length;
  const result = ctx.createBuffer(1, totalLength, ctx.sampleRate);
  const out = result.getChannelData(0);
  const d1 = buf1.getChannelData(0);
  const d2 = buf2.getChannelData(0);
  out.set(d1, 0);
  out.set(d2, buf1.length + gapSamples);
  return result;
}

/**
 * Load voice count samples:
 * - All numbers 1–12 from Wikimedia Commons "En-us-" recordings
 * - Same speaker series for consistent voice across all time signatures
 */
function loadVoiceSamples(ctx: AudioContext): Promise<void> {
  if (voiceLoadState === 'loaded') return Promise.resolve();
  if (voiceLoadPromise) return voiceLoadPromise;

  voiceLoadState = 'loading';

  // Fetch all 12 number recordings from Wikimedia Commons
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const promises = nums.map((num) =>
    fetchAudioBuffer(WIKIMEDIA_VOICE_URLS[num], ctx).then((buf) => ({ num, buf }))
  );

  voiceLoadPromise = Promise.all(promises)
    .then((results) => {
      for (const { num, buf } of results) {
        const trimmedBuf = trimBuffer(ctx, buf);
        voiceBuffers.set(num, trimmedBuf);
        const autoOnset = detectOnset(trimmedBuf);
        const manualOffset = VOICE_ONSET_OFFSETS[num] ?? 0.04;
        voiceOnsets.set(num, autoOnset + manualOffset);
      }

      voiceLoadState = 'loaded';
      console.log('[Metronome] Voice count samples loaded successfully (1-12, Lingua Libre "Back ache" speaker)');
    })
    .catch((err) => {
      console.warn('[Metronome] Failed to load voice samples, falling back to click:', err);
      voiceLoadState = 'failed';
      voiceLoadPromise = null;
    });

  return voiceLoadPromise;
}

/**
 * Schedule a voice count for a specific beat number.
 * @param beatNumber 1-based beat number (1–12)
 * @param time The exact beat time in AudioContext time
 * @param isAccent Whether this is an accented beat (played slightly louder)
 */
function scheduleVoice(ctx: AudioContext, time: number, beatNumber: number, isAccent: boolean, secondsPerBeat = 0.5) {
  const buffer = voiceBuffers.get(beatNumber);
  if (!buffer) {
    // Fallback to click if voice not loaded
    if (voiceLoadState !== 'loading') loadVoiceSamples(ctx);
    scheduleClick(ctx, time, isAccent);
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Speed up playback for snappier rhythmic feel and better alignment at faster tempos.
  // All samples are from the same Wikimedia series; multi-syllable words get more
  // compression to keep them tight within the beat window.
  // Rates tuned so each word finishes well before the next beat at 180 BPM (~333ms).
  if (beatNumber === 11) {
    source.playbackRate.value = 1.40; // "eleven" — 3 syllables, needs most compression
  } else if (beatNumber === 7) {
    source.playbackRate.value = 1.30; // "seven" — 2 syllables, moderate compression
  } else if (beatNumber === 12) {
    source.playbackRate.value = 1.25; // "twelve" — 1 syllable but long /lv/ coda
  } else {
    source.playbackRate.value = 1.18; // single-syllable words — gentle speedup for tightness
  }

  // EQ chain for voice clarity in a metronome context
  // High-pass to remove rumble and low-frequency room tone
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 180;
  highpass.Q.value = 0.7;

  // Moderate presence boost for voice intelligibility — kept conservative
  // to avoid adding perceived loudness in the ear's most sensitive range (2–4kHz)
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 1.5;
  presence.gain.value = isAccent ? 2.0 : 1.2;

  // Slight high-shelf cut to tame sibilance and keep voice from sounding harsh
  const deEss = ctx.createBiquadFilter();
  deEss.type = 'highshelf';
  deEss.frequency.value = 7000;
  deEss.gain.value = -2;

  // Voice samples have sustained energy (higher RMS) vs transient percussive sounds,
  // so perceived loudness is higher at the same peak gain even with lower gain values.
  // We compensate with:
  //   1. Lower peak gains (0.55/0.38)
  //   2. A tempo-adaptive transient-shaping envelope on the gain node
  //   3. A baked-in fade-out in the buffer data itself (applied during loading in
  //      trimBuffer) — this is the most reliable anti-click method because it has
  //      zero timing dependency: the audio data literally ends at zero amplitude.
  //      No gain node scheduling, no linearRamp timing, no source.stop() needed.

  const gain = ctx.createGain();
  const vol = isAccent ? 0.55 : 0.38;

  const onsetOffset = voiceOnsets.get(beatNumber) ?? 0.03;
  const startTime = Math.max(ctx.currentTime, time - onsetOffset);

  // Set gain to vol at the onset-compensated start time (not beat time)
  // so there's no gap where gain is at the default 1.0 before our scheduled value
  gain.gain.setValueAtTime(vol, startTime);

  // Transient shaping: gentle decay after initial consonant attack
  const decayTime = Math.min(0.30, Math.max(0.08, secondsPerBeat * 0.45));
  const decayRatio = secondsPerBeat > 0.5 ? 0.55 : secondsPerBeat > 0.35 ? 0.45 : 0.35;
  gain.gain.exponentialRampToValueAtTime(Math.max(vol * decayRatio, 0.001), startTime + decayTime);

  source.connect(highpass);
  highpass.connect(presence);
  presence.connect(deEss);
  deEss.connect(gain);
  gain.connect(getOutput(ctx));

  // Start playback early by the onset offset so perceived sound lands on beat.
  // No source.stop() needed — the buffer has a baked-in fade-out to zero,
  // so it ends silently on its own with no click artifacts.
  source.start(startTime);
}

// ─── Preload All Samples on First Interaction ───────────

let preloadState: 'idle' | 'loading' | 'done' = 'idle';

/**
 * Preload all metronome audio samples (wood block, hi-hat, sidestick, voice)
 * using a temporary AudioContext for decoding. Call on first user interaction
 * (click/touch/keydown) so samples are ready before the metronome starts.
 *
 * AudioBuffers decoded by one AudioContext can be played by another, so
 * the buffers remain valid when the metronome later creates its own context.
 *
 * Safe to call multiple times — deduplicates via preloadState.
 */
export async function preloadMetronomeSamples(): Promise<void> {
  if (preloadState !== 'idle') return;
  preloadState = 'loading';

  try {
    const ctx = new AudioContext();
    console.log('[Metronome] Preloading all samples on first interaction…');

    // Fire all sample loaders in parallel (each is internally deduplicated)
    await Promise.allSettled([
      loadWoodBlockSamples(ctx),
      loadHiHatSamples(ctx),
      loadRimClickSamples(ctx),
      loadVoiceSamples(ctx),
    ]);

    // Close the temporary context — decoded buffers persist in module vars
    await ctx.close();
    preloadState = 'done';
    console.log('[Metronome] All samples preloaded successfully');
  } catch (err) {
    console.warn('[Metronome] Preload error (non-fatal, will retry on play):', err);
    preloadState = 'idle'; // allow retry
  }
}

// ─── Hook ────────────────────────────────────────────────

export function useMetronome(): MetronomeState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(getStoredBpm);
  const [beatsPerMeasure, setBeatsState] = useState(getStoredBeats);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [soundType, setSoundTypeState] = useState<MetronomeSoundType>(getStoredSound);
  const [volume, setVolumeState] = useState(getStoredVolume);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number>(0);
  const beatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerMeasure);
  const soundTypeRef = useRef(soundType);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(false);
  const nextNoteTimeRef = useRef(0);

  // Keep refs synced
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beatsPerMeasure; }, [beatsPerMeasure]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);
  useEffect(() => {
    volumeRef.current = volume;
    if (masterGainRef.current) {
      const gain = sliderToGain(volume);
      // Use cancelScheduledValues + direct value for reliable immediate update
      masterGainRef.current.gain.cancelScheduledValues(0);
      masterGainRef.current.gain.value = gain;
      console.log(`[Metronome] Volume slider: ${Math.round(volume * 100)}% → gain: ${gain.toFixed(3)}`);
    }
  }, [volume]);

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

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try { localStorage.setItem(VOLUME_KEY, String(clamped)); } catch {}
  }, []);

  /** Schedule a single beat sound */
  const scheduleBeat = useCallback((ctx: AudioContext, time: number, isAccent: boolean, beat: number, secPerBeat: number) => {
    switch (soundTypeRef.current) {
      case 'woodblock':
        scheduleWoodBlock(ctx, time, isAccent);
        break;
      case 'hihat':
        scheduleHiHat(ctx, time, isAccent);
        break;
      case 'sidestick':
        scheduleRimClick(ctx, time, isAccent);
        break;
      case 'voice': {
        // beat is 0-indexed, voice counts are 1-indexed
        const beatNumber = beat + 1;
        scheduleVoice(ctx, time, beatNumber, isAccent, secPerBeat);
        break;
      }
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
      const secondsPerBeat = 60 / bpmRef.current;
      scheduleBeat(ctx, nextNoteTimeRef.current, isAccent, beatRef.current, secondsPerBeat);

      const beatSnap = beatRef.current;
      setTimeout(() => {
        setCurrentBeat(beatSnap);
      }, Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));

      nextNoteTimeRef.current += secondsPerBeat;
      beatRef.current = (beatRef.current + 1) % beatsRef.current;
    }
  }, [scheduleBeat]);

  const start = useCallback(() => {
    if (isPlayingRef.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Create master gain node for metronome volume (exponential curve)
    const masterGain = ctx.createGain();
    const initialGain = sliderToGain(volumeRef.current);
    masterGain.gain.value = initialGain;
    console.log(`[Metronome] Start — initial volume: ${Math.round(volumeRef.current * 100)}% → gain: ${initialGain.toFixed(3)}`);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;
    metronomeOutput = masterGain;

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
    masterGainRef.current = null;
    metronomeOutput = null;
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
    volume,
    setBpm,
    setBeatsPerMeasure,
    setSoundType,
    setVolume,
    toggle,
    start,
    stop,
  };
}
