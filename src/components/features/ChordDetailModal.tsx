import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChordData } from '@/types/chord';
import { CHORD_TYPE_LABELS, getChordCategoryLabel } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import { X, Volume2, Guitar, Edit3 } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import { useCustomChordStore } from '@/stores/customChordStore';

interface ChordDetailModalProps {
  chord: (ChordData & { isCustom?: boolean; customMarkers?: any[]; customBarres?: any[]; customMutedStrings?: number[]; customOpenStrings?: number[]; customOpenDiamonds?: number[]; numFrets?: number }) | null;
  onClose: () => void;
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

export default function ChordDetailModal({ chord, onClose }: ChordDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { playChord } = useChordAudio();
  const { editChord: editCustomChord, editStandardChord } = useCustomChordStore();

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

  if (!chord) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-[hsl(var(--text-default))]">
              {chord.symbol}
            </h2>
            <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
              {chord.name}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[10px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                {getChordCategoryLabel(chord)}
              </span>
              <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[10px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                {CHORD_TYPE_LABELS[chord.type]}
              </span>
              {chord.rootString && (
                <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[10px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                  Root {chord.rootString}th
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-9 rounded-lg text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Diagram + Play */}
        <div className="flex flex-col items-center gap-4 px-6 pt-5 pb-4">
          <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.6)] p-5">
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
          <div className="flex items-center gap-4 text-xs font-body text-[hsl(var(--text-muted))]">
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

        {/* Finger Position Details */}
        <div className="mx-6 mb-6 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.4)] overflow-hidden">
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
