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
import { ArrowLeft, SkipForward, SkipBack, Eye, RotateCcw, Volume2, Mic, MicOff, SlidersHorizontal } from 'lucide-react';
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
        Mic Sensitivity
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
    prevChord,
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

  const { isListening, result, permissionDenied, toggleListening, stopListening, pauseDetection } =
    useChordDetection({
      onCorrect: handleDetectionCorrect,
      targetChord: chord,
      sensitivity,
      autoStart: true, // mic on by default
    });

  useEffect(() => {
    if (!isPracticing) {
      navigate('/chord-practice');
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

  const handlePrev = () => {
    reset();
    prevChord();
  };

  const handleSkipReveal = () => {
    reset();
    revealChord();
  };

  const handleBack = () => {
    stopListening();
    stopPractice();
    navigate('/chord-practice');
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
      <div className="relative flex-1 flex flex-col items-center justify-center px-3 sm:px-6 pb-[140px] sm:pb-12">
        {/* Detection result overlay */}
        <DetectionFeedback result={result} />

        <AnimatePresence mode="wait">
          <motion.div
            key={`${chord.id}-${currentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-4 sm:gap-8 w-full max-w-lg"
          >
            {/* Chord Name */}
            <div className="text-center">
              <h2 className="font-display text-4xl sm:text-7xl md:text-8xl font-extrabold text-[hsl(var(--text-default))] leading-none">
                {chord.symbol}
              </h2>
              <p className="mt-1.5 sm:mt-3 font-body text-sm sm:text-lg text-[hsl(var(--text-muted))]">
                {chord.name}
              </p>
            </div>

            {/* Countdown or Diagram */}
            <div className="relative min-h-[200px] sm:min-h-[260px] flex items-center justify-center mt-2 sm:mt-6 w-full">
              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.div
                    key="countdown"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center gap-4 sm:gap-6"
                  >
                    {timerDuration > 0 ? (
                      <div className="scale-[0.85] sm:scale-100 origin-center">
                        <CountdownRing
                          progress={progress}
                          timeLeft={timeLeft}
                          size={180}
                        />
                      </div>
                    ) : (
                      <div className="min-h-[140px] sm:min-h-[180px] flex items-center justify-center">
                        <div className="text-center text-[hsl(var(--text-muted))]">
                          <Eye className="size-8 sm:size-10 mx-auto mb-2 opacity-30" />
                          <p className="text-xs sm:text-sm font-body">Tap reveal to see the chord</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="diagram"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-3 sm:gap-6 w-full"
                  >
                    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.8)] backdrop-blur-sm p-3 sm:p-6 glow-emphasis w-fit mx-auto max-w-[90vw] sm:max-w-none">
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
                      onClick={() => { pauseDetection(2000); playChord(chord); }}
                      className="hidden sm:flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
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


      </div>

      {/* Fixed bottom toolbar — all screen sizes */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.95)] backdrop-blur-md safe-area-bottom">
        <div className="flex items-stretch gap-2 px-3 py-3 max-w-2xl mx-auto">
          {/* Prev */}
          <button
            onClick={handlePrev}
            className="flex items-center justify-center size-12 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all"
            title="Previous"
          >
            <SkipBack className="size-5" />
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            className="flex items-center justify-center size-12 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all"
            title="Restart"
          >
            <RotateCcw className="size-5" />
          </button>

          {/* Reveal / Play Again */}
          {!isRevealed ? (
            <button
              onClick={timerDuration > 0 ? handleSkipReveal : handleReveal}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl min-h-[48px] bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] font-display font-bold text-sm border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.25)] active:scale-[0.97] transition-all"
            >
              <Eye className="size-5" />
              {timerDuration > 0 ? 'Reveal Now' : 'Reveal Chord'}
            </button>
          ) : (
            <button
              onClick={() => { pauseDetection(2000); playChord(chord); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl min-h-[48px] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] font-body font-medium text-sm border border-[hsl(var(--border-default))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-[0.97] transition-all"
            >
              <Volume2 className="size-5" />
              Play Again
            </button>
          )}

          {/* Next */}
          <button
            onClick={handleNext}
            className="flex items-center justify-center gap-1.5 rounded-xl min-h-[48px] px-5 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-sm glow-primary hover:bg-[hsl(var(--color-brand))] active:scale-95 transition-all"
          >
            Next
            <SkipForward className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
