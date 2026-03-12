import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChordData } from '@/types/chord';
import { matchWithWeightedTemplate } from '@/lib/chordTemplates';
import { mlMatchesChord, initMLModel, isMLReady } from '@/lib/mlChordDetector';
import type { DetectionEngine } from '@/stores/detectionSettingsStore';

// Standard guitar tuning MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

/** Derive the set of pitch classes (0–11) from a chord's frets array */
function getChordPitchClasses(chord: ChordData): Set<number> {
  const pc = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue; // muted
    const midi = OPEN_STRING_MIDI[i] + fret;
    pc.add(((midi % 12) + 12) % 12);
  }
  return pc;
}

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ─── NSDF (YIN-style) pitch detection for chord detection ───

function autoCorrelateNSDF(buffer: Float32Array, sampleRate: number, rmsThreshold: number): number {
  const windowSize = Math.min(buffer.length, 4096);
  const offset = Math.floor((buffer.length - windowSize) / 2);

  let rms = 0;
  for (let i = offset; i < offset + windowSize; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / windowSize);
  if (rms < rmsThreshold) return -1;

  const halfSize = Math.floor(windowSize / 2);

  const windowed = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    windowed[i] = buffer[offset + i] * w;
  }

  const nsdf = new Float32Array(halfSize);
  const minLag = Math.max(1, Math.floor(sampleRate / 1500));
  const maxLag = Math.min(halfSize - 1, Math.ceil(sampleRate / 60));

  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let divisor = 0;
    const len = windowSize - tau;
    for (let i = 0; i < len; i++) {
      acf += windowed[i] * windowed[i + tau];
      divisor += windowed[i] * windowed[i] + windowed[i + tau] * windowed[i + tau];
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  const threshold = 0.42;
  let bestTau = -1;
  let bestVal = -Infinity;

  let firstZero = minLag;
  while (firstZero <= maxLag && nsdf[firstZero] > 0) {
    firstZero++;
  }

  const peaks: { tau: number; val: number }[] = [];
  let idx = firstZero;
  while (idx <= maxLag) {
    while (idx <= maxLag && nsdf[idx] <= 0) idx++;
    let peakTau = idx;
    let peakVal = nsdf[idx] ?? 0;
    while (idx <= maxLag && nsdf[idx] > 0) {
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

  if (bestTau <= 0 || bestVal < 0.3) return -1;

  let refinedTau = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const prev = nsdf[bestTau - 1];
    const curr = nsdf[bestTau];
    const next = nsdf[bestTau + 1];
    const denominator = 2 * (2 * curr - prev - next);
    if (Math.abs(denominator) > 1e-10) {
      refinedTau = bestTau + (prev - next) / denominator;
    }
  }

  const frequency = sampleRate / refinedTau;
  if (frequency < 60 || frequency > 1400) return -1;
  return frequency;
}

export type DetectionResult = 'correct' | 'wrong' | null;

export interface AdvancedDetectionSettings {
  noiseGate: number;       // 0-100
  harmonicBoost: number;   // 0-100
  fluxTolerance: number;   // 0-100
}

interface UseChordDetectionOptions {
  onCorrect?: () => void;
  targetChord?: ChordData | null;
  /** 1 (strict) – 10 (lenient). Default 6. */
  sensitivity?: number;
  /** If true, auto-start listening on mount */
  autoStart?: boolean;
  /** Optional advanced per-parameter overrides. */
  advancedSettings?: AdvancedDetectionSettings | null;
  /** Detection engine mode: 'dsp' | 'ml' | 'hybrid' (default: 'hybrid') */
  detectionEngine?: DetectionEngine;
}

export function useChordDetection({
  onCorrect,
  targetChord,
  sensitivity = 6,
  autoStart = false,
  advancedSettings = null,
  detectionEngine = 'hybrid',
}: UseChordDetectionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<DetectionResult>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const onCorrectRef = useRef(onCorrect);
  const targetChordRef = useRef(targetChord);
  const sensitivityRef = useRef(sensitivity);
  const isListeningRef = useRef(false);
  const timeDomainBufferRef = useRef<Float32Array | null>(null);
  const prevFreqDataRef = useRef<Float32Array | null>(null);
  const advancedSettingsRef = useRef(advancedSettings);
  const detectionEngineRef = useRef(detectionEngine);

  // Initialize ML model in background — non-blocking, won't stall AudioContext
  useEffect(() => {
    if (detectionEngine === 'ml' || detectionEngine === 'hybrid') {
      // Defer ML init to avoid blocking audio startup
      const timer = setTimeout(() => {
        initMLModel().then(() => {
          console.log('[FretMaster] ML model ready for detection');
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [detectionEngine]);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);

  useEffect(() => {
    targetChordRef.current = targetChord;
    setResult(null);
    cooldownRef.current = false;
  }, [targetChord]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    advancedSettingsRef.current = advancedSettings;
  }, [advancedSettings]);

  useEffect(() => {
    detectionEngineRef.current = detectionEngine;
  }, [detectionEngine]);

  const stopListening = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    timeDomainBufferRef.current = null;
    prevFreqDataRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    setResult(null);
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    console.log('[FretMaster] Starting microphone...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;
      console.log('[FretMaster] Microphone stream acquired, tracks:', stream.getAudioTracks().length);

      // Create AudioContext — let browser choose optimal sample rate
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: 48000 });
      } catch {
        // Fallback: some browsers reject explicit sampleRate
        console.warn('[FretMaster] 48kHz AudioContext failed, using default');
        ctx = new AudioContext();
      }
      // Ensure AudioContext is running
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;
      console.log('[FretMaster] AudioContext created, sampleRate:', ctx.sampleRate, 'state:', ctx.state);

      const source = ctx.createMediaStreamSource(stream);

      // High-pass filter to remove low-frequency rumble below guitar range
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 70;
      highPass.Q.value = 0.71;
      source.connect(highPass);

      // Notch out 50/60 Hz mains hum harmonics
      const notch1 = ctx.createBiquadFilter();
      notch1.type = 'notch';
      notch1.frequency.value = 50;
      notch1.Q.value = 10;
      highPass.connect(notch1);

      const notch2 = ctx.createBiquadFilter();
      notch2.type = 'notch';
      notch2.frequency.value = 60;
      notch2.Q.value = 10;
      notch1.connect(notch2);

      // Broader boost in guitar fundamental range (80-400 Hz)
      const midBoost = ctx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 200;
      midBoost.Q.value = 0.5;
      midBoost.gain.value = 5;
      notch2.connect(midBoost);

      // Secondary boost for 2nd/3rd harmonic range (400-800 Hz)
      const harmonicBoostFilter = ctx.createBiquadFilter();
      harmonicBoostFilter.type = 'peaking';
      harmonicBoostFilter.frequency.value = 500;
      harmonicBoostFilter.Q.value = 0.7;
      harmonicBoostFilter.gain.value = 3;
      midBoost.connect(harmonicBoostFilter);

      // Tighter low-pass: guitar useful harmonics are below 3kHz
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3000;
      lowPass.Q.value = 0.5;
      harmonicBoostFilter.connect(lowPass);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384;
      analyser.smoothingTimeConstant = 0.65;
      lowPass.connect(analyser);
      analyserRef.current = analyser;
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize);

      isListeningRef.current = true;
      setIsListening(true);
      setPermissionDenied(false);

      // Final resume check
      if (ctx.state !== 'running') {
        console.warn('[FretMaster] AudioContext not running after setup, state:', ctx.state);
        await ctx.resume();
      }
      console.log('[FretMaster] Audio pipeline ready, starting analysis loop');

      // Consecutive match tracking for debounced confirmation
      let consecutiveMatches = 0;
      let consecutiveMisses = 0;
      let activeSignalFrames = 0;
      let logCounter = 0;
      const MATCH_THRESHOLD = 3;    // ~210ms
      const MISS_THRESHOLD = 3;
      const MIN_ACTIVE_FRAMES = 3;

      // Analysis loop at ~14 Hz
      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || cooldownRef.current || !audioContextRef.current) return;

        // Auto-resume AudioContext if browser suspended it
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
          return;
        }
        if (audioContextRef.current.state !== 'running') return;

        const chord = targetChordRef.current;
        if (!chord) return;

        const sens = sensitivityRef.current;
        const t = (sens - 1) / 9;
        const adv = advancedSettingsRef.current;
        const engine = detectionEngineRef.current;

        const tNoise = adv ? adv.noiseGate / 100 : t;
        const tFlux = adv ? adv.fluxTolerance / 100 : t;
        const effectiveSensForChroma = adv ? 1 + (adv.harmonicBoost / 100) * 9 : sens;

        // Periodic diagnostic log (every ~5 seconds)
        logCounter++;
        if (logCounter % 70 === 1) {
          console.log('[FretMaster] Detection tick #' + logCounter + ' | target:', chord.symbol, '| engine:', engine, '| sensitivity:', sens, '| ML ready:', isMLReady());
        }

        const bufLen = analyserRef.current.frequencyBinCount;
        const freqData = new Float32Array(bufLen);
        analyserRef.current.getFloatFrequencyData(freqData);

        // ─── Spectral Flux ───
        let spectralFlux = -1;
        const prevFreq = prevFreqDataRef.current;
        if (prevFreq && prevFreq.length === bufLen && audioContextRef.current) {
          const sr = audioContextRef.current.sampleRate;
          const ffts = analyserRef.current.fftSize;
          const bw = sr / ffts;
          const fMinBin = Math.floor(70 / bw);
          const fMaxBin = Math.min(Math.ceil(2500 / bw), bufLen);
          let flux = 0;
          let fluxCount = 0;
          for (let bin = fMinBin; bin < fMaxBin; bin++) {
            const diff = freqData[bin] - prevFreq[bin];
            if (diff > 0) flux += diff;
            fluxCount++;
          }
          spectralFlux = fluxCount > 0 ? flux / fluxCount : 0;
        }
        if (!prevFreqDataRef.current || prevFreqDataRef.current.length !== bufLen) {
          prevFreqDataRef.current = new Float32Array(bufLen);
        }
        prevFreqDataRef.current.set(freqData);

        // Hard RMS silence gate
        let nsdfPitch = -1;
        if (timeDomainBufferRef.current) {
          analyserRef.current.getFloatTimeDomainData(timeDomainBufferRef.current);
          const rmsThreshold = lerp(0.018, 0.005, tNoise);
          let rmsSum = 0;
          const buf = timeDomainBufferRef.current;
          const rmsLen = Math.min(buf.length, 4096);
          for (let i = 0; i < rmsLen; i++) rmsSum += buf[i] * buf[i];
          const rms = Math.sqrt(rmsSum / rmsLen);

          // Log RMS periodically so user can see if audio is flowing
          if (logCounter % 70 === 1) {
            console.log('[FretMaster] RMS:', rms.toFixed(6), '| threshold:', rmsThreshold.toFixed(6), '| gate:', rms < rmsThreshold ? 'BLOCKED' : 'PASS');
          }

          if (rms < rmsThreshold) {
            consecutiveMatches = 0;
            consecutiveMisses = 0;
            activeSignalFrames = 0;
            return;
          }
          nsdfPitch = autoCorrelateNSDF(buf, audioContextRef.current.sampleRate, rmsThreshold);
        }

        const chroma = extractChroma(freqData, analyserRef.current, effectiveSensForChroma, nsdfPitch);
        if (!chroma) {
          consecutiveMatches = 0;
          consecutiveMisses = 0;
          return;
        }

        activeSignalFrames++;

        // ─── Voice rejection gates ───
        const spectralFlatness = computeSpectralFlatness(freqData, analyserRef.current);
        const maxFlatness = lerp(0.20, 0.40, tNoise);
        if (spectralFlatness > maxFlatness) {
          consecutiveMatches = 0;
          return;
        }

        const crestFactor = computeSpectralCrest(freqData, analyserRef.current);
        const minCrest = lerp(3.0, 1.5, tNoise);
        if (crestFactor < minCrest) {
          consecutiveMatches = 0;
          return;
        }

        const formantScore = computeFormantScore(freqData, analyserRef.current);
        const maxFormant = lerp(0.25, 0.55, tNoise);
        if (formantScore > maxFormant) {
          consecutiveMatches = 0;
          return;
        }

        if (spectralFlux >= 0) {
          const maxFlux = lerp(1.5, 3.5, tFlux);
          if (spectralFlux > maxFlux) {
            consecutiveMatches = 0;
            return;
          }
        }

        // ─── Chord matching using selected engine ───
        let isMatch = false;

        if (engine === 'dsp') {
          // DSP-only: weighted template matching (upgraded from flat binary)
          const dspResult = matchWithWeightedTemplate(chroma, chord, effectiveSensForChroma);
          isMatch = dspResult.isMatch;
        } else if (engine === 'ml') {
          // ML-only: neural network classification
          const mlResult = mlMatchesChord(chroma, chord, effectiveSensForChroma);
          isMatch = mlResult.isMatch;
        } else {
          // Hybrid: combine DSP + ML with voting
          const dspResult = matchWithWeightedTemplate(chroma, chord, effectiveSensForChroma);
          const mlResult = mlMatchesChord(chroma, chord, effectiveSensForChroma);

          // Hybrid decision logic:
          // - Both agree → use that result
          // - DSP match + ML high confidence (>0.10) → match
          // - ML match + DSP confidence > 0.40 → match
          // - Otherwise → no match
          if (dspResult.isMatch && mlResult.isMatch) {
            isMatch = true;
          } else if (dspResult.isMatch && mlResult.mlConfidence > 0.10) {
            isMatch = true;
          } else if (mlResult.isMatch && dspResult.confidence > 0.40) {
            isMatch = true;
          } else {
            // Combined confidence threshold — if both are borderline, accept
            const combinedConfidence = (dspResult.confidence * 0.55) + (mlResult.mlConfidence * 0.45);
            const hybridThreshold = lerp(0.55, 0.30, t);
            isMatch = combinedConfidence >= hybridThreshold;
          }
        }

        if (isMatch) {
          if (activeSignalFrames >= MIN_ACTIVE_FRAMES) {
            consecutiveMatches++;
          }
          consecutiveMisses = 0;

          if (consecutiveMatches >= MATCH_THRESHOLD) {
            consecutiveMatches = 0;
            cooldownRef.current = true;
            setResult('correct');
            setTimeout(() => {
              onCorrectRef.current?.();
              setResult(null);
              cooldownRef.current = false;
            }, 1500);
          }
        } else {
          consecutiveMisses++;
          consecutiveMatches = 0;

          if (consecutiveMisses >= MISS_THRESHOLD) {
            consecutiveMisses = 0;
            cooldownRef.current = true;
            setResult('wrong');
            setTimeout(() => {
              setResult(null);
              cooldownRef.current = false;
            }, 1800);
          }
        }
      }, 70);
    } catch (e: any) {
      console.error('[FretMaster] Microphone error:', e?.name, e?.message, e);
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      } else {
        // Other errors (NotFoundError, NotReadableError, etc.)
        setPermissionDenied(true);
        console.error('[FretMaster] Audio device error — no microphone found or device busy');
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  useEffect(() => {
    if (autoStart && !isListeningRef.current) {
      const t = setTimeout(() => {
        startListening();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [autoStart, startListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const pauseDetection = useCallback((ms: number) => {
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, ms);
  }, []);

  return {
    isListening,
    result,
    permissionDenied,
    toggleListening,
    stopListening,
    pauseDetection,
  };
}

// ─── Spectral analysis functions ───

function computeSpectralFlatness(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;
  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  let logSum = 0;
  let linSum = 0;
  let count = 0;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < -80) continue;
    const lin = Math.pow(10, db / 20);
    logSum += Math.log(lin + 1e-12);
    linSum += lin;
    count++;
  }

  if (count < 10 || linSum <= 0) return 0;
  const geometricMean = Math.exp(logSum / count);
  const arithmeticMean = linSum / count;
  return arithmeticMean > 1e-12 ? geometricMean / arithmeticMean : 0;
}

function computeFormantScore(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;
  const rangeMinHz = 200;
  const rangeMaxHz = 3000;
  const minBin = Math.floor(rangeMinHz / binWidth);
  const maxBin = Math.min(Math.ceil(rangeMaxHz / binWidth), freqData.length);
  const rangeLen = maxBin - minBin;
  if (rangeLen < 30) return 0;

  const linear = new Float64Array(rangeLen);
  for (let i = 0; i < rangeLen; i++) {
    const db = freqData[minBin + i];
    linear[i] = db > -80 ? Math.pow(10, db / 20) : 0;
  }

  const smoothWindow = Math.max(7, Math.round(100 / binWidth));
  const halfWin = Math.floor(smoothWindow / 2);
  const envelope = new Float64Array(rangeLen);
  for (let i = 0; i < rangeLen; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(rangeLen - 1, i + halfWin);
    for (let j = lo; j <= hi; j++) {
      sum += linear[j];
      count++;
    }
    envelope[i] = count > 0 ? sum / count : 0;
  }

  const f1Lo = Math.max(0, Math.floor((300 - rangeMinHz) / binWidth));
  const f1Hi = Math.min(rangeLen, Math.ceil((900 - rangeMinHz) / binWidth));
  let f1Peak = 0;
  let f1PeakIdx = f1Lo;
  for (let i = f1Lo; i < f1Hi; i++) {
    if (envelope[i] > f1Peak) { f1Peak = envelope[i]; f1PeakIdx = i; }
  }

  const f2Lo = Math.max(0, Math.floor((900 - rangeMinHz) / binWidth));
  const f2Hi = Math.min(rangeLen, Math.ceil((2500 - rangeMinHz) / binWidth));
  let f2Peak = 0;
  let f2PeakIdx = f2Lo;
  for (let i = f2Lo; i < f2Hi; i++) {
    if (envelope[i] > f2Peak) { f2Peak = envelope[i]; f2PeakIdx = i; }
  }

  if (f1Peak < 1e-6 || f2Peak < 1e-6) return 0;

  const valleyStart = Math.min(f1PeakIdx, f2PeakIdx) + 1;
  const valleyEnd = Math.max(f1PeakIdx, f2PeakIdx);
  let valleyMin = Infinity;
  for (let i = valleyStart; i < valleyEnd && i < rangeLen; i++) {
    if (envelope[i] < valleyMin) valleyMin = envelope[i];
  }
  if (!isFinite(valleyMin) || valleyMin < 1e-8) valleyMin = 1e-8;

  const f1Prominence = f1Peak / valleyMin;
  const f2Prominence = f2Peak / valleyMin;

  const f1Thresh = f1Peak * 0.7;
  let f1WidthBins = 0;
  for (let i = f1Lo; i < f1Hi; i++) {
    if (envelope[i] >= f1Thresh) f1WidthBins++;
  }
  const f1BandwidthHz = f1WidthBins * binWidth;

  const f2Thresh = f2Peak * 0.7;
  let f2WidthBins = 0;
  for (let i = f2Lo; i < f2Hi; i++) {
    if (envelope[i] >= f2Thresh) f2WidthBins++;
  }
  const f2BandwidthHz = f2WidthBins * binWidth;

  const peakSeparationHz = Math.abs(f2PeakIdx - f1PeakIdx) * binWidth;
  const hasTwoHumpStructure =
    f1Prominence > 1.4 &&
    f2Prominence > 1.3 &&
    f1BandwidthHz >= 60 &&
    f2BandwidthHz >= 40 &&
    peakSeparationHz > 300;

  if (!hasTwoHumpStructure) return 0;

  const prominenceScore = Math.min(1.0,
    ((f1Prominence - 1.0) * 0.25) + ((f2Prominence - 1.0) * 0.25)
  );
  const bandwidthScore = Math.min(1.0,
    (Math.min(f1BandwidthHz, 250) / 250) * 0.3 + (Math.min(f2BandwidthHz, 200) / 200) * 0.2
  );

  return Math.min(1.0, prominenceScore + bandwidthScore);
}

function computeSpectralCrest(freqData: Float32Array, analyser: AnalyserNode): number {
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;
  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  let sumLin = 0;
  let maxLin = 0;
  let count = 0;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < -80) continue;
    const lin = Math.pow(10, db / 20);
    sumLin += lin;
    if (lin > maxLin) maxLin = lin;
    count++;
  }

  if (count < 5 || sumLin <= 0) return 0;
  const meanLin = sumLin / count;
  return meanLin > 0 ? maxLin / meanLin : 0;
}

function extractChroma(
  freqData: Float32Array,
  analyser: AnalyserNode,
  sensitivity: number,
  nsdfPitch: number
): Float64Array | null {
  const t = (sensitivity - 1) / 9;
  const sampleRate = analyser.context.sampleRate;
  const fftSize = analyser.fftSize;
  const binWidth = sampleRate / fftSize;

  const dbFloor = lerp(-40, -72, t);
  const noiseGateEnergy = lerp(18, 4, t);

  const chroma = new Float64Array(12);
  let totalEnergy = 0;

  const minBin = Math.floor(70 / binWidth);
  const maxBin = Math.min(Math.ceil(2500 / binWidth), freqData.length);

  // Spectral whitening
  const octaveBands = [70, 140, 280, 560, 1120, 2500];
  const bandEnergies: number[] = [];
  for (let b = 0; b < octaveBands.length - 1; b++) {
    let sum = 0;
    let count = 0;
    const lo = Math.floor(octaveBands[b] / binWidth);
    const hi = Math.min(Math.ceil(octaveBands[b + 1] / binWidth), freqData.length);
    for (let bin = lo; bin < hi; bin++) {
      if (freqData[bin] > dbFloor) {
        sum += Math.pow(10, (freqData[bin] - dbFloor) / 20);
        count++;
      }
    }
    bandEnergies.push(count > 0 ? sum / count : 0.001);
  }

  const gaussSigma = 0.35;
  const gaussDenom = 2 * gaussSigma * gaussSigma;

  for (let bin = minBin; bin < maxBin; bin++) {
    const db = freqData[bin];
    if (db < dbFloor) continue;

    const magnitude = Math.pow(10, (db - dbFloor) / 20);
    const freq = bin * binWidth;
    if (freq < 65) continue;

    const midi = freqToMidi(freq);
    const fractionalPc = ((midi % 12) + 12) % 12;

    let bandIdx = 0;
    for (let b = 0; b < octaveBands.length - 1; b++) {
      if (freq >= octaveBands[b] && freq < octaveBands[b + 1]) { bandIdx = b; break; }
    }
    const normFactor = bandEnergies[bandIdx] > 0.001 ? 1.0 / bandEnergies[bandIdx] : 1.0;

    const weight = Math.max(0.3, Math.min(2.5, Math.exp(-0.0012 * (freq - 100))));
    const normalizedMag = magnitude * Math.min(normFactor, 5.0) * weight;

    for (let pc = 0; pc < 12; pc++) {
      let dist = Math.abs(fractionalPc - pc);
      if (dist > 6) dist = 12 - dist;
      const gaussWeight = Math.exp(-(dist * dist) / gaussDenom);
      if (gaussWeight > 0.01) {
        chroma[pc] += normalizedMag * gaussWeight;
      }
    }

    totalEnergy += magnitude;
  }

  if (totalEnergy < noiseGateEnergy) return null;

  // Harmonic series reinforcement
  const harmonicReinforcement = new Float64Array(12);
  for (let pc = 0; pc < 12; pc++) {
    if (chroma[pc] < 0.01) continue;
    const h3pc = (pc + 7) % 12;
    const h5pc = (pc + 4) % 12;
    harmonicReinforcement[pc] += (chroma[h3pc] + chroma[h5pc]) * 0.15;
  }
  for (let pc = 0; pc < 12; pc++) {
    chroma[pc] += harmonicReinforcement[pc];
  }

  // NSDF pitch boost
  if (nsdfPitch > 0) {
    const nsdfMidi = freqToMidi(nsdfPitch);
    const nsdfPc = ((Math.round(nsdfMidi) % 12) + 12) % 12;
    const maxChroma = Math.max(...chroma);
    if (maxChroma > 0) {
      chroma[nsdfPc] += maxChroma * 0.30;
      const h3 = (nsdfPc + 7) % 12;
      const h5 = (nsdfPc + 4) % 12;
      chroma[h3] += maxChroma * 0.10;
      chroma[h5] += maxChroma * 0.08;
    }
  }

  // Normalize
  const maxVal = Math.max(...chroma);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }

  return chroma;
}
