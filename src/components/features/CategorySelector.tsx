import { usePracticeStore } from '@/stores/practiceStore';
import type { ChordCategory, BarreRoot } from '@/types/chord';
import { CATEGORY_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import { Guitar, Music2, Grip } from 'lucide-react';

const CATEGORY_ICONS: Record<ChordCategory, React.ReactNode> = {
  open: <Guitar className="size-5" />,
  barre: <Grip className="size-5" />,
  movable: <Music2 className="size-5" />,
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

  const allCategoriesSelected = categories.size === CATEGORIES.length;
  const allRootsSelected = barreRoots.size === BARRE_ROOTS.length;
  const showRootFilter = categories.has('barre') || categories.has('movable') || categories.size === 0 || allCategoriesSelected;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
          Shape Category
          <span className="ml-2 normal-case tracking-normal font-normal text-xs text-[hsl(var(--text-muted))]">
            {categories.size === 0 || allCategoriesSelected ? '(all selected)' : `(${categories.size} selected)`}
          </span>
        </h3>
        {categories.size > 0 && (
          <button
            onClick={clearCategories}
            className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* All Chords quick-select / deselect toggle */}
      <button
        onClick={() => {
          if (allCategoriesSelected && allRootsSelected) {
            // Deselect everything
            clearCategories();
            clearBarreRoots();
          } else {
            // Select ALL categories and ALL root strings
            for (const cat of CATEGORIES) {
              if (!categories.has(cat)) toggleCategory(cat);
            }
            for (const root of BARRE_ROOTS) {
              if (!barreRoots.has(root)) toggleBarreRoot(root);
            }
          }
        }}
        className={`
          rounded-md px-3 py-1.5 text-xs font-body font-semibold uppercase tracking-wider transition-all duration-150
          ${allCategoriesSelected && allRootsSelected
            ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md'
            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
          }
        `}
      >
        All Chords
      </button>

      <div className="grid grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const isActive = categories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`
                group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all duration-200
                ${isActive
                  ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] glow-primary'
                  : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] hover:border-[hsl(var(--border-default)/0.8)] hover:bg-[hsl(var(--bg-overlay))]'
                }
              `}
            >
              <div className={`
                flex items-center gap-2
                ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--text-subtle))]'}
              `}>
                {CATEGORY_ICONS[cat]}
                <span className="font-display text-base font-semibold">
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isActive ? 'text-[hsl(var(--text-subtle))]' : 'text-[hsl(var(--text-muted))]'}`}>
                {CATEGORY_DESCRIPTIONS[cat]}
              </p>
            </button>
          );
        })}
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
                    rounded-md px-3 py-1.5 text-sm font-body font-medium transition-all duration-150
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
