import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff, Music, Volume2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Constants ───────────────────────────────────────────

const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

type GuitarString = { string: number; note: string; freq: number; display: string };

interface TuningPreset {
  name: string;
  label: string;
  strings: GuitarString[];
}

const TUNING_PRESETS: TuningPreset[] = [
  {
    name: 'standard',
    label: 'Standard',
    strings: [
      { string: 6, note: 'E2', freq: 82.41, display: 'E' },
      { string: 5, note: 'A2', freq: 110.00, display: 'A' },
      { string: 4, note: 'D3', freq: 146.83, display: 'D' },
      { string: 3, note: 'G3', freq: 196.00, display: 'G' },
      { string: 2, note: 'B3', freq: 246.94, display: 'B' },
      { string: 1, note: 'E4', freq: 329.63, display: 'E' },
    ],
  },
  {
    name: 'half-step-down',
    label: '½ Step Down',
    strings: [
      { string: 6, note: 'Eb2', freq: 77.78, display: 'E♭' },
      { string: 5, note: 'Ab2', freq: 103.83, display: 'A♭' },
      { string: 4, note: 'Db3', freq: 138.59, display: 'D♭' },
      { string: 3, note: 'Gb3', freq: 185.00, display: 'G♭' },
      { string: 2, note: 'Bb3', freq: 233.08, display: 'B♭' },
      { string: 1, note: 'Eb4', freq: 311.13, display: 'E♭' },
    ],
  },
  {
    name: 'drop-d',
    label: 'Drop D',
    strings: [
      { string: 6, note: 'D2', freq: 73.42, display: 'D' },
      { string: 5, note: 'A2', freq: 110.00, display: 'A' },
      { string: 4, note: 'D3', freq: 146.83, display: 'D' },
      { string: 3, note: 'G3', freq: 196.00, display: 'G' },
      { string: 2, note: 'B3', freq: 246.94, display: 'B' },
      { string: 1, note: 'E4', freq: 329.63, display: 'E' },
    ],
  },
  {
    name: 'open-g',
    label: 'Open G',
    strings: [
      { string: 6, note: 'D2', freq: 73.42, display: 'D' },
      { string: 5, note: 'G2', freq: 98.00, display: 'G' },
      { string: 4, note: 'D3', freq: 146.83, display: 'D' },
      { string: 3, note: 'G3', freq: 196.00, display: 'G' },
      { string: 2, note: 'B3', freq: 246.94, display: 'B' },
      { string: 1, note: 'D4', freq: 293.66, display: 'D' },
    ],
  },
  {
    name: 'open-d',
    label: 'Open D',
    strings: [
      { string: 6, note: 'D2', freq: 73.42, display: 'D' },
      { string: 5, note: 'A2', freq: 110.00, display: 'A' },
      { string: 4, note: 'D3', freq: 146.83, display: 'D' },
      { string: 3, note: 'F#3', freq: 185.00, display: 'F#' },
      { string: 2, note: 'A3', freq: 220.00, display: 'A' },
      { string: 1, note: 'D4', freq: 293.66, display: 'D' },
    ],
  },
  {
    name: 'open-e',
    label: 'Open E',
    strings: [
      { string: 6, note: 'E2', freq: 82.41, display: 'E' },
      { string: 5, note: 'B2', freq: 123.47, display: 'B' },
      { string: 4, note: 'E3', freq: 164.81, display: 'E' },
      { string: 3, note: 'G#3', freq: 207.65, display: 'G#' },
      { string: 2, note: 'B3', freq: 246.94, display: 'B' },
      { string: 1, note: 'E4', freq: 329.63, display: 'E' },
    ],
  },
  {
    name: 'dadgad',
    label: 'DADGAD',
    strings: [
      { string: 6, note: 'D2', freq: 73.42, display: 'D' },
      { string: 5, note: 'A2', freq: 110.00, display: 'A' },
      { string: 4, note: 'D3', freq: 146.83, display: 'D' },
      { string: 3, note: 'G3', freq: 196.00, display: 'G' },
      { string: 2, note: 'A3', freq: 220.00, display: 'A' },
      { string: 1, note: 'D4', freq: 293.66, display: 'D' },
    ],
  },
];

