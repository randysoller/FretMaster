import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import { useCountdown } from '@/hooks/useCountdown';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import CountdownRing from '@/components/features/CountdownRing';
import { ArrowLeft, SkipForward, Eye, RotateCcw, Volume2 } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import VolumeControl from '@/components/features/VolumeControl';
import { motion, AnimatePresence } from 'framer-motion';

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

  const handleReveal = useCallback(() => {
    revealChord();
    const current = getCurrentChord();
    if (current) playChord(current);
  }, [revealChord, getCurrentChord, playChord]);

  const { timeLeft, progress, start, reset } = useCountdown({
    duration: timerDuration,
    onComplete: handleReveal,
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

  const handleNext = () => {
    reset();
    nextChord();
  };

  const handleSkipReveal = () => {
    reset();
    revealChord();
  };

  const handleBack = () => {
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
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="flex items-center gap-4">
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
          <VolumeControl compact />
          <div className="text-sm font-body text-[hsl(var(--text-subtle))]">
            <span className="text-[hsl(var(--color-primary))] font-display font-bold">{totalPracticed + 1}</span>
            <span className="text-[hsl(var(--text-muted))]"> / {practiceChords.length}</span>
          </div>
        </div>
      </div>

      {/* Main Practice Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
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
            <div className="relative min-h-[260px] flex items-center justify-center">
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
                      <>
                        <CountdownRing
                          progress={progress}
                          timeLeft={timeLeft}
                          size={180}
                        />
                        <button
                          onClick={handleSkipReveal}
                          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                        >
                          <Eye className="size-4" />
                          Reveal Now
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleReveal}
                        className="flex items-center gap-3 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-4 font-display text-base font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98] transition-all duration-200"
                      >
                        <Eye className="size-5" />
                        Reveal Chord
                      </button>
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

        {/* Controls */}
        <div className="mt-8 flex items-center gap-4">
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
  );
}
