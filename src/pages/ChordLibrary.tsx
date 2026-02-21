import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CHORDS } from '@/constants/chords';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS, getChordCategoryLabel } from '@/types/chord';
import type { ChordCategory, ChordType, BarreRoot } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import { Search, Filter, X, Volume2 } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import ChordDetailModal from '@/components/features/ChordDetailModal';
import type { ChordData } from '@/types/chord';

export default function ChordLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<Set<ChordCategory>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<ChordType>>(new Set());
  const [filterBarreRoots, setFilterBarreRoots] = useState<Set<BarreRoot>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const { playChord } = useChordAudio();
  const [selectedChord, setSelectedChord] = useState<ChordData | null>(null);
  const closeModal = useCallback(() => setSelectedChord(null), []);



  const toggleCategory = (cat: ChordCategory) => {
    setFilterCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      // Clear root filters if no barre/movable selected
      const hasBM = next.has('barre') || next.has('movable');
      if (!hasBM) setFilterBarreRoots(new Set());
      return next;
    });
  };

  const toggleType = (type: ChordType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleBarreRoot = (root: BarreRoot) => {
    setFilterBarreRoots((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  };

  const showRootFilter = filterCategories.has('barre') || filterCategories.has('movable');

  const matchesSearch = useCallback((chord: ChordData) => {
    return searchQuery === '' ||
      chord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chord.symbol.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  const filteredChords = useMemo(() => {
    return CHORDS.filter((chord) => {
      const matchCategory = filterCategories.size === 0 || filterCategories.has(chord.category);
      const matchType = filterTypes.size === 0 || filterTypes.has(chord.type);
      const matchRoot = filterBarreRoots.size === 0 || !chord.rootString || filterBarreRoots.has(chord.rootString);
      return matchCategory && matchType && matchRoot && matchesSearch(chord);
    });
  }, [filterCategories, filterTypes, filterBarreRoots, matchesSearch]);

  // Counts per category (filtered by current type + root + search)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of ['open', 'barre', 'movable'] as ChordCategory[]) {
      counts[cat] = CHORDS.filter((c) => {
        if (c.category !== cat) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterTypes, filterBarreRoots, matchesSearch]);

  // Counts per type (filtered by current category + root + search)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const type of ['major', 'minor', 'augmented', 'slash', 'diminished', 'suspended', 'major7', 'dominant7', 'minor7', '9th', '11th', '13th'] as ChordType[]) {
      counts[type] = CHORDS.filter((c) => {
        if (c.type !== type) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterBarreRoots, matchesSearch]);

  // Counts per root string (filtered by current category + type + search)
  const rootCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const root of [6, 5, 4] as BarreRoot[]) {
      counts[root] = CHORDS.filter((c) => {
        if (c.rootString !== root) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterTypes, matchesSearch]);

  const clearFilters = () => {
    setFilterCategories(new Set());
    setFilterTypes(new Set());
    setFilterBarreRoots(new Set());
    setSearchQuery('');
  };

  const hasActiveFilters = filterCategories.size > 0 || filterTypes.size > 0 || filterBarreRoots.size > 0 || searchQuery !== '';

  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-extrabold text-[hsl(var(--text-default))]">
                Chord Library
              </h1>
              <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
                Browse all {CHORDS.length} chord diagrams in the collection
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
                <input
                  type="text"
                  placeholder="Search chords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 sm:w-64 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] pl-10 pr-4 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-body font-medium transition-colors
                  ${showFilters
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }
                `}
              >
                <Filter className="size-4" />
                Filters
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] transition-colors"
                >
                  <X className="size-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-8 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6 space-y-5">
              <div className="space-y-2.5">
                <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
                  Category
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(select multiple)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['open', 'barre', 'movable'] as ChordCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all ${
                        filterCategories.has(cat)
                          ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                          : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                      <span className="ml-1 opacity-60">({categoryCounts[cat]})</span>
                    </button>
                  ))}
                </div>
              </div>

              {showRootFilter && (
                <div className="space-y-2.5">
                  <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
                    Root String
                    <span className="ml-1.5 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(select multiple)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {([6, 5, 4] as BarreRoot[]).map((root) => (
                      <button
                        key={String(root)}
                        onClick={() => toggleBarreRoot(root)}
                        className={`rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all ${
                          filterBarreRoots.has(root)
                            ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                        }`}
                      >
                        {BARRE_ROOT_LABELS[root]}
                        <span className="ml-1 opacity-60">({rootCounts[root]})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
                  Type
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(select multiple)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['major', 'minor', 'augmented', 'slash', 'diminished', 'suspended', 'major7', 'dominant7', 'minor7', '9th', '11th', '13th'] as ChordType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all ${
                        filterTypes.has(type)
                          ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                          : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                      }`}
                    >
                      {CHORD_TYPE_LABELS[type]}
                      <span className="ml-1 opacity-60">({typeCounts[type]})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-body text-[hsl(var(--text-muted))]">
              Showing <span className="text-[hsl(var(--color-primary))] font-display font-bold">{filteredChords.length}</span> chord{filteredChords.length !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <span className="text-xs text-[hsl(var(--text-muted))]">
                (filtered)
              </span>
            )}
          </div>

          {/* Legend */}
          <div className="mb-5 flex justify-center">
            <div className="flex items-center gap-6 text-base font-body text-[hsl(var(--text-muted))]">
              <span className="flex items-center gap-2">
                <span className="inline-block size-3.5 rounded-sm bg-[hsl(var(--color-primary))]" />
                Finger Position
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-3.5 rotate-45 bg-[hsl(200_80%_62%)]" />
                Root Note
              </span>
            </div>
          </div>

          {/* Chord Grid */}
          {filteredChords.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              initial="hidden"
              animate="visible"
              key={`${[...filterCategories].join(',')}-${[...filterTypes].join(',')}-${[...filterBarreRoots].join(',')}-${searchQuery}`}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
              }}
            >
              {filteredChords.map((chord) => (
                <motion.div
                  key={chord.id}
                  onClick={() => setSelectedChord(chord)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedChord(chord); }}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
                  }}
                  className="group relative rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.5)] p-4 flex flex-col items-center gap-3 hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--bg-elevated))] hover:scale-[1.03] hover:shadow-[0_0_16px_hsl(var(--color-primary)/0.15),0_0_40px_hsl(var(--color-primary)/0.06)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); playChord(chord); }}
                    className="absolute top-2 right-2 size-9 sm:size-8 flex items-center justify-center rounded-md text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] sm:text-[hsl(var(--text-muted))] sm:bg-transparent sm:opacity-0 sm:group-hover:opacity-100 hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)] active:scale-95 transition-all"
                    title="Play chord"
                  >
                    <Volume2 className="size-4 sm:size-3.5" />
                  </button>
                  <div className="text-center">
                    <h3 className="font-display text-lg font-bold text-[hsl(var(--text-default))] group-hover:text-[hsl(var(--color-primary))] transition-colors">
                      {chord.symbol}
                    </h3>
                    <p className="text-[10px] font-body text-[hsl(var(--text-muted))] mt-0.5 uppercase tracking-wider">
                      {getChordCategoryLabel(chord)}
                    </p>
                  </div>
                  <ChordDiagram chord={chord} size="sm" />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-full bg-[hsl(var(--bg-surface))] flex items-center justify-center mb-4">
                <Search className="size-7 text-[hsl(var(--text-muted))]" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[hsl(var(--text-subtle))]">
                No chords found
              </h3>
              <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))] max-w-sm">
                Try adjusting your filters or search query to find what you're looking for.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      <ChordDetailModal chord={selectedChord} onClose={closeModal} />
    </div>
  );
}