const GUITAR_STRINGS = TUNING_PRESETS[0].strings;

// ─── Pitch detection utilities ───────────────────────────

function frequencyToNoteInfo(freq: number): { note: string; octave: number; cents: number; noteIndex: number } {
  const semitoneOffset = 12 * Math.log2(freq / 440);
  const roundedSemitone = Math.round(semitoneOffset);
  const cents = Math.round((semitoneOffset - roundedSemitone) * 100);
  const rawIndex = roundedSemitone + 9; // A = index 9
  const noteIndex = ((rawIndex % 12) + 12) % 12;
  const octave = Math.floor((roundedSemitone + 9) / 12) + 4;
  return { note: NOTE_STRINGS[noteIndex], octave, cents, noteIndex };
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  // Check signal level
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < ((globalThis as any).__tunerRmsThreshold ?? 0.008)) return -1;

  const size = buffer.length;
  const halfSize = Math.floor(size / 2);

  // Compute autocorrelation for lags up to half buffer
  const correlations = new Float32Array(halfSize);
  for (let lag = 0; lag < halfSize; lag++) {
    let sum = 0;
    for (let i = 0; i < halfSize; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find first zero crossing (dip)
  let dip = 1;
  while (dip < halfSize - 1 && correlations[dip] > correlations[dip + 1]) {
    dip++;
  }

  // Find the peak after the dip
  let maxVal = -Infinity;
  let maxPos = dip;
  for (let i = dip; i < halfSize - 1; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  // Validate: peak should be significant relative to zero-lag
  if (maxPos <= 0 || maxVal < correlations[0] * 0.25) return -1;

  // Parabolic interpolation for sub-sample accuracy
  let refinedPos = maxPos;
  if (maxPos > 0 && maxPos < halfSize - 1) {
    const prev = correlations[maxPos - 1];
    const curr = correlations[maxPos];
    const next = correlations[maxPos + 1];
    const denominator = 2 * (prev - 2 * curr + next);
    if (Math.abs(denominator) > 1e-10) {
      const shift = (prev - next) / denominator;
      refinedPos = maxPos + shift;
    }
  }

  const frequency = sampleRate / refinedPos;

  // Sanity check: guitar range ~70Hz to ~1200Hz
  if (frequency < 60 || frequency > 1400) return -1;

  return frequency;
}

function findClosestString(freq: number, strings: GuitarString[]): GuitarString | null {
  let closest = strings[0];
  let minDist = Infinity;
  for (const gs of strings) {
    const dist = Math.abs(1200 * Math.log2(freq / gs.freq));
    if (dist < minDist) {
      minDist = dist;
      closest = gs;
    }
  }
  return minDist < 400 ? closest : null;
}

// ─── Component ───────────────────────────────────────────

export default function Tuner() {
  const [isListening, setIsListening] = useState(false);
  const [selectedTuning, setSelectedTuning] = useState<TuningPreset>(TUNING_PRESETS[0]);
  const [tuningDropdownOpen, setTuningDropdownOpen] = useState(false);
  const tuningDropdownRef = useRef<HTMLDivElement>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [noteInfo, setNoteInfo] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [closestString, setClosestString] = useState<GuitarString | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedString, setSelectedString] = useState<GuitarString | null>(null);
  const [playingString, setPlayingString] = useState<number | null>(null);
  const [inTuneConfirmed, setInTuneConfirmed] = useState(false);
  const [sensitivity, setSensitivity] = useState(() => {
    const saved = localStorage.getItem('tuner-mic-sensitivity');
    return saved !== null ? Number(saved) : 50;
  });
  const sensitivityRef = useRef(50);
  const startedRef = useRef(false);
  const inTuneStartRef = useRef<number>(0);
  const inTuneSoundPlayedRef = useRef(false);
  const selectedStringRef = useRef<GuitarString | null>(null);
  const selectedTuningRef = useRef<TuningPreset>(TUNING_PRESETS[0]);

  // Hold last detected note to prevent flickering when signal briefly drops
  const [displayNote, setDisplayNote] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [displayFreq, setDisplayFreq] = useState<number | null>(null);
  const [displayClosest, setDisplayClosest] = useState<GuitarString | null>(null);
  const holdTimerRef = useRef<number>(0);

  // Keep refs in sync so the detect loop can access current values
  useEffect(() => { selectedStringRef.current = selectedString; }, [selectedString]);
  useEffect(() => { selectedTuningRef.current = selectedTuning; }, [selectedTuning]);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
    localStorage.setItem('tuner-mic-sensitivity', String(sensitivity));
  }, [sensitivity]);

  // Close tuning dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tuningDropdownRef.current && !tuningDropdownRef.current.contains(e.target as Node)) {
        setTuningDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Active strings based on selected tuning
  const activeStrings = useMemo(() => selectedTuning.strings, [selectedTuning]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array | null>(null);

  const stopListening = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = 0;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    bufferRef.current = null;
    setIsListening(false);
    setFrequency(null);
    setNoteInfo(null);
    setClosestString(null);
    setDisplayNote(null);
    setDisplayFreq(null);
    setDisplayClosest(null);
    setInTuneConfirmed(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      sourceRef.current = source;
      bufferRef.current = new Float32Array(analyser.fftSize);

      setIsListening(true);
      setPermissionDenied(false);

      const detect = () => {
        if (!analyserRef.current || !bufferRef.current || !audioCtxRef.current) return;

        // Map sensitivity (0–100) to RMS threshold: high sensitivity → low threshold
        const s = sensitivityRef.current;
        const rmsThreshold = 0.05 * Math.pow(0.02, s / 100);
        (globalThis as any).__tunerRmsThreshold = rmsThreshold;

        analyserRef.current.getFloatTimeDomainData(bufferRef.current);
        const freq = autoCorrelate(bufferRef.current, audioCtxRef.current.sampleRate);

        if (freq > 0) {
          setFrequency(freq);
          const info = frequencyToNoteInfo(freq);
          setNoteInfo(info);
          const closest = findClosestString(freq, selectedTuningRef.current.strings);
          setClosestString(closest);
          // Update held display immediately
          setDisplayNote(info);
          setDisplayFreq(freq);
          setDisplayClosest(closest);
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = 0; }

          // Check if in tune for cowbell confirmation
          const target = selectedStringRef.current ?? closest;
          const centsOff = target ? Math.round(1200 * Math.log2(freq / target.freq)) : info.cents;
          if (Math.abs(centsOff) <= 5) {
            if (inTuneStartRef.current === 0) inTuneStartRef.current = performance.now();
            if (!inTuneSoundPlayedRef.current && performance.now() - inTuneStartRef.current >= 1000) {
              inTuneSoundPlayedRef.current = true;
              setInTuneConfirmed(true);
              playCowbellSound();
            }
          } else {
            inTuneStartRef.current = 0;
            inTuneSoundPlayedRef.current = false;
            setInTuneConfirmed(false);
          }
        } else {
          setFrequency(null);
          setNoteInfo(null);
          setClosestString(null);
          // Delay clearing display to prevent flicker
          if (!holdTimerRef.current) {
            holdTimerRef.current = window.setTimeout(() => {
              setDisplayNote(null);
              setDisplayFreq(null);
              setDisplayClosest(null);
              holdTimerRef.current = 0;
            }, 600);
          }
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    } catch {
      setPermissionDenied(true);
      setIsListening(false);
    }
  }, []);

  // Dedicated AudioContext for chime — created on first user gesture
  const chimeCtxRef = useRef<AudioContext | null>(null);
  const getChimeCtx = useCallback(() => {
    if (!chimeCtxRef.current || chimeCtxRef.current.state === 'closed') {
      chimeCtxRef.current = new AudioContext();
    }
    if (chimeCtxRef.current.state === 'suspended') {
      chimeCtxRef.current.resume();
    }
    return chimeCtxRef.current;
  }, []);

  // Bright chime "in tune" confirmation sound
  const playCowbellSound = useCallback(() => {
    try {
      const ctx = getChimeCtx();
      const now = ctx.currentTime;
      const duration = 1.4;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.5, now);
      masterGain.gain.setTargetAtTime(0.0001, now + 0.06, duration * 0.28);
      masterGain.connect(ctx.destination);

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3000;
      highShelf.gain.value = 4;
      highShelf.connect(masterGain);

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 800;
      hp.Q.value = 0.5;
      hp.connect(highShelf);

      const partials = [
        { freq: 1568, amp: 0.40, decay: 0.45 },
        { freq: 2350, amp: 0.25, decay: 0.32 },
        { freq: 3136, amp: 0.15, decay: 0.22 },
        { freq: 4700, amp: 0.06, decay: 0.14 },
      ];
      partials.forEach(({ freq, amp, decay }) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(amp, now);
        g.gain.setTargetAtTime(0.0001, now + 0.02, duration * decay);
        osc.connect(g);
        g.connect(hp);
        osc.start(now);
        osc.stop(now + duration);
      });

      const tLen = Math.floor(ctx.sampleRate * 0.006);
      const tBuf = ctx.createBuffer(1, tLen, ctx.sampleRate);
      const tData = tBuf.getChannelData(0);
      for (let i = 0; i < tLen; i++) tData[i] = (Math.random() * 2 - 1) * 0.15;
      const tSrc = ctx.createBufferSource();
      tSrc.buffer = tBuf;
      const tBP = ctx.createBiquadFilter();
      tBP.type = 'bandpass';
      tBP.frequency.value = 4000;
      tBP.Q.value = 2;
      const tGain = ctx.createGain();
      tGain.gain.setValueAtTime(0.12, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      tSrc.connect(tBP);
      tBP.connect(tGain);
      tGain.connect(hp);
      tSrc.start(now);
    } catch (e) {
      console.log('Chime sound error:', e);
    }
  }, [getChimeCtx]);

  // Reference tone playback — realistic acoustic guitar synthesis
  const playReferenceTone = useCallback((gs: GuitarString) => {
    const ctx = new AudioContext();
    const duration = 3.0;
    const now = ctx.currentTime;
    const freq = gs.freq;

    // ─── Master output with compressor for punch ───
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, now);
    compressor.knee.setValueAtTime(6, now);
    compressor.ratio.setValueAtTime(4, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.15, now);
    compressor.connect(ctx.destination);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(1.0, now + 0.002);
    masterGain.gain.setTargetAtTime(0.0001, now + 0.005, duration * 0.32);
    masterGain.connect(compressor);

    // ─── Body resonance EQ — simulates guitar body ───
    const bodyLow = ctx.createBiquadFilter();
    bodyLow.type = 'peaking';
    bodyLow.frequency.value = 120;
    bodyLow.Q.value = 2.5;
    bodyLow.gain.value = 6;

    const bodyMid = ctx.createBiquadFilter();
    bodyMid.type = 'peaking';
    bodyMid.frequency.value = 400;
    bodyMid.Q.value = 1.2;
    bodyMid.gain.value = 3;

    const bodyHigh = ctx.createBiquadFilter();
    bodyHigh.type = 'peaking';
    bodyHigh.frequency.value = 2800;
    bodyHigh.Q.value = 1.0;
    bodyHigh.gain.value = -4;

    const airRoll = ctx.createBiquadFilter();
    airRoll.type = 'lowpass';
    airRoll.frequency.value = 6000;
    airRoll.Q.value = 0.7;

    bodyLow.connect(bodyMid);
    bodyMid.connect(bodyHigh);
    bodyHigh.connect(airRoll);
    airRoll.connect(masterGain);

    // ─── Harmonic partials — acoustic guitar spectral envelope ───
    // Relative amplitudes modeled after real nylon/steel string spectra
    const harmonics = [
      { h: 1, amp: 1.00, decay: 0.38 },  // fundamental
      { h: 2, amp: 0.72, decay: 0.32 },  // strong 2nd
      { h: 3, amp: 0.50, decay: 0.26 },  // prominent 3rd
      { h: 4, amp: 0.38, decay: 0.22 },
      { h: 5, amp: 0.25, decay: 0.18 },
      { h: 6, amp: 0.18, decay: 0.14 },
      { h: 7, amp: 0.10, decay: 0.11 },
      { h: 8, amp: 0.06, decay: 0.09 },
      { h: 9, amp: 0.03, decay: 0.07 },
      { h: 10, amp: 0.015, decay: 0.06 },
    ];

    harmonics.forEach(({ h, amp, decay }) => {
      const partialFreq = freq * h;
      if (partialFreq > 10000) return;

      const osc = ctx.createOscillator();
      // Mix sine + triangle for richer timbre on lower harmonics
      osc.type = h <= 3 ? 'triangle' : 'sine';
      osc.frequency.value = partialFreq;
      // Slight inharmonicity (higher partials stretch sharp, like real strings)
      osc.frequency.value = partialFreq * (1 + 0.00005 * h * h);

      const pGain = ctx.createGain();
      const attackAmp = amp * 0.65;
      pGain.gain.setValueAtTime(0, now);
      pGain.gain.linearRampToValueAtTime(attackAmp, now + 0.001);
      // Fast initial decay (pluck) then slower sustain decay
      pGain.gain.setTargetAtTime(attackAmp * 0.5, now + 0.002, 0.03);
      pGain.gain.setTargetAtTime(0.0001, now + 0.06, duration * decay);

      osc.connect(pGain);
      pGain.connect(bodyLow);
      osc.start(now);
      osc.stop(now + duration);
    });

    // ─── Pluck transient — short filtered noise burst ───
    const pluckLen = Math.floor(ctx.sampleRate * 0.035);
    const pluckBuf = ctx.createBuffer(1, pluckLen, ctx.sampleRate);
    const pluckData = pluckBuf.getChannelData(0);
    for (let i = 0; i < pluckLen; i++) {
      // Shaped noise burst with quick fade
      const env = 1 - (i / pluckLen);
      pluckData[i] = (Math.random() * 2 - 1) * env * env * 0.8;
    }
    const pluckSrc = ctx.createBufferSource();
    pluckSrc.buffer = pluckBuf;

    const pluckFilter = ctx.createBiquadFilter();
    pluckFilter.type = 'bandpass';
    pluckFilter.frequency.value = Math.min(freq * 4, 5000);
    pluckFilter.Q.value = 1.8;

    const pluckGain = ctx.createGain();
    pluckGain.gain.setValueAtTime(0.55, now);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    pluckSrc.connect(pluckFilter);
    pluckFilter.connect(pluckGain);
    pluckGain.connect(masterGain);
    pluckSrc.start(now);

    // ─── String thump / body knock — low-freq transient ───
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(freq * 0.5, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(freq * 0.25, now + 0.08);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.25, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(masterGain);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.15);

    // ─── Finger / fret buzz — high-freq tiny noise ───
    const buzzLen = Math.floor(ctx.sampleRate * 0.008);
    const buzzBuf = ctx.createBuffer(1, buzzLen, ctx.sampleRate);
    const buzzData = buzzBuf.getChannelData(0);
    for (let i = 0; i < buzzLen; i++) buzzData[i] = (Math.random() * 2 - 1) * 0.15;
    const buzzSrc = ctx.createBufferSource();
    buzzSrc.buffer = buzzBuf;
    const buzzHP = ctx.createBiquadFilter();
    buzzHP.type = 'highpass';
    buzzHP.frequency.value = 3000;
    const buzzGain = ctx.createGain();
    buzzGain.gain.setValueAtTime(0.2, now);
    buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    buzzSrc.connect(buzzHP);
    buzzHP.connect(buzzGain);
    buzzGain.connect(masterGain);
    buzzSrc.start(now);

    setPlayingString(gs.string);
    setTimeout(() => setPlayingString((prev) => prev === gs.string ? null : prev), 2200);
    setTimeout(() => ctx.close(), (duration + 0.5) * 1000);
  }, []);

  // Warm up chime context on first user interaction so it's ready for auto-play
  useEffect(() => {
    const warmUp = () => {
      getChimeCtx();
      window.removeEventListener('click', warmUp);
      window.removeEventListener('touchstart', warmUp);
    };
    window.addEventListener('click', warmUp, { once: true });
    window.addEventListener('touchstart', warmUp, { once: true });
    return () => {
      window.removeEventListener('click', warmUp);
      window.removeEventListener('touchstart', warmUp);
    };
  }, [getChimeCtx]);

  // Auto-start listening on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  // Use held display values for rendering to prevent flicker
  const shownNote = displayNote;
  const shownFreq = displayFreq;
  const shownClosest = displayClosest;

  // Determine tuning accuracy
  const cents = shownNote?.cents ?? 0;
  const isInTune = Math.abs(cents) <= 5;
  const isClose = Math.abs(cents) <= 15;

  // For meter display
  const meterPosition = Math.max(-50, Math.min(50, cents));

  // Determine what string we're comparing against
  const targetString = selectedString ?? shownClosest;
  const centsFromTarget = targetString && shownFreq
    ? Math.round(1200 * Math.log2(shownFreq / targetString.freq))
    : cents;
  const isTargetInTune = Math.abs(centsFromTarget) <= 5;
  const isTargetClose = Math.abs(centsFromTarget) <= 15;
  const targetMeterPosition = Math.max(-50, Math.min(50, centsFromTarget));

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Header */}
      <div className="relative px-4 sm:px-6 pt-8 pb-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4">
          <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
          <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Guitar Tuner</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
          <span className="text-[hsl(var(--text-default))]">Tune Your </span>
          <span className="text-gradient">Guitar</span>
        </h1>

        {/* Tuning preset selector */}
        <div className="mt-4 flex justify-center">
          <div ref={tuningDropdownRef} className="relative">
            <button
              onClick={() => setTuningDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-3 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm px-5 py-3 min-h-[48px] transition-all hover:bg-[hsl(var(--bg-overlay))] active:scale-95"
            >
              <span className="font-display text-base font-bold text-[hsl(var(--text-default))]">
                {selectedTuning.label}
              </span>
              <span className="text-sm font-body text-[hsl(var(--text-muted))]">
                {selectedTuning.strings.map((s) => s.display).join(' ')}
              </span>
              <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform duration-200 ${tuningDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {tuningDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 w-72 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] backdrop-blur-xl shadow-xl overflow-hidden"
              >
                {TUNING_PRESETS.map((preset) => {
                  const isActive = selectedTuning.name === preset.name;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setSelectedTuning(preset);
                        setSelectedString(null);
                        setTuningDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-5 py-3.5 min-h-[48px] transition-colors ${
                        isActive
                          ? 'bg-[hsl(var(--color-primary)/0.1)]'
                          : 'hover:bg-[hsl(var(--bg-overlay))]'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`font-display text-base font-bold ${
                          isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                        }`}>
                          {preset.label}
                        </p>
                        <p className="text-sm font-body text-[hsl(var(--text-muted))]">
                          {preset.strings.map((s) => s.note).join(' – ')}
                        </p>
                      </div>
                      {isActive && (
                        <span className="size-2 rounded-full bg-[hsl(var(--color-primary))]" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm font-body text-[hsl(var(--text-muted))]">
          Play a string and the tuner will detect the pitch.
        </p>
      </div>

      <div className="px-4 sm:px-6 pb-12 max-w-xl mx-auto space-y-6">
        {permissionDenied && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5 text-center justify-center">
            <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">
              Microphone access denied. Please allow mic access in browser settings.
            </span>
          </div>
        )}

        {/* Main tuner display */}
        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6 sm:p-8">
          <div className="space-y-6">
            {/* Detected note */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                {/* Circle border on in-tune chime */}
                <motion.div
                  className="absolute rounded-full border-[3px] border-[hsl(142_71%_45%)] pointer-events-none"
                  style={{ width: 140, height: 140 }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={Math.abs(centsFromTarget) <= 2 && shownNote
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.85 }
                  }
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
                <p className={`font-display text-7xl sm:text-8xl font-extrabold leading-none transition-colors duration-300 ${
                  !shownNote
                    ? 'text-[hsl(var(--text-muted)/0.25)]'
                    : isTargetInTune
                      ? 'text-[hsl(142_71%_45%)]'
                      : isTargetClose
                        ? 'text-[hsl(var(--color-emphasis))]'
                        : 'text-[hsl(var(--text-default))]'
                }`}>
                  {shownNote ? (
                    <>{shownNote.note}<span className="text-3xl sm:text-4xl opacity-50">{shownNote.octave}</span></>
                  ) : (
                    <>—</>  
                  )}
                </p>
              </div>
              <p className="mt-2 text-sm font-body text-[hsl(var(--text-muted))] tabular-nums transition-opacity duration-300" style={{ opacity: shownFreq ? 1 : 0.3 }}>
                {shownFreq ? `${shownFreq.toFixed(1)} Hz` : '— Hz'}
              </p>
              {targetString && shownNote && (
                <p className="mt-1 text-xs font-body text-[hsl(var(--text-muted))]">
                  Target: {targetString.note} ({targetString.freq.toFixed(1)} Hz)
                </p>
              )}

            </div>

            {/* Segmented cents meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-[2px] px-1">
                {Array.from({ length: 41 }, (_, i) => {
                  const segCents = (i - 20) * 2.5;
                  const isCenter = i === 20;
                  const absSegCents = Math.abs(segCents);

                  // Zone colors
                  let hue: string;
                  if (absSegCents <= 5) hue = '142 71% 45%';
                  else if (absSegCents <= 15) hue = '45 93% 47%';
                  else hue = '0 72% 51%';

                  // Fill logic: light segments from center toward current offset
                  const cur = shownNote ? centsFromTarget : 0;
                  const hasSignal = !!shownNote;
                  let lit = false;
                  if (hasSignal) {
                    if (isCenter && Math.abs(cur) < 2.5) {
                      lit = true;
                    } else if (cur > 0 && segCents > 0 && segCents <= cur + 1.25) {
                      lit = true;
                    } else if (cur < 0 && segCents < 0 && segCents >= cur - 1.25) {
                      lit = true;
                    }
                    // Always light center when within green zone
                    if (isCenter && Math.abs(cur) <= 5) lit = true;
                  }

                  return (
                    <div
                      key={i}
                      className="rounded-sm transition-all duration-150"
                      style={{
                        width: isCenter ? 6 : 4,
                        height: isCenter ? 36 : absSegCents <= 5 ? 28 : absSegCents <= 15 ? 24 : 20,
                        backgroundColor: lit
                          ? `hsl(${hue})`
                          : `hsl(${hue} / 0.12)`,
                        boxShadow: lit
                          ? `0 0 8px hsl(${hue} / 0.5), 0 0 2px hsl(${hue} / 0.3)`
                          : 'none',
                      }}
                    />
                  );
                })}
              </div>
              {/* Labels */}
              <div className="flex justify-between items-center text-[10px] font-body text-[hsl(var(--text-muted))]">
                <span>♭ Flat</span>
                <span className={`font-display text-sm font-bold tabular-nums transition-colors duration-300 ${
                  !shownNote ? 'text-[hsl(var(--text-muted)/0.4)]' : isTargetInTune ? 'text-[hsl(142_71%_45%)]' : isTargetClose ? 'text-[hsl(var(--color-emphasis))]' : 'text-[hsl(var(--text-default))]'
                }`}>
                  {shownNote ? `${centsFromTarget > 0 ? '+' : ''}${centsFromTarget}¢` : '0¢'}
                </span>
                <span>Sharp ♯</span>
              </div>
            </div>

            {/* Mic sensitivity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="size-3.5" />
                  Mic Sensitivity
                </label>
                <span className="text-xs font-body tabular-nums text-[hsl(var(--text-muted))]">{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer
                  bg-[hsl(var(--bg-surface))]
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[hsl(var(--color-primary))]
                  [&::-webkit-slider-thumb]:shadow-[0_0_6px_hsl(var(--color-primary)/0.4)]
                  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
                  [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95
                  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-[hsl(var(--color-primary))] [&::-moz-range-thumb]:border-none"
              />
              <div className="flex justify-between text-[10px] font-body text-[hsl(var(--text-muted)/0.5)]">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Status text */}
            <div className="text-center h-7">
              {shownNote && isTargetInTune ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="font-display text-lg font-bold text-[hsl(142_71%_45%)] uppercase tracking-wider"
                  style={{ textShadow: '0 0 20px hsl(142 71% 45% / 0.3)' }}
                >
                  In Tune ✓
                </motion.p>
              ) : shownNote ? (
                <p className="font-body text-sm text-[hsl(var(--text-muted))]">
                  {centsFromTarget < 0 ? 'Tune up ↑' : 'Tune down ↓'}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* String selector + reference tones (combined) */}
        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
              Strings
            </h3>
            <button
              onClick={() => setSelectedString(null)}
              className={`rounded-lg px-4 py-2.5 text-sm font-display font-bold transition-all active:scale-95 min-h-[44px] ${
                !selectedString
                  ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)]'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Mic className="size-3.5" />
                Auto-Detect
              </div>
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {activeStrings.map((gs) => {
              const isActive = selectedString?.string === gs.string;
              const isDetected = !selectedString && shownClosest?.string === gs.string && isListening && shownFreq !== null;
              const isPlaying = playingString === gs.string;
              // Real-time cents offset from this string's target
              const stringCents = shownFreq ? Math.round(1200 * Math.log2(shownFreq / gs.freq)) : null;
              const stringInTune = stringCents !== null && Math.abs(stringCents) <= 5;
              const stringClose = stringCents !== null && Math.abs(stringCents) <= 15;
              return (
                <button
                  key={gs.string}
                  className={`
                    flex flex-col items-center rounded-lg px-2 py-3 transition-all duration-200 cursor-pointer min-h-[44px] active:scale-95
                    ${isActive
                      ? 'bg-[hsl(var(--color-primary)/0.15)] border-2 border-[hsl(var(--color-primary))]'
                      : isDetected
                        ? isTargetInTune
                          ? 'bg-[hsl(142_71%_45%/0.1)] border border-[hsl(142_71%_45%/0.3)]'
                          : 'bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.3)]'
                        : 'bg-[hsl(var(--bg-surface))] border border-transparent hover:bg-[hsl(var(--bg-overlay))]'
                    }
                  `}
                  onClick={() => {
                    setSelectedString(isActive ? null : gs);
                    playReferenceTone(gs);
                  }}
                >
                  <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">
                    String {gs.string}
                  </span>
                  <span className={`font-display text-lg font-bold ${
                    isActive
                      ? 'text-[hsl(var(--color-primary))]'
                      : isDetected
                        ? isTargetInTune ? 'text-[hsl(142_71%_45%)]' : 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {gs.note}
                  </span>
                  <span className="text-[10px] font-body text-[hsl(var(--text-muted))] tabular-nums">
                    {gs.freq.toFixed(1)} Hz
                  </span>
                  {/* Real-time cents offset readout */}
                  <span className={`text-[10px] font-display font-bold tabular-nums mt-0.5 h-3.5 transition-colors duration-200 ${
                    stringCents === null
                      ? 'text-transparent'
                      : stringInTune
                        ? 'text-[hsl(142_71%_45%)]'
                        : stringClose
                          ? 'text-[hsl(var(--color-emphasis))]'
                          : 'text-[hsl(var(--text-muted)/0.7)]'
                  }`}>
                    {stringCents !== null
                      ? stringInTune
                        ? '✓'
                        : `${stringCents > 0 ? '+' : ''}${stringCents}¢`
                      : '—'}
                  </span>
                  {isPlaying && (
                    <Volume2 className="size-3 mt-0.5 text-[hsl(var(--color-primary))] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>


      </div>
    </div>
  );
}
