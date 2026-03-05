import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChordData } from '@/types/chord';
import { CHORD_TYPE_LABELS, getChordCategoryLabel } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import ChordTablature from '@/components/features/ChordTablature';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import { X, Volume2, Guitar, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import { useCustomChordStore } from '@/stores/customChordStore';

type ExtendedChordData = ChordData & { isCustom?: boolean; customMarkers?: any[]; customBarres?: any[]; customMutedStrings?: number[]; customOpenStrings?: number[]; customOpenDiamonds?: number[]; numFrets?: number };

interface ChordDetailModalProps {
  chord: ExtendedChordData | null;
  onClose: () => void;
  filteredChords?: ExtendedChordData[];
  onNavigate?: (chord: ExtendedChordData) => void;
}

const STRING_NAMES = ['E (6th)', 'A (5th)', 'D (4th)', 'G (3rd)', 'B (2nd)', 'e (1st)'];

function getFretLabel(fret: number): string {
  if (fret === -1) return 'Muted';
  if (fret === 0) return 'Open';
  return `Fret ${fret}`;
}

function getFingerLabel(finger: number): string {
  if (finger === 0) return '—';
  const names: Record<number, string> = { 1: 'Index', 2: 'Middle', 3: 'Ring', 4: 'Pinky' };
  return names[finger] ?? String(finger);
}

export default function ChordDetailModal({ chord, onClose, filteredChords, onNavigate }: ChordDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { playChord } = useChordAudio();
  const { editChord: editCustomChord, editStandardChord } = useCustomChordStore();

  // ─── Mobile swipe navigation ───
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipingRef = useRef(false);
  // Swipe animation phases: idle → dragging → exit → reposition → enter → idle
  const [swipePhase, setSwipePhase] = useState<'idle' | 'dragging' | 'exit' | 'reposition' | 'enter'>('idle');
  const animTimerRef = useRef<number>(0);

  const currentIndex = chord && filteredChords
    ? filteredChords.findIndex((c) => c.id === chord.id)
    : -1;
  const hasNext = filteredChords ? currentIndex < filteredChords.length - 1 : false;
  const hasPrev = currentIndex > 0;

  const goNext = useCallback(() => {
    if (hasNext && filteredChords && onNavigate) {
      onNavigate(filteredChords[currentIndex + 1]);
    }
  }, [hasNext, filteredChords, onNavigate, currentIndex]);

  const goPrev = useCallback(() => {
    if (hasPrev && filteredChords && onNavigate) {
      onNavigate(filteredChords[currentIndex - 1]);
    }
  }, [hasPrev, filteredChords, onNavigate, currentIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable swipe on mobile (< 640px), block during animation
    if (window.innerWidth >= 640) return;
    if (swipePhase !== 'idle') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipingRef.current = false;
  }, [swipePhase]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || window.innerWidth >= 640) return;
    if (swipePhase !== 'idle' && swipePhase !== 'dragging') return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // If mostly vertical, don't interfere with scrolling
    if (!swipingRef.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      touchStartRef.current = null;
      return;
    }

    // Lock into horizontal swipe after 10px horizontal movement
    if (Math.abs(dx) > 10) {
      swipingRef.current = true;
      if (swipePhase === 'idle') setSwipePhase('dragging');
    }

    if (swipingRef.current) {
      // Dampen swipe if no chord in that direction
      const maxOffset = (!hasNext && dx < 0) || (!hasPrev && dx > 0) ? 40 : 200;
      const clamped = Math.max(-maxOffset, Math.min(maxOffset, dx));
      // Apply rubber-band effect at edges
      const dampened = (!hasNext && dx < 0) || (!hasPrev && dx > 0)
        ? clamped * 0.3
        : clamped;
      setSwipeOffset(dampened);
    }
  }, [hasNext, hasPrev, swipePhase]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !swipingRef.current) {
      touchStartRef.current = null;
      setSwipeOffset(0);
      setSwipePhase('idle');
      return;
    }

    const threshold = 60;
    const screenW = window.innerWidth;

    if (swipeOffset < -threshold && hasNext) {
      // ─── Swipe left → go to next chord ───
      setSwipePhase('exit');
      setSwipeOffset(-screenW); // card flies out left
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = window.setTimeout(() => {
        setSwipePhase('reposition');
        goNext();
        setSwipeOffset(screenW); // instantly position new card off-screen right
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSwipePhase('enter');
            setSwipeOffset(0); // animate new card in from right
            animTimerRef.current = window.setTimeout(() => {
              setSwipePhase('idle');
            }, 300);
          });
        });
      }, 280);
    } else if (swipeOffset > threshold && hasPrev) {
      // ─── Swipe right → go to previous chord ───
      setSwipePhase('exit');
      setSwipeOffset(screenW); // card flies out right
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = window.setTimeout(() => {
        setSwipePhase('reposition');
        goPrev();
        setSwipeOffset(-screenW); // instantly position new card off-screen left
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSwipePhase('enter');
            setSwipeOffset(0); // animate new card in from left
            animTimerRef.current = window.setTimeout(() => {
              setSwipePhase('idle');
            }, 300);
          });
        });
      }, 280);
    } else {
      // ─── Did not meet threshold → snap back ───
      setSwipePhase('idle');
      setSwipeOffset(0);
    }

    touchStartRef.current = null;
    swipingRef.current = false;
  }, [swipeOffset, hasNext, hasPrev, goNext, goPrev]);

  const handleEdit = () => {
    if (!chord) return;
    if (chord.isCustom) {
      editCustomChord(chord.id);
    } else {
      editStandardChord(chord);
    }
    onClose();
    navigate('/editor');
  };

  useEffect(() => {
    if (!chord) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [chord, onClose]);

  // Reset swipe offset when chord changes (only if not mid-animation)
  useEffect(() => {
    if (swipePhase === 'idle') {
      setSwipeOffset(0);
    }
  }, [chord?.id, swipePhase]);

  // Cleanup animation timers on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  if (!chord) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center py-4 px-[39px] sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Desktop left arrow */}
      {filteredChords && filteredChords.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={!hasPrev}
          className={`hidden sm:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-[60] items-center justify-center size-11 rounded-full border transition-all duration-200 ${
            hasPrev
              ? 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.9)] backdrop-blur-sm text-[hsl(var(--text-default))] hover:bg-[hsl(var(--color-primary)/0.15)] hover:border-[hsl(var(--color-primary)/0.4)] hover:text-[hsl(var(--color-primary))] active:scale-90 shadow-lg'
              : 'border-transparent bg-transparent text-transparent cursor-default'
          }`}
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {/* Desktop right arrow */}
      {filteredChords && filteredChords.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={!hasNext}
          className={`hidden sm:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-[60] items-center justify-center size-11 rounded-full border transition-all duration-200 ${
            hasNext
              ? 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.9)] backdrop-blur-sm text-[hsl(var(--text-default))] hover:bg-[hsl(var(--color-primary)/0.15)] hover:border-[hsl(var(--color-primary)/0.4)] hover:text-[hsl(var(--color-primary))] active:scale-90 shadow-lg'
              : 'border-transparent bg-transparent text-transparent cursor-default'
          }`}
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* Mobile bleeding-edge cards — adjacent chords partially cut off at screen edges */}
      {filteredChords && filteredChords.length > 1 && hasPrev && (
        <div
          className="sm:hidden absolute top-1/2 z-[5] cursor-pointer"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          style={{
            left: 0,
            width: '68px',
            transform: `translateY(-50%) translateX(-33px) translateX(${swipeOffset * 0.35}px)`,
            transition: swipePhase === 'dragging' ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
            opacity: swipePhase === 'exit' || swipePhase === 'reposition' ? 0 : 0.9,
          }}
        >
          <div className="rounded-2xl bg-[hsl(var(--bg-elevated)/0.9)] border-2 border-[hsl(200_80%_62%/0.5)] backdrop-blur-md flex flex-col items-end justify-center gap-2 pr-2 shadow-xl shadow-[hsl(200_80%_62%/0.08)]" style={{ height: 'calc((100vh - 80px) * 0.75)' }}>
            <ChevronLeft className="size-4 text-[hsl(var(--color-primary)/0.6)]" />
            <span className="font-display font-extrabold text-base text-[hsl(var(--text-muted))] text-right leading-tight">
              {filteredChords[currentIndex - 1].symbol}
            </span>
          </div>
        </div>
      )}
      {filteredChords && filteredChords.length > 1 && hasNext && (
        <div
          className="sm:hidden absolute top-1/2 z-[5] cursor-pointer"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          style={{
            right: 0,
            width: '68px',
            transform: `translateY(-50%) translateX(33px) translateX(${swipeOffset * 0.35}px)`,
            transition: swipePhase === 'dragging' ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
            opacity: swipePhase === 'exit' || swipePhase === 'reposition' ? 0 : 0.9,
          }}
        >
          <div className="rounded-2xl bg-[hsl(var(--bg-elevated)/0.9)] border-2 border-[hsl(200_80%_62%/0.5)] backdrop-blur-md flex flex-col items-start justify-center gap-2 pl-2 shadow-xl shadow-[hsl(200_80%_62%/0.08)]" style={{ height: 'calc((100vh - 80px) * 0.75)' }}>
            <ChevronRight className="size-4 text-[hsl(var(--color-primary)/0.6)]" />
            <span className="font-display font-extrabold text-base text-[hsl(var(--text-muted))] text-left leading-tight">
              {filteredChords[currentIndex + 1].symbol}
            </span>
          </div>
        </div>
      )}

      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
          opacity: swipePhase === 'exit' ? 0.4 : swipePhase === 'reposition' ? 0 : 1,
          transition:
            swipePhase === 'dragging'
              ? 'none'
              : swipePhase === 'reposition'
                ? 'none'
                : swipePhase === 'exit'
                  ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease-out'
                  : swipePhase === 'enter'
                    ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out'
                    : 'transform 0.25s ease-out, opacity 0.25s ease-out',
        }}
        className="relative z-10 w-full max-w-md max-h-[calc(100vh-80px)] sm:max-h-[calc(100vh-40px)] rounded-2xl border-2 border-[hsl(200_80%_62%/0.45)] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-y-auto animate-in zoom-in-95 duration-200"
      >


        {/* Header */}
        <div className="flex items-start justify-between p-3 pb-0 sm:p-6 sm:pb-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display text-3xl font-extrabold text-[hsl(var(--text-default))]">
                {chord.symbol}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2.5 py-1 sm:px-2 sm:py-0.5 text-[13px] sm:text-[10px] font-body font-medium text-[hsl(var(--text-subtle))] uppercase tracking-wider">
                  {getChordCategoryLabel(chord)}
                </span>
                <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2.5 py-1 sm:px-2 sm:py-0.5 text-[13px] sm:text-[10px] font-body font-medium text-[hsl(var(--text-subtle))] uppercase tracking-wider">
                  {CHORD_TYPE_LABELS[chord.type]}
                </span>
                {chord.rootString && (
                  <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2.5 py-1 sm:px-2 sm:py-0.5 text-[13px] sm:text-[10px] font-body font-medium text-[hsl(var(--text-subtle))] uppercase tracking-wider">
                    Root {chord.rootString}th
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
              {chord.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-9 rounded-lg text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Diagram + Tablature + Play */}
        <div className="flex flex-col items-center gap-2 px-3 pt-2 pb-2 sm:gap-4 sm:px-6 sm:pt-5 sm:pb-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.6)] p-2 sm:p-5">
              {chord.isCustom ? (
                <CustomChordDiagram
                  key={`detail-${chord.id}-${(chord.customBarres ?? []).length}`}
                  chord={{
                    id: chord.id,
                    name: chord.name,
                    symbol: chord.symbol,
                    baseFret: chord.baseFret,
                    numFrets: chord.numFrets ?? 5,
                    mutedStrings: new Set(chord.customMutedStrings ?? []),
                    openStrings: new Set(chord.customOpenStrings ?? []),
                    openDiamonds: new Set(chord.customOpenDiamonds ?? []),
                    markers: chord.customMarkers ?? [],
                    barres: chord.customBarres ?? [],
                    createdAt: 0,
                    updatedAt: 0,
                  }}
                  size="lg"
                />
              ) : (
                <ChordDiagram chord={chord} size="lg" />
              )}
            </div>
            {!chord.isCustom && (
              <div className="shrink-0">
                <ChordTablature chord={chord} size="lg" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => playChord(chord)}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--color-primary))] px-5 py-2.5 text-sm font-display font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] active:scale-[0.97] transition-all duration-150"
            >
              <Volume2 className="size-4" />
              Play
            </button>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-5 py-2.5 text-sm font-display font-bold text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--color-primary)/0.4)] active:scale-[0.97] transition-all duration-150"
            >
              <Edit3 className="size-4" />
              Edit
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs font-body text-[hsl(var(--text-muted))] hidden sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-[hsl(var(--color-primary))]" />
              Finger
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rotate-45 bg-[hsl(200_80%_62%)]" />
              Root Note
            </span>
          </div>
        </div>

        {/* Mobile navigation arrows + position indicator */}
        {filteredChords && filteredChords.length > 1 && (
          <div className="flex items-center justify-between px-3 pb-2 sm:hidden">
            <button
              onClick={() => goPrev()}
              disabled={!hasPrev}
              className={`flex items-center justify-center size-10 rounded-full border transition-all duration-200 active:scale-90 ${
                hasPrev
                  ? 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-default))] active:bg-[hsl(var(--color-primary)/0.15)] active:border-[hsl(var(--color-primary)/0.4)] active:text-[hsl(var(--color-primary))]'
                  : 'border-[hsl(var(--border-subtle)/0.3)] bg-transparent text-[hsl(var(--text-muted)/0.2)] cursor-default'
              }`}
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="text-xs font-display font-bold text-[hsl(var(--text-muted))] tabular-nums">
              {currentIndex + 1} / {filteredChords.length}
            </span>
            <button
              onClick={() => goNext()}
              disabled={!hasNext}
              className={`flex items-center justify-center size-10 rounded-full border transition-all duration-200 active:scale-90 ${
                hasNext
                  ? 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-default))] active:bg-[hsl(var(--color-primary)/0.15)] active:border-[hsl(var(--color-primary)/0.4)] active:text-[hsl(var(--color-primary))]'
                  : 'border-[hsl(var(--border-subtle)/0.3)] bg-transparent text-[hsl(var(--text-muted)/0.2)] cursor-default'
              }`}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        {/* Finger Position Details */}
        <div className="mx-3 mb-3 sm:mx-6 sm:mb-6 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.4)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface)/0.5)]">
            <Guitar className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="font-display text-xs font-semibold text-[hsl(var(--text-subtle))] uppercase tracking-wider">
              Finger Positions
            </span>
            {chord.baseFret > 1 && (
              <span className="ml-auto text-[10px] font-body font-medium text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] rounded px-1.5 py-0.5">
                Start at fret {chord.baseFret}
              </span>
            )}
          </div>
          <div className="divide-y divide-[hsl(var(--border-subtle)/0.5)]">
            {chord.frets.map((fret, i) => {
              const isMuted = fret === -1;
              const isOpen = fret === 0;
              const isRoot = i === chord.rootNoteString;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2 text-sm font-body ${
                    isMuted ? 'opacity-40' : ''
                  } ${isRoot && !isMuted ? 'bg-[hsl(200_80%_62%/0.06)]' : ''}`}
                >
                  <span className={`font-medium w-20 flex items-center gap-1.5 ${
                    isRoot && !isMuted ? 'text-[hsl(200_80%_62%)]' : 'text-[hsl(var(--text-subtle))]'
                  }`}>
                    {STRING_NAMES[i]}
                    {isRoot && !isMuted && (
                      <span className="inline-block size-1.5 rotate-45 bg-[hsl(200_80%_62%)]" />
                    )}
                  </span>
                  <span className={`font-medium ${
                    isMuted
                      ? 'text-[hsl(var(--text-muted))]'
                      : isOpen
                        ? 'text-[hsl(var(--semantic-success))]'
                        : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {getFretLabel(fret)}
                  </span>
                  <span className="text-[hsl(var(--text-muted))] w-16 text-right">
                    {isMuted || isOpen ? '—' : getFingerLabel(chord.fingers[i])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
