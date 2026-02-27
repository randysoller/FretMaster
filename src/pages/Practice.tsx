import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import { useCountdown } from '@/hooks/useCountdown';
import { useChordDetection } from '@/hooks/useChordDetection';
import type { DetectionResult } from '@/hooks/useChordDetection';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import CountdownRing from '@/components/features/CountdownRing';
import { ArrowLeft, SkipForward, Eye, RotateCcw, Volume2, Mic, MicOff, SlidersHorizontal } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import VolumeControl from '@/components/features/VolumeControl';
import { motion, AnimatePresence } from 'framer-motion';

const SENSITIVITY_KEY = 'fretmaster-detection-sensitivity';

function getStoredSensitivity(): number {
  try {
    const v = localStorage.getItem(SENSITIVITY_KEY);
    if (v) {
      const n = Number(v);
      if (n >= 1 && n <= 10) return n;
    }
  } catch {}
  return 5;
}

function DetectionFeedback({ result }: { result: DetectionResult }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          key={result}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none pb-[8px]"
        >
          <div
            className={`
              px-10 py-[17px] rounded-2xl backdrop-blur-md border-2
              ${result === 'correct'
                ? 'bg-[hsl(142_71%_45%/0.15)] border-[hsl(142_71%_45%/0.5)]'
                : 'bg-[hsl(0_84%_60%/0.15)] border-[hsl(0_84%_60%/0.5)]'
              }
            `}
          >
            <span
              className={`
                font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wider
                ${result === 'correct'
                  ? 'text-[hsl(142_71%_45%)]'
                  : 'text-[hsl(0_84%_60%)]'
                }
              `}
              style={{
                textShadow: result === 'correct'
                  ? '0 0 30px hsl(142 71% 45% / 0.5), 0 0 60px hsl(142 71% 45% / 0.2)'
                  : '0 0 30px hsl(0 84% 60% / 0.5), 0 0 60px hsl(0 84% 60% / 0.2)',
              }}
            >
              {result === 'correct' ? 'Correct' : 'Wrong'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SensitivitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label =
    value <= 3 ? 'Strict' : value <= 7 ? 'Balanced' : 'Sensitive';
  const labelColor =
    value <= 3
      ? 'text-[hsl(var(--semantic-info))]'
      : value <= 7
        ? 'text-[hsl(var(--color-primary))]'
        : 'text-[hsl(var(--semantic-success))]';

  return (
    <div className="flex items-center gap-3 min-w-0">
      <SlidersHorizontal className="size-3.5 text-[hsl(var(--text-muted))] shrink-0" />
      <span className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase tracking-wider shrink-0 hidden sm:inline">
        Sensitivity
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="volume-slider flex-1 min-w-[80px] max-w-[120px]"
          title={`Detection sensitivity: ${value}/10 (${label})`}
        />
        <span className={`text-xs font-display font-bold tabular-nums w-5 text-center ${labelColor}`}>
          {value}
        </span>
      </div>
      <span className={`text-[10px] font-body font-medium ${labelColor} shrink-0`}>
        {label}
      </span>
    </div>
  );
}

export default function Practice() {
  const navigate = useNavigate();
  const {
    isPracticing,
    isRevealed,
    timerDuration,
    currentIndex,
    practiceChords,
    totalPracticed,
    categories,
    chordTypes,
    barreRoots,
    getCurrentChord,
    revealChord,
    nextChord,
    stopPractice,
    startPractice,
  } = usePracticeStore();

  const chord = getCurrentChord();
  const { playChord } = useChordAudio();

  // Sensitivity state with localStorage persistence
  const [sensitivity, setSensitivity] = useState(getStoredSensitivity);
  const handleSensitivityChange = useCallback((v: number) => {
    setSensitivity(v);
    try {
      localStorage.setItem(SENSITIVITY_KEY, String(v));
    } catch {}
  }, []);

  const handleReveal = useCallback(() => {
    revealChord();
    const current = getCurrentChord();
    if (current) playChord(current);
  }, [revealChord, getCurrentChord, playChord]);

  const { timeLeft, progress, start, reset } = useCountdown({
    duration: timerDuration,
    onComplete: handleReveal,
  });

  // Chord detection — auto-advance callback
  const handleDetectionCorrect = useCallback(() => {
    // Reveal the chord if not already
    if (!usePracticeStore.getState().isRevealed) {
      revealChord();
    }
    // Advance to next chord after the green flash
    reset();
    nextChord();
  }, [revealChord, reset, nextChord]);

  const { isListening, result, permissionDenied, toggleListening, stopListening } =
    useChordDetection({
      onCorrect: handleDetectionCorrect,
      targetChord: chord,
      sensitivity,
      autoStart: true, // mic on by default
    });

  useEffect(() => {
    if (!isPracticing) {
      navigate('/');
    }
  }, [isPracticing, navigate]);

  useEffect(() => {
    if (isPracticing && !isRevealed && timerDuration > 0) {
      start();
    }
  }, [isPracticing, isRevealed, currentIndex, start, timerDuration]);

  // Stop mic when leaving practice
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const handleNext = () => {
    reset();
    nextChord();
  };

  const handleSkipReveal = () => {
    reset();
    revealChord();
  };

  const handleBack = () => {
    stopListening();
    stopPractice();
    navigate('/');
  };

  const handleRestart = () => {
    reset();
    startPractice();
  };

  if (!chord) return null;

  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-body text-[hsl(var(--text-muted))]">
            <span className="px-2 py-1 rounded bg-[hsl(var(--bg-surface))]">
              {categories.size === 0 || categories.size === 3 ? 'All Chords' : [...categories].map((c) => CATEGORY_LABELS[c]).join(', ')}
            </span>
            {barreRoots.size > 0 && (
              <>
                <span className="text-[hsl(var(--border-default))]">·</span>
                <span className="px-2 py-1 rounded bg-[hsl(var(--bg-surface))]">
                  {[...barreRoots].map((r) => BARRE_ROOT_LABELS[r]).join(', ')}
                </span>
              </>
            )}
            <span className="text-[hsl(var(--border-default))]">·</span>
            <span className="px-2 py-1 rounded bg-[hsl(var(--bg-surface))]">
              {chordTypes.size === 0 ? 'All Types' : [...chordTypes].map((t) => CHORD_TYPE_LABELS[t]).join(', ')}
            </span>
          </div>

          {/* Microphone Toggle */}
          <button
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Start listening'}
            className={`
              relative flex items-center justify-center size-9 rounded-lg border transition-all duration-200
              ${isListening
                ? 'border-[hsl(var(--semantic-success)/0.6)] bg-[hsl(var(--semantic-success)/0.12)] text-[hsl(var(--semantic-success))]'
                : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
              }
            `}
          >
            {isListening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            {isListening && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />
            )}
          </button>

          <VolumeControl compact />
          <div className="text-sm font-body text-[hsl(var(--text-subtle))]">
            <span className="text-[hsl(var(--color-primary))] font-display font-bold">{totalPracticed + 1}</span>
            <span className="text-[hsl(var(--text-muted))]"> / {practiceChords.length}</span>
          </div>
        </div>
      </div>

      {/* Permission denied warning */}
      {permissionDenied && (
        <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5">
          <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
          <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">
            Microphone access was denied. Please allow microphone access in your browser settings to use chord detection.
          </span>
        </div>
      )}

      {/* Listening indicator + sensitivity */}
      {isListening && (
        <div className="mx-4 sm:mx-6 mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 rounded-lg bg-[hsl(var(--semantic-success)/0.06)] border border-[hsl(var(--semantic-success)/0.15)] px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full bg-[hsl(var(--semantic-success))]"
                  animate={{ height: [4, 12, 4] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.12,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-body font-medium text-[hsl(var(--semantic-success))]">
              Listening — play the chord
            </span>
          </div>
          <div className="h-4 w-px bg-[hsl(var(--border-subtle))] hidden sm:block" />
          <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
        </div>
      )}

      {/* Sensitivity control when mic is off */}
      {!isListening && !permissionDenied && (
        <div className="mx-4 sm:mx-6 mb-2 flex items-center justify-center gap-4 rounded-lg bg-[hsl(var(--bg-elevated)/0.5)] border border-[hsl(var(--border-subtle)/0.5)] px-4 py-2">
          <span className="text-xs font-body text-[hsl(var(--text-muted))]">Mic off</span>
          <div className="h-4 w-px bg-[hsl(var(--border-subtle))]" />
          <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
        </div>
      )}

      {/* Main Practice Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Detection result overlay */}
        <DetectionFeedback result={result} />

        <AnimatePresence mode="wait">
          <motion.div
            key={`${chord.id}-${currentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Chord Name */}
            <div className="text-center">
              <h2 className="font-display text-5xl sm:text-7xl md:text-8xl font-extrabold text-[hsl(var(--text-default))] leading-none">
                {chord.symbol}
              </h2>
              <p className="mt-3 font-body text-base sm:text-lg text-[hsl(var(--text-muted))]">
                {chord.name}
              </p>
            </div>

            {/* Countdown or Diagram */}
            <div className="relative min-h-[260px] flex items-center justify-center mt-6">
              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.div
                    key="countdown"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center gap-6"
                  >
                    {timerDuration > 0 ? (
                        <CountdownRing
                          progress={progress}
                          timeLeft={timeLeft}
                          size={180}
                        />
                    ) : (
                      <div className="min-h-[180px]" />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="diagram"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.8)] backdrop-blur-sm p-6 glow-emphasis">
                      {(chord as any).isCustom ? (
                        <CustomChordDiagram
                          key={`custom-${chord.id}-${((chord as any).customBarres ?? []).length}`}
                          chord={{
                            id: chord.id,
                            name: chord.name,
                            symbol: chord.symbol,
                            baseFret: chord.baseFret,
                            numFrets: (chord as any).numFrets ?? 5,
                            mutedStrings: new Set((chord as any).customMutedStrings ?? []),
                            openStrings: new Set((chord as any).customOpenStrings ?? []),
                            openDiamonds: new Set((chord as any).customOpenDiamonds ?? []),
                            markers: (chord as any).customMarkers ?? [],
                            barres: (chord as any).customBarres ?? [],
                            createdAt: 0,
                            updatedAt: 0,
                          }}
                          size="lg"
                        />
                      ) : (
                        <ChordDiagram chord={chord} size="lg" />
                      )}
                    </div>
                    <button
                      onClick={() => playChord(chord)}
                      className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                    >
                      <Volume2 className="size-4" />
                      Play Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Controls group — reveal button + restart/next */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {!isRevealed && (
            <div>
              {timerDuration > 0 ? (
                <button
                  onClick={handleSkipReveal}
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                >
                  <Eye className="size-4" />
                  Reveal Now
                </button>
              ) : (
                <button
                  onClick={handleReveal}
                  className="flex items-center gap-3 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-4 font-display text-base font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98] transition-all duration-200"
                >
                  <Eye className="size-5" />
                  Reveal Chord
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] px-5 py-3 text-sm font-body font-medium text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
            >
              <RotateCcw className="size-4" />
              Restart
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-3 text-sm font-display font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98] transition-all duration-200"
            >
              Next Chord
              <SkipForward className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
