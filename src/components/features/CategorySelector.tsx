import { useState, useRef, useEffect } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { ChordCategory, BarreRoot } from '@/types/chord';
import { CATEGORY_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import { Guitar, Music2, Grip, ChevronDown, Check } from 'lucide-react';

const CATEGORY_ICONS: Record<ChordCategory, React.ReactNode> = {
  open: <Guitar className="size-4" />,
  barre: <Grip className="size-4" />,
  movable: <Music2 className="size-4" />,
};

const CATEGORY_DESCRIPTIONS: Record<ChordCategory, string> = {
  open: 'Uses open strings for resonant tones',
  barre: 'Full barre shapes across the neck',
  movable: 'Voicings that shift to any position',
};

const CATEGORIES: ChordCategory[] = ['open', 'barre', 'movable'];
const BARRE_ROOTS: BarreRoot[] = [6, 5, 4];

export default function CategorySelector() {
  const { categories, toggleCategory, clearCategories, barreRoots, toggleBarreRoot, clearBarreRoots } = usePracticeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allCategoriesSelected = categories.size === CATEGORIES.length;
  const allRootsSelected = barreRoots.size === BARRE_ROOTS.length;
  const showRootFilter = categories.has('barre') || categories.has('movable') || categories.size === 0 || allCategoriesSelected;

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
    if (categories.size === 0 || allCategoriesSelected) return 'All Chords';
    return [...categories].map((c) => CATEGORY_LABELS[c]).join(', ');
  };

  const handleToggleAll = () => {
    if (allCategoriesSelected && allRootsSelected) {
      clearCategories();
      clearBarreRoots();
    } else {
      for (const cat of CATEGORIES) {
        if (!categories.has(cat)) toggleCategory(cat);
      }
      for (const root of BARRE_ROOTS) {
        if (!barreRoots.has(root)) toggleBarreRoot(root);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base sm:text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
          Shape Category
        </h3>
        {categories.size > 0 && (
          <button
            onClick={() => { clearCategories(); clearBarreRoots(); }}
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
            {categories.size > 0 && categories.size < CATEGORIES.length && (
              <span className="shrink-0 rounded-full bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] text-[10px] font-bold size-5 flex items-center justify-center">
                {categories.size}
              </span>
            )}
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-[hsl(var(--text-muted))] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl shadow-black/40 overflow-hidden overflow-y-auto max-h-[70vh] sm:max-h-[400px] animate-in fade-in slide-in-from-top-2 duration-150">
            {/* All Chords option */}
            <button
              onClick={handleToggleAll}
              className={`
                w-full flex items-center gap-3 px-4 py-4 sm:py-3 text-left transition-colors
                ${allCategoriesSelected && allRootsSelected
                  ? 'bg-[hsl(var(--color-primary)/0.1)]'
                  : 'hover:bg-[hsl(var(--bg-overlay))]'
                }
              `}
            >
              <div className={`size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allCategoriesSelected && allRootsSelected
                  ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
                  : 'border-[hsl(var(--border-default))]'
              }`}>
                {allCategoriesSelected && allRootsSelected && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-display text-lg sm:text-sm font-semibold text-[hsl(var(--text-default))]">
                  All Chords
                </span>
                <p className="text-sm sm:text-[11px] text-[hsl(var(--text-muted))] leading-snug mt-0.5">
                  Include every shape category
                </p>
              </div>
            </button>

            <div className="h-px bg-[hsl(var(--border-subtle))]" />

            {/* Individual categories */}
            {CATEGORIES.map((cat) => {
              const isActive = categories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-4 sm:py-3 text-left transition-colors
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
                  <div className={`shrink-0 ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>
                    {CATEGORY_ICONS[cat]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`font-display text-lg sm:text-sm font-semibold ${
                      isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                    }`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <p className="text-sm sm:text-[11px] text-[hsl(var(--text-muted))] leading-snug mt-0.5">
                      {CATEGORY_DESCRIPTIONS[cat]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Root String Selector — visible when barre/movable are selected or all categories */}
      {showRootFilter && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
              Root String
              <span className="ml-1.5 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">
                {barreRoots.size === 0 ? '(all selected)' : `(${barreRoots.size} selected)`}
              </span>
            </label>
            {barreRoots.size > 0 && (
              <button
                onClick={clearBarreRoots}
                className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {BARRE_ROOTS.map((root) => {
              const isActive = barreRoots.has(root);
              return (
                <button
                  key={String(root)}
                  onClick={() => toggleBarreRoot(root)}
                  className={`
                    rounded-md px-4 py-3 sm:px-3 sm:py-1.5 text-lg sm:text-sm font-body font-medium transition-all duration-150
                    ${isActive
                      ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md'
                      : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                    }
                  `}
                >
                  {BARRE_ROOT_LABELS[root]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
