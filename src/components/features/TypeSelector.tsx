import { useState, useRef, useEffect } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { ChordType } from '@/types/chord';
import { CHORD_TYPE_LABELS } from '@/types/chord';
import { ChevronDown, Check } from 'lucide-react';

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

const TYPE_GROUPS: { label: string; types: ChordType[] }[] = [
  { label: 'Basic', types: ['major', 'minor', 'augmented', 'diminished', 'suspended', 'slash'] },
  { label: '7th Chords', types: ['major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7'] },
  { label: 'Extended', types: ['9th', '11th', '13th'] },
];

export default function TypeSelector({ accentIcon }: { accentIcon?: React.ReactNode }) {
  const { chordTypes, toggleChordType, clearChordTypes } = usePracticeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allTypesSelected = chordTypes.size === CHORD_TYPES.length;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const getSummaryText = () => {
    if (chordTypes.size === 0 || allTypesSelected) return 'All Types';
    if (chordTypes.size <= 3) return [...chordTypes].map((t) => CHORD_TYPE_LABELS[t]).join(', ');
    return `${chordTypes.size} types selected`;
  };

  const handleToggleAll = () => {
    if (allTypesSelected) {
      clearChordTypes();
    } else {
      for (const type of CHORD_TYPES) {
        if (!chordTypes.has(type)) toggleChordType(type);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {accentIcon}
          <h3 className="font-display text-base sm:text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
            Chord Type
          </h3>
        </div>
        {chordTypes.size > 0 && (
          <button
            onClick={() => { clearChordTypes(); }}
            className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200
            ${isOpen
              ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] ring-1 ring-[hsl(var(--color-primary)/0.3)]'
              : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] hover:border-[hsl(var(--border-default)/0.8)] hover:bg-[hsl(var(--bg-overlay))]'
            }
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-body text-lg sm:text-sm font-medium text-[hsl(var(--text-default))] truncate">
              {getSummaryText()}
            </span>
            {chordTypes.size > 0 && chordTypes.size < CHORD_TYPES.length && (
              <span className="shrink-0 rounded-full bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] text-[10px] font-bold size-5 flex items-center justify-center">
                {chordTypes.size}
              </span>
            )}
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-[hsl(var(--text-muted))] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[70vh] sm:max-h-[360px] overflow-y-auto">
            {/* All Types option */}
            <button
              onClick={handleToggleAll}
              className={`
                w-full flex items-center gap-3 px-4 py-4 sm:py-3 text-left transition-colors
                ${allTypesSelected
                  ? 'bg-[hsl(var(--color-primary)/0.1)]'
                  : 'hover:bg-[hsl(var(--bg-overlay))]'
                }
              `}
            >
              <div className={`size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allTypesSelected
                  ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
                  : 'border-[hsl(var(--border-default))]'
              }`}>
                {allTypesSelected && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-display text-lg sm:text-sm font-semibold text-[hsl(var(--text-default))]">
                  All Types
                </span>
                <p className="text-sm sm:text-[11px] text-[hsl(var(--text-muted))] leading-snug mt-0.5">
                  Include every chord type
                </p>
              </div>
            </button>

            <div className="h-px bg-[hsl(var(--border-subtle))]" />

            {/* Grouped types */}
            {TYPE_GROUPS.map((group) => {
              const allInGroupSelected = group.types.every((t) => chordTypes.has(t));
              const someInGroupSelected = group.types.some((t) => chordTypes.has(t)) && !allInGroupSelected;

              const handleToggleGroup = () => {
                if (allInGroupSelected) {
                  for (const t of group.types) {
                    if (chordTypes.has(t)) toggleChordType(t);
                  }
                } else {
                  for (const t of group.types) {
                    if (!chordTypes.has(t)) toggleChordType(t);
                  }
                }
              };

              return (
              <div key={group.label}>
                <button
                  onClick={handleToggleGroup}
                  className={`w-full flex items-center gap-3 px-4 pt-3 pb-1.5 text-left transition-colors hover:bg-[hsl(var(--bg-overlay))] ${allInGroupSelected ? 'bg-[hsl(var(--color-primary)/0.05)]' : ''}`}
                >
                  <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    allInGroupSelected
                      ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
                      : someInGroupSelected
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.3)]'
                        : 'border-[hsl(var(--border-default))]'
                  }`}>
                    {allInGroupSelected && <Check className="size-2.5 text-[hsl(var(--bg-base))]" />}
                    {someInGroupSelected && <div className="size-1.5 rounded-sm bg-[hsl(var(--color-primary))]" />}
                  </div>
                  <span className="font-display text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest">
                    {group.label}
                  </span>
                </button>
                {group.types.map((type) => {
                  const isActive = chordTypes.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleChordType(type)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3.5 sm:py-2.5 text-left transition-colors
                        ${isActive ? 'bg-[hsl(var(--color-primary)/0.08)]' : 'hover:bg-[hsl(var(--bg-overlay))]'}
                      `}
                    >
                      <div className={`size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
                          : 'border-[hsl(var(--border-default))]'
                      }`}>
                        {isActive && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
                      </div>
                      <span className={`font-body text-lg sm:text-sm font-medium ${
                        isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                      }`}>
                        {CHORD_TYPE_LABELS[type]}
                      </span>
                    </button>
                  );
                })}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
