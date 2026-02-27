import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CHORDS } from '@/constants/chords';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS, getChordCategoryLabel } from '@/types/chord';
import type { ChordCategory, ChordType, BarreRoot } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import { Search, Filter, X, Volume2, Edit3 } from 'lucide-react';
import { useChordAudio } from '@/hooks/useChordAudio';
import ChordDetailModal from '@/components/features/ChordDetailModal';
import type { ChordData } from '@/types/chord';
import { useCustomChordStore } from '@/stores/customChordStore';
import { customToLibraryChord } from '@/types/customChord';

export default function ChordLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<Set<ChordCategory>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<ChordType>>(new Set());
  const [filterBarreRoots, setFilterBarreRoots] = useState<Set<BarreRoot>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const navigate = useNavigate();
  const { playChord } = useChordAudio();
  const [selectedChord, setSelectedChord] = useState<ChordData | null>(null);
  const closeModal = useCallback(() => setSelectedChord(null), []);



  const { customChords, editChord: editCustomChord, editStandardChord, hiddenStandardChords } = useCustomChordStore();

  const handleEditChord = useCallback((chord: ChordData & { isCustom?: boolean }) => {
    if (chord.isCustom) {
      editCustomChord(chord.id);
    } else {
      editStandardChord(chord);
    }
    navigate('/editor');
  }, [editCustomChord, editStandardChord, navigate]);

  // Merge built-in + custom chords, filtering out replaced/hidden standard chords
  const ALL_CHORDS = useMemo(() => {
    const converted = customChords.map(customToLibraryChord);
    const replacedIds = new Set(customChords.filter((c) => c.sourceChordId).map((c) => c.sourceChordId!));
    const standardChords = CHORDS.filter((c) => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
    return [...standardChords, ...converted] as (ChordData & { isCustom?: boolean; customMarkers?: any[]; customBarres?: any[]; customMutedStrings?: number[]; customOpenStrings?: number[]; customOpenDiamonds?: number[]; numFrets?: number })[];
  }, [customChords, hiddenStandardChords]);


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
  const allCatOptions: ChordCategory[] = ['open', 'barre', 'movable', 'custom'];

  const matchesSearch = useCallback((chord: ChordData) => {
    return searchQuery === '' ||
      chord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chord.symbol.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  const filteredChords = useMemo(() => {
    return ALL_CHORDS.filter((chord) => {
      const matchCategory = filterCategories.size === 0 || filterCategories.has(chord.category);
      const matchType = filterTypes.size === 0 || filterTypes.has(chord.type);
      const matchRoot = filterBarreRoots.size === 0 || !chord.rootString || filterBarreRoots.has(chord.rootString);
      return matchCategory && matchType && matchRoot && matchesSearch(chord);
    });
  }, [filterCategories, filterTypes, filterBarreRoots, matchesSearch, ALL_CHORDS]);

  // Counts per category (filtered by current type + root + search)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of allCatOptions) {
      counts[cat] = ALL_CHORDS.filter((c) => {
        if (c.category !== cat) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterTypes, filterBarreRoots, matchesSearch, ALL_CHORDS]);

  // Counts per type (filtered by current category + root + search)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const type of ['major', 'minor', 'augmented', 'slash', 'diminished', 'suspended', 'major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7', '9th', '11th', '13th'] as ChordType[]) {
      counts[type] = ALL_CHORDS.filter((c) => {
        if (c.type !== type) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterBarreRoots, matchesSearch, ALL_CHORDS]);

  // Counts per root string (filtered by current category + type + search)
  const rootCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const root of [6, 5, 4] as BarreRoot[]) {
      counts[root] = ALL_CHORDS.filter((c) => {
        if (c.rootString !== root) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterTypes, matchesSearch, ALL_CHORDS]);

  const clearFilters = () => {
    setFilterCategories(new Set());
    setFilterTypes(new Set());
    setFilterBarreRoots(new Set());
    setSearchQuery('');
  };

  const hasActiveFilters = filterCategories.size > 0 || filterTypes.size > 0 || filterBarreRoots.size > 0 || searchQuery !== '';

  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
      <div className="px-3 sm:px-6 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-default))]">
              Chord Library
            </h1>
            <p className="mt-1 font-body text-xs sm:text-sm text-[hsl(var(--text-muted))]">
              Browse all {ALL_CHORDS.length} chord diagrams in the collection
            </p>
          </div>

          {/* Sticky Search/Filter Bar */}
          <div className="sticky top-[3.5rem] z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-md border-b border-[hsl(var(--border-subtle)/0.5)] mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
                <input
                  type="text"
                  placeholder="Search chords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] pl-10 pr-4 py-2 sm:py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-body font-medium transition-colors shrink-0
                  ${showFilters
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }
                `}
              >
                <Filter className="size-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] transition-colors shrink-0"
                >
                  <X className="size-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-4 sm:mb-8 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-3 sm:p-6 space-y-4 sm:space-y-5">
              <div className="space-y-2.5">
                <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
                  Category
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(select multiple)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const allCats = filterCategories.size === allCatOptions.length;
                      const allRoots = filterBarreRoots.size === 3;
                      if (allCats && allRoots) {
                        setFilterCategories(new Set());
                        setFilterBarreRoots(new Set());
                      } else {
                        setFilterCategories(new Set<ChordCategory>(allCatOptions));
                        setFilterBarreRoots(new Set<BarreRoot>([6, 5, 4]));
                      }
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-body font-semibold uppercase tracking-wider transition-all ${
                      filterCategories.size === allCatOptions.length && filterBarreRoots.size === 3
                        ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                    }`}
                  >
                    All Chords
                  </button>
                  {allCatOptions.map((cat) => (
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
                  {(['major', 'minor', 'augmented', 'slash', 'diminished', 'suspended', 'major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7', '9th', '11th', '13th'] as ChordType[]).map((type) => (
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
          <div className="mb-2 sm:mb-3 flex items-center gap-3">
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
          <div className="mb-3 sm:mb-5 flex justify-center">
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-base font-body text-[hsl(var(--text-muted))]">
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
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4"
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
                  className="group relative rounded-lg sm:rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.5)] p-2 sm:p-4 flex flex-col items-center gap-1.5 sm:gap-3 hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--bg-elevated))] hover:scale-[1.03] hover:shadow-[0_0_16px_hsl(var(--color-primary)/0.15),0_0_40px_hsl(var(--color-primary)/0.06)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-0.5 sm:gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditChord(chord as ChordData & { isCustom?: boolean }); }}
                      className="size-6 sm:size-7 flex items-center justify-center rounded-md text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface)/0.8)] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.15)] active:scale-95 transition-all"
                      title="Edit chord"
                    >
                      <Edit3 className="size-2.5 sm:size-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); playChord(chord); }}
                      className="size-6 sm:size-7 flex items-center justify-center rounded-md text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] hover:bg-[hsl(var(--color-primary)/0.15)] active:scale-95 transition-all"
                      title="Play chord"
                    >
                      <Volume2 className="size-3 sm:size-3.5" />
                    </button>
                  </div>
                  {(chord as any).isCustom && !(chord as any).sourceChordId && (
                    <span className="absolute top-1 left-1 sm:top-2 sm:left-2 rounded px-1 sm:px-1.5 py-0.5 text-[6px] sm:text-[8px] font-display font-bold uppercase tracking-wider bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]">
                      Custom
                    </span>
                  )}
                  <div className="text-center mt-1 sm:mt-0">
                    <h3 className="font-display text-sm sm:text-lg font-bold text-[hsl(var(--text-default))] group-hover:text-[hsl(var(--color-primary))] transition-colors leading-tight">
                      {chord.symbol}
                    </h3>
                    <p className="text-[8px] sm:text-[10px] font-body text-[hsl(var(--text-muted))] mt-0.5 uppercase tracking-wider">
                      {getChordCategoryLabel(chord)}
                    </p>
                  </div>
                  {(chord as any).isCustom ? (
                    <CustomChordDiagram
                      key={`custom-${chord.id}-${((chord as any).customBarres ?? []).length}-${((chord as any).customMarkers ?? []).length}`}
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
                      size="sm"
                    />
                  ) : (
                    <ChordDiagram chord={chord} size="sm" />
                  )}
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
