import { useState, useCallback, useRef, useEffect } from 'react';
import { usePracticeHistoryStore, type CalibrationProfile } from '@/stores/practiceHistoryStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Volume2, Check, ChevronRight, AlertCircle, Trash2, Upload, Zap } from 'lucide-react';

type WizardStep = 'intro' | 'silence' | 'strum' | 'results' | 'save';

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

interface CalibrationWizardProps {
  open: boolean;
  onClose: () => void;
  onApplyProfile: (profile: { noiseGate: number; harmonicBoost: number; fluxTolerance: number }) => void;
}

export default function CalibrationWizard({ open, onClose, onApplyProfile }: CalibrationWizardProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [measuring, setMeasuring] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [measured, setMeasured] = useState<MeasuredData | null>(null);
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const measureIntervalRef = useRef<number>(0);
  const rmsValuesRef = useRef<number[]>([]);
  const crestValuesRef = useRef<number[]>([]);
  const fluxValuesRef = useRef<number[]>([]);
  const prevFreqRef = useRef<Float32Array | null>(null);

  const { calibrationProfiles, addCalibrationProfile, deleteCalibrationProfile } = usePracticeHistoryStore();

  const cleanup = useCallback(() => {
    if (measureIntervalRef.current) { clearInterval(measureIntervalRef.current); measureIntervalRef.current = 0; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    analyserRef.current = null;
    prevFreqRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) { cleanup(); setStep('intro'); setMeasured(null); setError(null); setMeasuring(false); }
    return cleanup;
  }, [open, cleanup]);

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

      // Collect samples
      measureIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current || !ctxRef.current) return;
        elapsed += 80;

        // RMS from time domain
        const timeBuf = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(timeBuf);
        let rmsSum = 0;
        for (let i = 0; i < timeBuf.length; i++) rmsSum += timeBuf[i] * timeBuf[i];
        const rms = Math.sqrt(rmsSum / timeBuf.length);
        rmsValuesRef.current.push(rms);

        // Frequency data for crest and flux
        const freqBuf = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatFrequencyData(freqBuf);
        const sr = ctxRef.current.sampleRate;
        const bw = sr / analyserRef.current.fftSize;
        const minBin = Math.floor(70 / bw);
        const maxBin = Math.min(Math.ceil(2500 / bw), freqBuf.length);

        // Spectral crest
        let sumLin = 0, maxLin = 0, count = 0;
        for (let b = minBin; b < maxBin; b++) {
          if (freqBuf[b] < -80) continue;
          const lin = Math.pow(10, freqBuf[b] / 20);
          sumLin += lin; if (lin > maxLin) maxLin = lin; count++;
        }
        if (count > 5 && sumLin > 0) {
          crestValuesRef.current.push(maxLin / (sumLin / count));
        }

        // Spectral flux
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

        // Done?
        if (elapsed >= durationSec * 1000) {
          clearInterval(measureIntervalRef.current);
          clearInterval(countdownInterval);
          measureIntervalRef.current = 0;
          setMeasuring(false);

          if (phase === 'silence') {
            // Store noise floor
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
            // Calculate final settings
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

            // Noise gate: set between noise floor and signal level
            // Higher ratio means cleaner environment → lower gate needed → higher slider value
            const snr = avgRms > 0 && noiseFloor > 0 ? avgRms / noiseFloor : 10;
            const suggestedNoiseGate = Math.round(Math.min(90, Math.max(15, snr > 20 ? 75 : snr > 10 ? 60 : snr > 5 ? 45 : 30)));

            // Harmonic boost: based on crest factor (higher crest = cleaner harmonics)
            const suggestedHarmonicBoost = Math.round(Math.min(85, Math.max(20, avgCrest > 6 ? 40 : avgCrest > 4 ? 55 : avgCrest > 3 ? 65 : 75)));

            // Flux tolerance: based on measured flux variability
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
            setStep('results');
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

  const handleSave = useCallback(() => {
    if (!measured || !profileName.trim()) return;
    addCalibrationProfile({
      name: profileName.trim(),
      createdAt: Date.now(),
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: measured.suggestedHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
      noiseFloorRms: measured.noiseFloorRms,
      signalRms: measured.signalRms,
    });
    onApplyProfile({
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: measured.suggestedHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
    });
    onClose();
  }, [measured, profileName, addCalibrationProfile, onApplyProfile, onClose]);

  const handleApplyWithoutSave = useCallback(() => {
    if (!measured) return;
    onApplyProfile({
      noiseGate: measured.suggestedNoiseGate,
      harmonicBoost: measured.suggestedHarmonicBoost,
      fluxTolerance: measured.suggestedFluxTolerance,
    });
    onClose();
  }, [measured, onApplyProfile, onClose]);

  const handleLoadProfile = useCallback((profile: CalibrationProfile) => {
    onApplyProfile({
      noiseGate: profile.noiseGate,
      harmonicBoost: profile.harmonicBoost,
      fluxTolerance: profile.fluxTolerance,
    });
    onClose();
  }, [onApplyProfile, onClose]);

  if (!open) return null;

  const stepIndex = { intro: 0, silence: 1, strum: 2, results: 3, save: 3 }[step];

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
        className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-[hsl(var(--border-subtle))]">
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
          <StepIndicator current={stepIndex} total={4} />
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-3 py-2">
            <AlertCircle className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs font-body text-[hsl(var(--semantic-error))]">{error}</span>
          </div>
        )}

        <div className="px-5 py-5">
          <AnimatePresence mode="wait">
            {/* Step 1: Intro */}
            {step === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center py-2">
                  <Mic className="size-12 mx-auto mb-3 text-[hsl(var(--color-primary)/0.5)]" />
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))] mb-1.5">Auto-Tune Detection Settings</h3>
                  <p className="text-sm font-body text-[hsl(var(--text-muted))] leading-relaxed">This wizard will measure your environment's noise level and your guitar's signal to find optimal detection settings.</p>
                </div>
                <div className="space-y-2 text-sm font-body text-[hsl(var(--text-subtle))]">
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">1.</span> Measure silence (3 seconds)</div>
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">2.</span> Strum your guitar (5 seconds)</div>
                  <div className="flex items-start gap-2"><span className="font-display font-bold text-[hsl(var(--color-primary))] shrink-0">3.</span> Review and save optimized settings</div>
                </div>

                {/* Saved profiles */}
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

            {/* Step 4: Results */}
            {(step === 'results' || step === 'save') && measured && (
              <motion.div key="results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center size-14 mx-auto rounded-full bg-[hsl(var(--semantic-success)/0.12)] mb-2">
                    <Check className="size-7 text-[hsl(var(--semantic-success))]" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[hsl(var(--text-default))]">Calibration Complete</h3>
                  <p className="text-xs font-body text-[hsl(var(--text-muted))] mt-1">Settings optimized for your environment and guitar.</p>
                </div>

                {/* Measured values */}
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

                {/* Suggested settings */}
                <div className="space-y-2">
                  <h4 className="text-xs font-display font-bold text-[hsl(var(--text-muted))] uppercase tracking-wider">Optimized Settings</h4>
                  <div className="flex items-center justify-between rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Noise Gate</span>
                    <span className="font-display text-sm font-bold text-amber-400">{measured.suggestedNoiseGate}%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-cyan-500/8 border border-cyan-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Harmonic Sensitivity</span>
                    <span className="font-display text-sm font-bold text-cyan-400">{measured.suggestedHarmonicBoost}%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-violet-500/8 border border-violet-500/20 px-3 py-2">
                    <span className="text-xs font-body text-[hsl(var(--text-subtle))]">Flux Tolerance</span>
                    <span className="font-display text-sm font-bold text-violet-400">{measured.suggestedFluxTolerance}%</span>
                  </div>
                </div>

                {/* Save section */}
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
