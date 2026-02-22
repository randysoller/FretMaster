import { usePracticeStore } from '@/stores/practiceStore';
import type { ChordType } from '@/types/chord';
import { CHORD_TYPE_LABELS } from '@/types/chord';

const CHORD_TYPES: ChordType[] = [
  'major',
  'minor',
  'augmented',
  'slash',
  'diminished',
  'suspended',
  'major7',
  'dominant7',
  'minor7',
  'aug7',
  'halfDim7',
  'dim7',
  '9th',
  '11th',
  '13th',
];

export default function TypeSelector() {
  const { chordTypes, toggleChordType, clearChordTypes } = usePracticeStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
          Chord Type
          <span className="ml-2 normal-case tracking-normal font-normal text-xs text-[hsl(var(--text-muted))]">
            {chordTypes.size === 0 ? '(all selected)' : `(${chordTypes.size} selected)`}
          </span>
        </h3>
        {chordTypes.size > 0 && (
          <button
            onClick={clearChordTypes}
            className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {CHORD_TYPES.map((type) => {
          const isActive = chordTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleChordType(type)}
              className={`
                rounded-md px-3 py-1.5 text-sm font-body font-medium transition-all duration-150
                ${isActive
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                }
              `}
            >
              {CHORD_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
