import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff, Music, Volume2, X, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTunerStore } from '@/stores/tunerStore';

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

// ─── Pitch detection utilities ───────────────────────────

function frequencyToNoteInfo(freq: number): { note: string; octave: number; cents: number; noteIndex: number } {
  const semitoneOffset = 12 * Math.log2(freq / 440);
  const roundedSemitone = Math.round(semitoneOffset);
  const cents = Math.round((semitoneOffset - roundedSemitone) * 100);
  const rawIndex = roundedSemitone + 9;
  const noteIndex = ((rawIndex % 12) + 12) % 12;
  const octave = Math.floor((roundedSemitone + 9) / 12) + 4;
  return { note: NOTE_STRINGS[noteIndex], octave, cents, noteIndex };
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < ((globalThis as any).__tunerRmsThreshold ?? 0.008)) return -1;

  const size = buffer.length;
  const halfSize = Math.floor(size / 2);

  const nsdf = new Float32Array(halfSize);
  for (let tau = 0; tau < halfSize; tau++) {
    let acf = 0;
    let divisor = 0;
    for (let i = 0; i < halfSize; i++) {
      acf += buffer[i] * buffer[i + tau];
      divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  const threshold = 0.35;
  const peaks: { tau: number; val: number }[] = [];

  let firstZero = 1;
  while (firstZero < halfSize - 1 && nsdf[firstZero] > 0) {
    firstZero++;
  }

  let idx = firstZero;
  while (idx < halfSize - 1) {
    while (idx < halfSize - 1 && nsdf[idx] <= 0) idx++;
    let peakTau = idx;
    let peakVal = nsdf[idx];
    while (idx < halfSize - 1 && nsdf[idx] > 0) {
      if (nsdf[idx] > peakVal) {
        peakVal = nsdf[idx];
        peakTau = idx;
      }
      idx++;
    }
    if (peakVal >= 0.2) {
      peaks.push({ tau: peakTau, val: peakVal });
    }
  }

  if (peaks.length === 0) return -1;

  let bestTau = -1;
  let bestVal = -Infinity;
  for (const p of peaks) {
    if (p.val >= threshold) {
      bestTau = p.tau;
      bestVal = p.val;
      break;
    }
  }

  if (bestTau <= 0) {
    for (const p of peaks) {
      if (p.val > bestVal) {
        bestVal = p.val;
        bestTau = p.tau;
      }
    }
  }

  if (bestTau <= 0 || bestVal < 0.2) return -1;

  let refinedTau = bestTau;
  if (bestTau > 0 && bestTau < halfSize - 1) {
    const prev = nsdf[bestTau - 1];
    const curr = nsdf[bestTau];
    const next = nsdf[bestTau + 1];
    const denominator = 2 * (2 * curr - prev - next);
    if (Math.abs(denominator) > 1e-10) {
      refinedTau = bestTau + (prev - next) / denominator;
    }
  }

  const frequency = sampleRate / refinedTau;
  if (frequency < 50 || frequency > 1400) return -1;
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

export default function TunerPanel() {
  const { isOpen, close } = useTunerStore();
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
    return saved !== null ? Number(saved) : 60;
  });
  const sensitivityRef = useRef(60);
  const startedRef = useRef(false);
  const inTuneStartRef = useRef<number>(0);
  const inTuneSoundPlayedRef = useRef(false);
  const selectedStringRef = useRef<GuitarString | null>(null);
  const selectedTuningRef = useRef<TuningPreset>(TUNING_PRESETS[0]);

  const [displayNote, setDisplayNote] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [displayFreq, setDisplayFreq] = useState<number | null>(null);
  const [displayClosest, setDisplayClosest] = useState<GuitarString | null>(null);
  const holdTimerRef = useRef<number>(0);
  const smoothedFreqRef = useRef<number | null>(null);

  useEffect(() => { selectedStringRef.current = selectedString; }, [selectedString]);
  useEffect(() => { selectedTuningRef.current = selectedTuning; }, [selectedTuning]);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
    localStorage.setItem('tuner-mic-sensitivity', String(sensitivity));
  }, [sensitivity]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tuningDropdownRef.current && !tuningDropdownRef.current.contains(e.target as Node)) {
        setTuningDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    smoothedFreqRef.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      });
      const ctx = new AudioContext();

      const source = ctx.createMediaStreamSource(stream);
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 40;
      highPass.Q.value = 0.5;
      source.connect(highPass);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      highPass.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      sourceRef.current = source;
      bufferRef.current = new Float32Array(analyser.fftSize);

      getChimeCtx();

      setIsListening(true);
      setPermissionDenied(false);

      const detect = () => {
        if (!analyserRef.current || !bufferRef.current || !audioCtxRef.current) return;

        const s = sensitivityRef.current;
        const rmsThreshold = 0.05 * Math.pow(0.02, s / 100);
        (globalThis as any).__tunerRmsThreshold = rmsThreshold;

        analyserRef.current.getFloatTimeDomainData(bufferRef.current);
        const rawFreq = autoCorrelate(bufferRef.current, audioCtxRef.current.sampleRate);

        if (rawFreq > 0) {
          let freq = rawFreq;
          if (smoothedFreqRef.current !== null) {
            const ratio = rawFreq / smoothedFreqRef.current;
            if (ratio > 0.97 && ratio < 1.03) {
              freq = smoothedFreqRef.current * 0.75 + rawFreq * 0.25;
            } else if (ratio > 0.93 && ratio < 1.07) {
              freq = smoothedFreqRef.current * 0.5 + rawFreq * 0.5;
            }
          }
          smoothedFreqRef.current = freq;
          setFrequency(freq);
          const info = frequencyToNoteInfo(freq);
          setNoteInfo(info);
          const closest = findClosestString(freq, selectedTuningRef.current.strings);
          setClosestString(closest);
          setDisplayNote(info);
          setDisplayFreq(freq);
          setDisplayClosest(closest);
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = 0; }

          const target = selectedStringRef.current ?? closest;
          const centsOff = target ? Math.round(1200 * Math.log2(freq / target.freq)) : info.cents;
          const absCents = Math.abs(centsOff);
          if (absCents <= 5) {
            if (inTuneStartRef.current === 0) inTuneStartRef.current = performance.now();
            if (!inTuneSoundPlayedRef.current && performance.now() - inTuneStartRef.current >= 500) {
              inTuneSoundPlayedRef.current = true;
              setInTuneConfirmed(true);
              playCowbellSound();
            }
          } else if (absCents > 12) {
            inTuneStartRef.current = 0;
            inTuneSoundPlayedRef.current = false;
            setInTuneConfirmed(false);
          }
        } else {
          setFrequency(null);
          setNoteInfo(null);
          setClosestString(null);
          if (!holdTimerRef.current) {
            holdTimerRef.current = window.setTimeout(() => {
              setDisplayNote(null);
              setDisplayFreq(null);
              setDisplayClosest(null);
              smoothedFreqRef.current = null;
              holdTimerRef.current = 0;
            }, 400);
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

  const playReferenceTone = useCallback((gs: GuitarString) => {
    const ctx = new AudioContext();
    const duration = 3.0;
    const now = ctx.currentTime;
    const freq = gs.freq;

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

    const harmonics = [
      { h: 1, amp: 1.00, decay: 0.38 },
      { h: 2, amp: 0.72, decay: 0.32 },
      { h: 3, amp: 0.50, decay: 0.26 },
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
      osc.type = h <= 3 ? 'triangle' : 'sine';
      osc.frequency.value = partialFreq * (1 + 0.00005 * h * h);

      const pGain = ctx.createGain();
      const attackAmp = amp * 0.65;
      pGain.gain.setValueAtTime(0, now);
      pGain.gain.linearRampToValueAtTime(attackAmp, now + 0.001);
      pGain.gain.setTargetAtTime(attackAmp * 0.5, now + 0.002, 0.03);
      pGain.gain.setTargetAtTime(0.0001, now + 0.06, duration * decay);

      osc.connect(pGain);
      pGain.connect(bodyLow);
      osc.start(now);
      osc.stop(now + duration);
    });

    const pluckLen = Math.floor(ctx.sampleRate * 0.035);
    const pluckBuf = ctx.createBuffer(1, pluckLen, ctx.sampleRate);
    const pluckData = pluckBuf.getChannelData(0);
    for (let i = 0; i < pluckLen; i++) {
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

  // Auto-start listening when panel opens
  useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      startListening();
    }
    if (!isOpen && startedRef.current) {
      startedRef.current = false;
      stopListening();
    }
  }, [isOpen, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  const shownNote = displayNote;
  const shownFreq = displayFreq;
  const shownClosest = displayClosest;

  const cents = shownNote?.cents ?? 0;
  const isInTune = Math.abs(cents) <= 5;
  const isClose = Math.abs(cents) <= 15;

  const targetString = selectedString ?? shownClosest;
  const centsFromTarget = targetString && shownFreq
    ? Math.round(1200 * Math.log2(shownFreq / targetString.freq))
    : cents;
  const isTargetInTune = Math.abs(centsFromTarget) <= 5;
  const isTargetClose = Math.abs(centsFromTarget) <= 15;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 80 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed inset-x-0 top-0 bottom-[56px] sm:bottom-0 z-40 flex flex-col bg-[hsl(var(--bg-base))]"
    >
      {/* Scrollable tuner content */}
      <div className="flex-1 overflow-y-auto stage-gradient">
        {/* Header */}
        <div className="relative px-4 sm:px-6 pt-8 pb-4 text-center max-w-3xl mx-auto">
          {/* Close button */}
          <button
            onClick={() => { stopListening(); close(); }}
            className="absolute top-8 left-4 sm:left-6 flex items-center justify-center size-10 sm:size-8 rounded-lg hover:bg-[hsl(var(--color-primary)/0.12)] transition-colors active:scale-90 z-10"
            title="Close tuner"
          >
            <X className="size-6 text-[hsl(var(--color-primary))]" />
          </button>
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
                <ChevronDown className={`size-7 text-[hsl(var(--color-primary))] transition-transform duration-200 ${tuningDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={3} />
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

        <div className="px-4 sm:px-6 pb-6 max-w-xl mx-auto space-y-4">
          {permissionDenied && (
            <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5 text-center justify-center">
              <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
              <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">
                Microphone access denied. Please allow mic access in browser settings.
              </span>
            </div>
          )}

          {/* Main tuner display */}
          <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
            <div className="space-y-4">
              {/* Detected note */}
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
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
                          ? 'text-[hsl(45_93%_47%)]'
                          : 'text-[rgb(220,38,38)]'
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
                <p className={`mt-1 text-sm font-body text-[hsl(var(--text-subtle))] h-5 transition-opacity duration-200 ${targetString && shownNote ? 'opacity-100' : 'opacity-0'}`}>
                  {targetString ? `Target: ${targetString.note} (${targetString.freq.toFixed(1)} Hz)` : '\u00A0'}
                </p>
              </div>

              {/* Segmented cents meter */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-[2px] px-1">
                  {Array.from({ length: 41 }, (_, i) => {
                    const segCents = (i - 20) * 2.5;
                    const isCenter = i === 20;
                    const absSegCents = Math.abs(segCents);

                    let hue: string;
                    if (absSegCents <= 5) hue = '142 71% 45%';
                    else if (absSegCents <= 15) hue = '45 93% 47%';
                    else hue = '0 72% 51%';

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
                      if (isCenter && Math.abs(cur) <= 5) lit = true;
                    }

                    return (
                      <div
                        key={i}
                        className="rounded-sm transition-all duration-150"
                        style={{
                          width: isCenter ? 6 : 4,
                          height: isCenter ? 84 : absSegCents <= 5 ? 68 : absSegCents <= 15 ? 60 : 52,
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
                <div className="flex justify-between items-center text-[12px] font-body text-[hsl(var(--text-subtle))]">
                  <span>♭ Flat</span>
                  <span className={`font-display text-sm font-bold tabular-nums transition-colors duration-300 ${
                    !shownNote ? 'text-[hsl(var(--text-muted)/0.4)]' : isTargetInTune ? 'text-[hsl(142_71%_45%)]' : isTargetClose ? 'text-[hsl(var(--color-emphasis))]' : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {shownNote ? `${centsFromTarget > 0 ? '+' : ''}${centsFromTarget} cents` : '0 cents'}
                  </span>
                  <span>Sharp ♯</span>
                </div>
              </div>

              {/* Status text — fixed height to prevent layout shift */}
              <div className="text-center h-7 flex items-center justify-center">
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

              {/* Mic sensitivity */}
              <div className="space-y-2 !mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-display font-semibold text-[hsl(var(--text-subtle))] uppercase tracking-wider flex items-center gap-1.5">
                    <Mic className="size-3.5" />
                    Mic Sensitivity
                  </label>
                  <span className="text-sm font-body tabular-nums text-[hsl(var(--text-subtle))]">{sensitivity}%</span>
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
                <div className="flex justify-between text-[12px] font-body text-[hsl(var(--text-muted))]">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

            </div>
          </div>

          {/* String selector + reference tones */}
          <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-subtle))] uppercase tracking-wider">
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
            <div className="flex gap-1 sm:gap-2">
              {activeStrings.map((gs) => {
                const isActive = selectedString?.string === gs.string;
                const isDetected = !selectedString && shownClosest?.string === gs.string && isListening && shownFreq !== null;
                const isPlaying = playingString === gs.string;
                const stringCents = shownFreq ? Math.round(1200 * Math.log2(shownFreq / gs.freq)) : null;
                const stringInTune = stringCents !== null && Math.abs(stringCents) <= 5;
                const stringClose = stringCents !== null && Math.abs(stringCents) <= 15;
                // String gauge thickness — mirrors physical string diameter (6=thickest, 1=thinnest)
                const gaugeHeight = [0, 1, 1.5, 2, 3, 3.5, 4][gs.string];
                return (
                  <button
                    key={gs.string}
                    className={`
                      flex-1 flex flex-col items-center rounded-lg px-0.5 sm:px-2 py-2 sm:py-3 transition-all duration-200 cursor-pointer min-h-[44px] active:scale-95
                      ${(isActive || isDetected) && stringInTune
                        ? 'bg-[hsl(142_71%_45%/0.18)] border-2 border-[hsl(142_71%_45%/0.5)] shadow-[0_0_14px_hsl(142_71%_45%/0.3)]'
                        : isActive
                          ? 'bg-[hsl(var(--color-primary)/0.15)] border-2 border-[hsl(var(--color-primary))]'
                          : isDetected
                            ? 'bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.3)]'
                            : 'bg-[hsl(var(--bg-surface))] border border-transparent hover:bg-[hsl(var(--bg-overlay))]'
                      }
                    `}
                    onClick={() => {
                      setSelectedString(isActive ? null : gs);
                      playReferenceTone(gs);
                    }}
                  >
                    {/* String gauge — realistic wound/plain representation */}
                    <div className="flex items-center justify-center w-full h-[7px] mb-1.5">
                    <div
                      className="w-4/5 rounded-full"
                      style={{
                        height: [0, 2, 2.5, 3, 5, 6, 7][gs.string],
                        background: (isActive || isDetected) && stringInTune
                          ? 'linear-gradient(180deg, hsl(142 71% 58%), hsl(142 71% 38%), hsl(142 71% 58%))'
                          : isActive
                            ? 'linear-gradient(180deg, hsl(38 75% 65%), hsl(38 75% 45%), hsl(38 75% 65%))'
                            : gs.string >= 4
                              ? 'repeating-linear-gradient(90deg, hsl(40 22% 72%) 0px, hsl(33 14% 52%) 1px, hsl(40 22% 74%) 2px, hsl(33 14% 56%) 3px)'
                              : 'linear-gradient(180deg, hsl(40 10% 82%), hsl(33 8% 58%), hsl(40 10% 82%))',
                        boxShadow: (isActive || isDetected) && stringInTune
                          ? '0 0 8px hsl(142 71% 45% / 0.5)'
                          : gs.string >= 4
                            ? '0 0.5px 1px hsl(0 0% 0% / 0.3)'
                            : 'none',
                      }}
                    />
                    </div>
                    <span className="text-[12px] sm:text-[18px] font-body text-[hsl(var(--text-default)/0.65)] text-center leading-tight">
                      <span className="block">String</span>
                      <span className="block">{gs.string}</span>
                    </span>
                    <span className={`font-display text-[22px] sm:text-[28px] font-bold leading-tight ${
                      isActive
                        ? 'text-[hsl(var(--color-primary))]'
                        : isDetected
                          ? stringInTune
                            ? 'text-[hsl(142_71%_45%)]'
                            : stringClose
                              ? 'text-[hsl(45_93%_47%)]'
                              : 'text-[rgb(220,38,38)]'
                          : 'text-[hsl(var(--text-default))]'
                    }`}>
                      <span className="sm:hidden">{gs.display}</span>
                      <span className="hidden sm:inline">{gs.note}</span>
                    </span>

                    <span className={`text-[12px] sm:text-[18px] font-display font-bold tabular-nums mt-0.5 h-4 sm:h-5 transition-colors duration-200 ${
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
                          : `${stringCents > 0 ? '+' : ''}${stringCents}c`
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
    </motion.div>
  );
}
