import { useState, useCallback, useRef, useEffect } from 'react';
import { usePracticeHistoryStore, type CalibrationProfile } from '@/stores/practiceHistoryStore';
import { useDetectionSettingsStore, type StringCalibration, type PerStringCalibration } from '@/stores/detectionSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Volume2, Check, ChevronRight, AlertCircle, Trash2, Upload, Zap, Guitar } from 'lucide-react';

type WizardStep = 'intro' | 'silence' | 'strum' | 'strings' | 'results' | 'save';

const OPEN_STRINGS = [
  { index: 0, note: 'E2', display: 'E', freq: 82.41, stringNum: 6 },
  { index: 1, note: 'A2', display: 'A', freq: 110.00, stringNum: 5 },
  { index: 2, note: 'D3', display: 'D', freq: 146.83, stringNum: 4 },
  { index: 3, note: 'G3', display: 'G', freq: 196.00, stringNum: 3 },
  { index: 4, note: 'B3', display: 'B', freq: 246.94, stringNum: 2 },
  { index: 5, note: 'E4', display: 'E', freq: 329.63, stringNum: 1 },
];

interface MeasuredData {
  noiseFloorRms: number;
  signalRms: number;
  signalCrest: number;
  signalFlux: number;
  suggestedNoiseGate: number;
  suggestedHarmonicBoost: number;
  suggestedFluxTolerance: number;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
          i < current ? 'w-6 bg-[hsl(var(--color-primary))]' :
          i === current ? 'w-6 bg-[hsl(var(--color-emphasis))]' :
          'w-3 bg-[hsl(var(--border-default))]'
        }`} />
      ))}
    </div>
  );
}

// NSDF pitch detection for per-string measurement
function detectPitchNSDF(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  const windowSize = Math.min(buffer.length, 4096);
  const offset = Math.floor((buffer.length - windowSize) / 2);

  let rms = 0;
  for (let i = offset; i < offset + windowSize; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / windowSize);
  if (rms < 0.005) return null;

  const halfSize = Math.floor(windowSize / 2);
  const windowed = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    windowed[i] = buffer[offset + i] * w;
  }

  const minLag = Math.max(1, Math.floor(sampleRate / 1500));
  const maxLag = Math.min(halfSize - 1, Math.ceil(sampleRate / 55));

  const nsdf = new Float32Array(halfSize);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0, divisor = 0;
    const len = windowSize - tau;
    for (let i = 0; i < len; i++) {
      acf += windowed[i] * windowed[i + tau];
      divisor += windowed[i] * windowed[i] + windowed[i + tau] * windowed[i + tau];
    }
    nsdf[tau] = divisor > 0 ? (2 * acf) / divisor : 0;
  }

  let firstZero = minLag;
  while (firstZero <= maxLag && nsdf[firstZero] > 0) firstZero++;

  const peaks: { tau: number; val: number }[] = [];
  let idx = firstZero;
  while (idx <= maxLag) {
    while (idx <= maxLag && nsdf[idx] <= 0) idx++;
    let peakTau = idx, peakVal = nsdf[idx] ?? 0;
    while (idx <= maxLag && nsdf[idx] > 0) {
      if (nsdf[idx] > peakVal) { peakVal = nsdf[idx]; peakTau = idx; }
      idx++;
    }
    if (peakVal >= 0.2) peaks.push({ tau: peakTau, val: peakVal });
  }
  if (peaks.length === 0) return null;

  let bestTau = -1, bestVal = -Infinity;
  for (const p of peaks) {
    if (p.val >= 0.42) { bestTau = p.tau; bestVal = p.val; break; }
  }
  if (bestTau <= 0) {
    for (const p of peaks) { if (p.val > bestVal) { bestVal = p.val; bestTau = p.tau; } }
  }
  if (bestTau <= 0 || bestVal < 0.25) return null;

  let refinedTau = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const prev = nsdf[bestTau - 1], curr = nsdf[bestTau], next = nsdf[bestTau + 1];
    const denom = 2 * (2 * curr - prev - next);
    if (Math.abs(denom) > 1e-10) refinedTau = bestTau + (prev - next) / denom;
  }

  const freq = sampleRate / refinedTau;
  if (freq < 55 || freq > 1400) return null;
  return { freq, confidence: bestVal };
}

interface CalibrationWizardProps {
  open: boolean;
  onClose: () => void;
}

export default function CalibrationWizard({ open, onClose }: CalibrationWizardProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [measuring, setMeasuring] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [measured, setMeasured] = useState<MeasuredData | null>(null);
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Per-string state
  const [currentStringIndex, setCurrentStringIndex] = useState(0);
  const [stringResults, setStringResults] = useState<(StringCalibration | null)[]>([null, null, null, null, null, null]);
  const [stringMeasuring, setStringMeasuring] = useState(false);
  const [stringCountdown, setStringCountdown] = useState(0);
  const [stringDetectedFreq, setStringDetectedFreq] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const measureIntervalRef = useRef<number>(0);
  const rmsValuesRef = useRef<number[]>([]);
  const crestValuesRef = useRef<number[]>([]);
  const fluxValuesRef = useRef<number[]>([]);
  const prevFreqRef = useRef<Float32Array | null>(null);

  // Per-string measurement refs
  const stringStreamRef = useRef<MediaStream | null>(null);
  const stringCtxRef = useRef<AudioContext | null>(null);
  const stringAnalyserRef = useRef<AnalyserNode | null>(null);
  const stringIntervalRef = useRef<number>(0);
  const stringFreqReadingsRef = useRef<number[]>([]);
  const stringRmsReadingsRef = useRef<number[]>([]);
  const stringCrestReadingsRef = useRef<number[]>([]);

  const { calibrationProfiles, addCalibrationProfile, deleteCalibrationProfile } = usePracticeHistoryStore();
  const { applyCalibrationProfile, setPerStringCalibration } = useDetectionSettingsStore();

  const cleanup = useCallback(() => {
    if (measureIntervalRef.current) { clearInterval(measureIntervalRef.current); measureIntervalRef.current = 0; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    analyserRef.current = null;
    prevFreqRef.current = null;
  }, []);

  const cleanupString = useCallback(() => {
    if (stringIntervalRef.current) { clearInterval(stringIntervalRef.current); stringIntervalRef.current = 0; }
    if (stringStreamRef.current) { stringStreamRef.current.getTracks().forEach(t => t.stop()); stringStreamRef.current = null; }
    if (stringCtxRef.current) { stringCtxRef.current.close(); stringCtxRef.current = null; }
    stringAnalyserRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      cleanupString();
      setStep('intro');
      setMeasured(null);
      setError(null);
      setMeasuring(false);
      setCurrentStringIndex(0);
      setStringResults([null, null, null, null, null, null]);
      setStringMeasuring(false);
      setStringDetectedFreq(null);
    }
    return () => { cleanup(); cleanupString(); };
  }, [open, cleanup, cleanupString]);

  const startMeasurement = useCallback(async (phase: 'silence' | 'strum') => {
    setError(null);
    setMeasuring(true);
    rmsValuesRef.current = [];
    crestValuesRef.current = [];
    fluxValuesRef.current = [];
    prevFreqRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: { ideal: 48000 } },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      if (ctx.state === 'suspended') await ctx.resume();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70; hp.Q.value = 0.71;
      source.connect(hp);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.6;
      hp.connect(analyser);
      analyserRef.current = analyser;

      const durationSec = phase === 'silence' ? 3 : 5;
      let elapsed = 0;
      setCountdown(durationSec);

      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownInterval); return 0; }
          return prev - 1;
        });
      }, 1000);

      measureIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || !ctxRef.current) return;
        elapsed += 80;

        const timeBuf = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(timeBuf);
        let rmsSum = 0;
        for (let i = 0; i < timeBuf.length; i++) rmsSum += timeBuf[i] * timeBuf[i];
        const rms = Math.sqrt(rmsSum / timeBuf.length);
        rmsValuesRef.current.push(rms);

        const freqBuf = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatFrequencyData(freqBuf);
        const sr = ctxRef.current.sampleRate;
        const bw = sr / analyserRef.current.fftSize;
        const minBin = Math.floor(70 / bw);
        const maxBin = Math.min(Math.ceil(2500 / bw), freqBuf.length);

        let sumLin = 0, maxLin = 0, count = 0;
        for (let b = minBin; b < maxBin; b++) {
          if (freqBuf[b] < -80) continue;
          const lin = Math.pow(10, freqBuf[b] / 20);
          sumLin += lin; if (lin > maxLin) maxLin = lin; count++;
        }
        if (count > 5 && sumLin > 0) {
          crestValuesRef.current.push(maxLin / (sumLin / count));
        }

        if (prevFreqRef.current && prevFreqRef.current.length === freqBuf.length) {
          let flux = 0, fluxCount = 0;
          for (let b = minBin; b < maxBin; b++) {
            const diff = freqBuf[b] - prevFreqRef.current[b];
            if (diff > 0) flux += diff;
            fluxCount++;
          }
          if (fluxCount > 0) fluxValuesRef.current.push(flux / fluxCount);
        }
        prevFreqRef.current = new Float32Array(freqBuf);

        if (elapsed >= durationSec * 1000) {
          clearInterval(measureIntervalRef.current);
          clearInterval(countdownInterval);
          measureIntervalRef.current = 0;
          setMeasuring(false);

          if (phase === 'silence') {
            const avgRms = rmsValuesRef.current.length > 0
              ? rmsValuesRef.current.reduce((a, b) => a + b, 0) / rmsValuesRef.current.length
              : 0;
            setMeasured(prev => ({
              ...(prev ?? { noiseFloorRms: 0, signalRms: 0, signalCrest: 0, signalFlux: 0, suggestedNoiseGate: 50, suggestedHarmonicBoost: 50, suggestedFluxTolerance: 50 }),
              noiseFloorRms: avgRms,
            }));
            cleanup();
            setStep('strum');
          } else {
            const avgRms = rmsValuesRef.current.length > 0
              ? rmsValuesRef.current.reduce((a, b) => a + b, 0) / rmsValuesRef.current.length
              : 0;
            const avgCrest = crestValuesRef.current.length > 0
              ? crestValuesRef.current.reduce((a, b) => a + b, 0) / crestValuesRef.current.length
              : 3;
            const avgFlux = fluxValuesRef.current.length > 0
              ? fluxValuesRef.current.reduce((a, b) => a + b, 0) / fluxValuesRef.current.length
              : 2;

            const noiseFloor = measured?.noiseFloorRms ?? 0.005;
            const snr = avgRms > 0 && noiseFloor > 0 ? avgRms / noiseFloor : 10;
            const suggestedNoiseGate = Math.round(Math.min(90, Math.max(15, snr > 20 ? 75 : snr > 10 ? 60 : snr > 5 ? 45 : 30)));
            const suggestedHarmonicBoost = Math.round(Math.min(85, Math.max(20, avgCrest > 6 ? 40 : avgCrest > 4 ? 55 : avgCrest > 3 ? 65 : 75)));
            const suggestedFluxTolerance = Math.round(Math.min(80, Math.max(20, avgFlux > 3 ? 65 : avgFlux > 2 ? 50 : avgFlux > 1 ? 40 : 30)));

            setMeasured({
              noiseFloorRms: noiseFloor,
              signalRms: avgRms,
              signalCrest: avgCrest,
              signalFlux: avgFlux,
              suggestedNoiseGate,
              suggestedHarmonicBoost,
              suggestedFluxTolerance,
            });
            cleanup();
            // Now go to per-string step
            setStep('strings');
          }
        }
      }, 80);
    } catch (e) {
      console.error('[Calibration] Mic error:', e);
      setError('Microphone access denied. Please allow mic access and try again.');
      setMeasuring(false);
      cleanup();
    }
  }, [cleanup, measured]);

  // Per-string measurement
  const measureString = useCallback(async (stringIdx: number) => {
    setError(null);
    setStringMeasuring(true);
    setStringDetectedFreq(null);
    stringFreqReadingsRef.current = [];
    stringRmsReadingsRef.current = [];
    stringCrestReadingsRef.current = [];

    const targetString = OPEN_STRINGS[stringIdx];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: { ideal: 48000 } },
      });
      stringStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      if (ctx.state === 'suspended') await ctx.resume();
      stringCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 50; hp.Q.value = 0.71;
      source.connect(hp);

      // Bandpass around the expected frequency range for this string (±1 octave)
      const bp = ctx.createBiquadFilter();
      bp.type = 'peaking';
      bp.frequency.value = targetString.freq;
      bp.Q.value = 0.5;
      bp.gain.value = 4;
      hp.connect(bp);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.3;
      bp.connect(analyser);
      stringAnalyserRef.current = analyser;

      const durationSec = 4;
      let elapsed = 0;
      setStringCountdown(durationSec);

      const countdownInterval = setInterval(() => {
        setStringCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownInterval); return 0; }
          return prev - 1;
        });
      }, 1000);

      stringIntervalRef.current = window.setInterval(() => {
        if (!stringAnalyserRef.current || !stringCtxRef.current) return;
        elapsed += 60;

        const timeBuf = new Float32Array(stringAnalyserRef.current.fftSize);
        stringAnalyserRef.current.getFloatTimeDomainData(timeBuf);

        // RMS
        let rmsSum = 0;
        for (let i = 0; i < timeBuf.length; i++) rmsSum += timeBuf[i] * timeBuf[i];
        const rms = Math.sqrt(rmsSum / timeBuf.length);

        // Pitch detection
        const pitchResult = detectPitchNSDF(timeBuf, stringCtxRef.current.sampleRate);

        if (pitchResult && rms > 0.005) {
          const { freq, confidence } = pitchResult;
          // Only accept readings within ±1 octave of expected
          const ratio = freq / targetString.freq;
          if (ratio > 0.5 && ratio < 2.0 && confidence > 0.35) {
            stringFreqReadingsRef.current.push(freq);
            stringRmsReadingsRef.current.push(rms);
            setStringDetectedFreq(freq);

            // Compute crest for this frame
            const freqBuf = new Float32Array(stringAnalyserRef.current.frequencyBinCount);
            stringAnalyserRef.current.getFloatFrequencyData(freqBuf);
            const sr = stringCtxRef.current.sampleRate;
            const bw = sr / stringAnalyserRef.current.fftSize;
            const minBin = Math.floor(70 / bw);
            const maxBin = Math.min(Math.ceil(2500 / bw), freqBuf.length);
            let sumLin = 0, maxLin = 0, count = 0;
            for (let b = minBin; b < maxBin; b++) {
              if (freqBuf[b] < -80) continue;
              const lin = Math.pow(10, freqBuf[b] / 20);
              sumLin += lin; if (lin > maxLin) maxLin = lin; count++;
            }
            if (count > 5 && sumLin > 0) {
              stringCrestReadingsRef.current.push(maxLin / (sumLin / count));
            }
          }
        }

        if (elapsed >= durationSec * 1000) {
          clearInterval(stringIntervalRef.current);
          clearInterval(countdownInterval);
          stringIntervalRef.current = 0;
          setStringMeasuring(false);

          const readings = stringFreqReadingsRef.current;
          if (readings.length >= 5) {
            // Use median frequency for robustness
            const sorted = [...readings].sort((a, b) => a - b);
            const medianFreq = sorted[Math.floor(sorted.length / 2)];
            const avgRms = stringRmsReadingsRef.current.reduce((a, b) => a + b, 0) / stringRmsReadingsRef.current.length;
            const avgCrest = stringCrestReadingsRef.current.length > 0
              ? stringCrestReadingsRef.current.reduce((a, b) => a + b, 0) / stringCrestReadingsRef.current.length
              : 3;
            const centsOffset = Math.round(1200 * Math.log2(medianFreq / targetString.freq));

            const cal: StringCalibration = {
              measuredFreq: medianFreq,
              signalStrength: avgRms,
              crestFactor: avgCrest,
              expectedFreq: targetString.freq,
              centsOffset,
            };

            setStringResults(prev => {
              const next = [...prev];
              next[stringIdx] = cal;
              return next;
            });
          } else {
            // Not enough readings — mark as failed (null)
            setStringResults(prev => {
              const next = [...prev];
              next[stringIdx] = null;
              return next;
            });
            setError(`Could not detect ${targetString.note}. Try plucking louder.`);
          }

          cleanupString();
          setStringDetectedFreq(null);
        }
      }, 60);
    } catch (e) {
      console.error('[Calibration] String mic error:', e);
      setError('Microphone access denied.');
      setStringMeasuring(false);
      cleanupString();
    }
  }, [cleanupString]);

  const handleSkipStrings = useCallback(() => {
    setStep('results');
  }, []);

  const handleFinishStrings = useCallback(() => {
    setStep('results');
  }, []);

  // Derive per-string calibration from results
  const deriveStringCalibration = useCallback((): PerStringCalibration | null => {
    const validStrings = stringResults.filter((s): s is StringCalibration => s !== null);
    if (validStrings.length === 0) return null;

    const weakestRms = Math.min(...validStrings.map(s => s.signalStrength));
    const avgCrest = validStrings.reduce((sum, s) => sum + s.crestFactor, 0) / validStrings.length;

    // Derive optimal RMS threshold: slightly below weakest string signal
    const derivedRmsThreshold = Math.max(0.003, weakestRms * 0.4);

    // Derive harmonic sensitivity: higher crest = sharper harmonics = can use lower sensitivity
    const derivedHarmonicSensitivity = Math.round(
      Math.min(85, Math.max(20, avgCrest > 6 ? 35 : avgCrest > 4 ? 50 : avgCrest > 3 ? 65 : 75))
    );

    return {
      strings: stringResults,
      calibrated: true,
      derivedRmsThreshold,
      derivedHarmonicSensitivity,
    };
  }, [stringResults]);

  const handleSave = useCallback(() => {
    if (!measured || !profileName.trim()) return;

    // Factor in per-string data to adjust harmonic boost
    const stringCal = deriveStringCalibration();
    const finalHarmonicBoost = stringCal
      ? Math.round((measured.suggestedHarmonicBoost + stringCal.derivedHarmonicSensitivity) / 2)
      : measured.suggestedHarmonicBoost;

    addCalibrationProfile({
      name: profileName.trim(),
      createdAt: Date.now(),
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: finalHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
      noiseFloorRms: measured.noiseFloorRms,
      signalRms: measured.signalRms,
    });
    applyCalibrationProfile({
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: finalHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
    });
    if (stringCal) {
      setPerStringCalibration(stringCal);
    }
    onClose();
  }, [measured, profileName, addCalibrationProfile, applyCalibrationProfile, setPerStringCalibration, deriveStringCalibration, onClose]);

  const handleApplyWithoutSave = useCallback(() => {
    if (!measured) return;

    const stringCal = deriveStringCalibration();
    const finalHarmonicBoost = stringCal
      ? Math.round((measured.suggestedHarmonicBoost + stringCal.derivedHarmonicSensitivity) / 2)
      : measured.suggestedHarmonicBoost;

    applyCalibrationProfile({
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: finalHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
    });
    if (stringCal) {
      setPerStringCalibration(stringCal);
    }
    onClose();
  }, [measured, applyCalibrationProfile, setPerStringCalibration, deriveStringCalibration, onClose]);

  const handleLoadProfile = useCallback((profile: CalibrationProfile) => {
    applyCalibrationProfile({
      noiseGate: profile.noiseGate,
      harmonicBoost: profile.harmonicBoost,
      fluxTolerance: profile.fluxTolerance,
    });
    onClose();
  }, [applyCalibrationProfile, onClose]);

  if (!open) return null;

  const stepIndex = { intro: 0, silence: 1, strum: 2, strings: 3, results: 4, save: 4 }[step];
  const currentString = OPEN_STRINGS[currentStringIndex];
  const completedStrings = stringResults.filter(s => s !== null).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md max-h-[90vh] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-[hsl(var(--border-subtle))] shrink-0">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 via-cyan-400 to-violet-500" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-xl bg-[hsl(var(--color-emphasis)/0.12)]">
                <Zap className="size-4.5 text-[hsl(var(--color-emphasis))]" />
              </div>
              <h2 className="font-display text-lg font-bold text-[hsl(var(--text-default))]">Calibration Wizard</h2>
            </div>
            <button onClick={onClose} className="flex items-center justify-center size-8 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors">
              <X className="size-4" />
            </button>
          </div>
          <StepIndicator current={stepIndex} total={5} />
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-3 py-2 shrink-0">
            <AlertCircle className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs font-body text-[hsl(var(--semantic-error))]">{error}</span>
          </div>
        )}

        <div className="px-5 py-5 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {/* Step 1: Intro */}
            {step === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center py-2">
                  <Mic className="size-12 mx-auto mb-3 text-[hsl(var(--color-primary)/0.5)]" />
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))] mb-1.5">Auto-Tune Detection Settings</h3>
                  <p className="text-sm font-body text-[hsl(var(--text-muted))] leading-relaxed">This wizard measures your environment, guitar signal, and individual string response to find optimal settings. Applies globally to all practice pages and the tuner.</p>
                </div>
                <div className="space-y-2 text-sm font-body text-[hsl(var(--text-subtle))]">
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">1.</span> Measure silence (3 seconds)</div>
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">2.</span> Strum your guitar (5 seconds)</div>
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-cyan-400 shrink-0">3.</span> Play each open string (4s each)</div>
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">4.</span> Review and save optimized settings</div>
                </div>

                {calibrationProfiles.length > 0 && (
                  <div className="border-t border-[hsl(var(--border-subtle)/0.3)] pt-3 mt-3">
                    <h4 className="text-xs font-display font-bold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-2">Saved Profiles</h4>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-none">
                      {calibrationProfiles.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-display font-bold text-[hsl(var(--text-default))] truncate">{p.name}</p>
                            <p className="text-[10px] font-body text-[hsl(var(--text-muted))]">NG:{p.noiseGate} HS:{p.harmonicBoost} FT:{p.fluxTolerance}</p>
                          </div>
                          <button onClick={() => handleLoadProfile(p)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-display font-bold bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.22)] transition-colors">
                            <Upload className="size-3" /> Load
                          </button>
                          <button onClick={() => deleteCalibrationProfile(p.id)} className="flex items-center justify-center size-6 rounded text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.1)] transition-colors">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setStep('silence')} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all">
                  Start Calibration <ChevronRight className="size-4" />
                </button>
              </motion.div>
            )}

            {/* Step 2: Silence measurement */}
            {step === 'silence' && (
              <motion.div key="silence" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-4 py-4">
                <div className="flex items-center justify-center size-20 mx-auto rounded-full bg-[hsl(var(--bg-surface))] border-2 border-[hsl(var(--border-default))]">
                  {measuring ? (
                    <span className="font-display text-3xl font-extrabold text-[hsl(var(--color-emphasis))]">{countdown}</span>
                  ) : (
                    <Volume2 className="size-8 text-[hsl(var(--text-muted))]" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))] mb-1">Measuring Silence</h3>
                  <p className="text-sm font-body text-[hsl(var(--text-muted))]">
                    {measuring ? "Stay quiet... measuring your environment's noise floor." : "Keep your environment quiet and don't play your guitar."}
                  </p>
                </div>
                {measuring && (
                  <div className="flex items-center justify-center gap-1">
                    {[0,1,2,3,4].map((i) => (
                      <motion.div key={i} className="w-1 rounded-full bg-[hsl(var(--color-emphasis))]" animate={{ height: [6, 18, 6] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1 }} />
                    ))}
                  </div>
                )}
                {!measuring && (
                  <button onClick={() => startMeasurement('silence')} className="w-full rounded-xl py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all">
                    Start Measuring
                  </button>
                )}
              </motion.div>
            )}

            {/* Step 3: Strum measurement */}
            {step === 'strum' && (
              <motion.div key="strum" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-4 py-4">
                <div className="flex items-center justify-center size-20 mx-auto rounded-full bg-[hsl(var(--semantic-success)/0.08)] border-2 border-[hsl(var(--semantic-success)/0.3)]">
                  {measuring ? (
                    <span className="font-display text-3xl font-extrabold text-[hsl(var(--semantic-success))]">{countdown}</span>
                  ) : (
                    <Mic className="size-8 text-[hsl(var(--semantic-success))]" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))] mb-1">Strum Your Guitar</h3>
                  <p className="text-sm font-body text-[hsl(var(--text-muted))]">
                    {measuring ? 'Keep strumming different chords steadily...' : 'Play a few different chords at your normal volume for 5 seconds.'}
                  </p>
                </div>
                {measuring && (
                  <div className="flex items-center justify-center gap-1">
                    {[0,1,2,3,4].map((i) => (
                      <motion.div key={i} className="w-1 rounded-full bg-[hsl(var(--semantic-success))]" animate={{ height: [6, 24, 6] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }} />
                    ))}
                  </div>
                )}
                {!measuring && (
                  <button onClick={() => startMeasurement('strum')} className="w-full rounded-xl py-3 bg-[hsl(var(--semantic-success))] text-white font-display font-bold text-sm hover:bg-[hsl(var(--semantic-success)/0.85)] active:scale-[0.97] transition-all">
                    Start Strumming
                  </button>
                )}
              </motion.div>
            )}

            {/* Step 4: Per-string measurement */}
            {step === 'strings' && (
              <motion.div key="strings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center size-14 mx-auto rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 mb-2">
                    <Guitar className="size-7 text-cyan-400" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))] mb-1">Per-String Calibration</h3>
                  <p className="text-xs font-body text-[hsl(var(--text-muted))] leading-relaxed">
                    Play each open string individually. This measures how your guitar responds at each frequency to fine-tune harmonic detection.
                  </p>
                </div>

                {/* String grid */}
                <div className="grid grid-cols-6 gap-1.5">
                  {OPEN_STRINGS.map((s, i) => {
                    const result = stringResults[i];
                    const isCurrent = i === currentStringIndex;
                    const isCompleted = result !== null;
                    const isInTune = result && Math.abs(result.centsOffset) <= 10;
                    return (
                      <button
                        key={i}
                        onClick={() => { setCurrentStringIndex(i); setError(null); }}
                        disabled={stringMeasuring}
                        className={`flex flex-col items-center rounded-lg py-2 px-1 border transition-all duration-200 ${
                          isCurrent && !isCompleted
                            ? 'border-cyan-400/60 bg-cyan-500/10 ring-1 ring-cyan-400/30'
                            : isCompleted
                              ? isInTune
                                ? 'border-[hsl(var(--semantic-success)/0.4)] bg-[hsl(var(--semantic-success)/0.08)]'
                                : 'border-amber-400/40 bg-amber-500/8'
                              : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:bg-[hsl(var(--bg-overlay))]'
                        } ${stringMeasuring ? 'opacity-60' : ''}`}
                      >
                        {/* String gauge */}
                        <div className="w-full flex justify-center mb-1">
                          <div
                            className="rounded-full"
                            style={{
                              width: '60%',
                              height: [2, 2.5, 3, 4, 5, 6][i],
                              background: isCompleted
                                ? isInTune
                                  ? 'linear-gradient(180deg, hsl(142 71% 58%), hsl(142 71% 38%), hsl(142 71% 58%))'
                                  : 'linear-gradient(180deg, hsl(45 93% 60%), hsl(45 93% 40%), hsl(45 93% 60%))'
                                : isCurrent
                                  ? 'linear-gradient(180deg, hsl(190 80% 60%), hsl(190 80% 40%), hsl(190 80% 60%))'
                                  : 'linear-gradient(180deg, hsl(40 22% 72%), hsl(33 14% 52%), hsl(40 22% 72%))',
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">Str {s.stringNum}</span>
                        <span className={`text-sm font-display font-bold ${
                          isCompleted
                            ? isInTune ? 'text-[hsl(var(--semantic-success))]' : 'text-amber-400'
                            : isCurrent ? 'text-cyan-400' : 'text-[hsl(var(--text-default))]'
                        }`}>{s.display}</span>
                        {isCompleted && (
                          <span className={`text-[9px] font-display font-bold tabular-nums ${isInTune ? 'text-[hsl(var(--semantic-success))]' : 'text-amber-400'}`}>
                            {result.centsOffset > 0 ? '+' : ''}{result.centsOffset}c
                          </span>
                        )}
                        {!isCompleted && isCurrent && !stringMeasuring && (
                          <span className="text-[9px] font-body text-cyan-400">Ready</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Current string measurement */}
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-center">
                  {stringMeasuring ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-display text-2xl font-extrabold text-cyan-400">{currentString.note}</span>
                        <span className="font-display text-3xl font-extrabold text-cyan-300">{stringCountdown}</span>
                      </div>
                      <p className="text-sm font-body text-[hsl(var(--text-muted))]">Play the {currentString.note} string now...</p>
                      {stringDetectedFreq !== null && (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs font-body text-[hsl(var(--text-muted))]">Detected:</span>
                          <span className="font-display text-lg font-bold text-cyan-400 tabular-nums">{stringDetectedFreq.toFixed(1)} Hz</span>
                          <span className="text-xs font-body text-[hsl(var(--text-muted))]">Target: {currentString.freq.toFixed(1)} Hz</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-1">
                        {[0,1,2,3,4].map((i) => (
                          <motion.div key={i} className="w-1 rounded-full bg-cyan-400" animate={{ height: [6, 20, 6] }} transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.09 }} />
                        ))}
                      </div>
                    </div>
                  ) : stringResults[currentStringIndex] ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <Check className="size-5 text-[hsl(var(--semantic-success))]" />
                        <span className="font-display text-base font-bold text-[hsl(var(--text-default))]">{currentString.note} Measured</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Frequency</p>
                          <p className="text-sm font-display font-bold text-cyan-400 tabular-nums">{stringResults[currentStringIndex]!.measuredFreq.toFixed(1)} Hz</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Offset</p>
                          <p className={`text-sm font-display font-bold tabular-nums ${Math.abs(stringResults[currentStringIndex]!.centsOffset) <= 10 ? 'text-[hsl(var(--semantic-success))]' : 'text-amber-400'}`}>
                            {stringResults[currentStringIndex]!.centsOffset > 0 ? '+' : ''}{stringResults[currentStringIndex]!.centsOffset}c
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Strength</p>
                          <p className="text-sm font-display font-bold text-[hsl(var(--text-default))] tabular-nums">{(stringResults[currentStringIndex]!.signalStrength * 1000).toFixed(1)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => measureString(currentStringIndex)}
                        className="text-xs font-body text-cyan-400 hover:underline"
                      >
                        Re-measure this string
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-body text-[hsl(var(--text-muted))]">
                        Play the <span className="font-display font-bold text-cyan-400">{currentString.note}</span> string (String {currentString.stringNum}, {currentString.freq.toFixed(1)} Hz)
                      </p>
                      <button
                        onClick={() => measureString(currentStringIndex)}
                        className="w-full rounded-xl py-3 bg-cyan-500 text-white font-display font-bold text-sm hover:bg-cyan-600 active:scale-[0.97] transition-all"
                      >
                        Measure {currentString.note}
                      </button>
                    </div>
                  )}
                </div>

                {/* Auto-advance to next unmeasured string */}
                {stringResults[currentStringIndex] !== null && !stringMeasuring && (() => {
                  const nextUnmeasured = OPEN_STRINGS.findIndex((_, i) => i > currentStringIndex && stringResults[i] === null);
                  if (nextUnmeasured >= 0) {
                    return (
                      <button
                        onClick={() => { setCurrentStringIndex(nextUnmeasured); setError(null); }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] font-display font-bold text-sm border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] transition-all"
                      >
                        Next: {OPEN_STRINGS[nextUnmeasured].note} <ChevronRight className="size-4" />
                      </button>
                    );
                  }
                  return null;
                })()}

                {/* Footer actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSkipStrings} className="flex-1 rounded-xl py-2.5 bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] font-display font-bold text-xs border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] transition-all">
                    Skip
                  </button>
                  <button
                    onClick={handleFinishStrings}
                    disabled={completedStrings === 0}
                    className="flex-1 rounded-xl py-2.5 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-xs hover:bg-[hsl(var(--color-brand))] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
                  >
                    Continue ({completedStrings}/6)
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Results */}
            {(step === 'results' || step === 'save') && measured && (
              <motion.div key="results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center size-14 mx-auto rounded-full bg-[hsl(var(--semantic-success)/0.12)] mb-2">
                    <Check className="size-7 text-[hsl(var(--semantic-success))]" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))]">Calibration Complete</h3>
                  <p className="text-xs font-body text-[hsl(var(--text-muted))] mt-1">Settings optimized for your environment and guitar. Applies to all practice pages and the tuner.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] p-2">
                    <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Noise Floor</p>
                    <p className="font-display text-sm font-bold text-[hsl(var(--text-default))]">{(measured.noiseFloorRms * 1000).toFixed(1)} mRMS</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))] p-2">
                    <p className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">Signal Level</p>
                    <p className="font-display text-sm font-bold text-[hsl(var(--text-default))]">{(measured.signalRms * 1000).toFixed(1)} mRMS</p>
                  </div>
                </div>

                {/* Per-string results */}
                {completedStrings > 0 && (
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <h4 className="text-xs font-display font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Guitar className="size-3.5" /> Per-String Response
                    </h4>
                    <div className="grid grid-cols-6 gap-1">
                      {OPEN_STRINGS.map((s, i) => {
                        const r = stringResults[i];
                        return (
                          <div key={i} className="text-center">
                            <span className="text-[10px] font-display font-bold text-[hsl(var(--text-default))]">{s.display}</span>
                            {r ? (
                              <>
                                <p className={`text-[9px] font-display font-bold tabular-nums ${Math.abs(r.centsOffset) <= 10 ? 'text-[hsl(var(--semantic-success))]' : 'text-amber-400'}`}>
                                  {r.centsOffset > 0 ? '+' : ''}{r.centsOffset}c
                                </p>
                                <p className="text-[8px] font-body text-[hsl(var(--text-muted))] tabular-nums">{(r.signalStrength * 1000).toFixed(0)}</p>
                              </>
                            ) : (
                              <p className="text-[9px] font-body text-[hsl(var(--text-muted))]">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-display font-bold text-[hsl(var(--text-muted))] uppercase tracking-wider">Optimized Settings</h4>
                  <div className="flex items-center justify-between rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Noise Gate</span>
                    <span className="font-display text-sm font-bold text-amber-400">{measured.suggestedNoiseGate}%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-cyan-500/8 border border-cyan-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Harmonic Sensitivity</span>
                    <span className="font-display text-sm font-bold text-cyan-400">
                      {(() => {
                        const stringCal = deriveStringCalibration();
                        return stringCal
                          ? Math.round((measured.suggestedHarmonicBoost + stringCal.derivedHarmonicSensitivity) / 2)
                          : measured.suggestedHarmonicBoost;
                      })()}%
                      {completedStrings > 0 && <span className="text-[9px] text-cyan-400/60 ml-1">(string-tuned)</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-violet-500/8 border border-violet-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Flux Tolerance</span>
                    <span className="font-display text-sm font-bold text-violet-400">{measured.suggestedFluxTolerance}%</span>
                  </div>
                </div>

                {step === 'save' ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Profile name (e.g. Living Room, Studio)..."
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && profileName.trim()) handleSave(); }}
                      className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.6)]"
                    />
                    <button onClick={handleSave} disabled={!profileName.trim()} className="w-full rounded-xl py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all">
                      Save & Apply
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleApplyWithoutSave} className="flex-1 rounded-xl py-3 bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] font-display font-bold text-sm border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-[0.97] transition-all">
                      Apply Now
                    </button>
                    <button onClick={() => setStep('save')} className="flex-1 rounded-xl py-3 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all">
                      Save Profile
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
