import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHORDS } from '@/constants/chords';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS, getChordCategoryLabel } from '@/types/chord';
import type { ChordCategory, ChordType, BarreRoot, ChordData } from '@/types/chord';
import ChordDiagram from '@/components/features/ChordDiagram';
import ChordTablature from '@/components/features/ChordTablature';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import { Search, X, Volume2, Edit3, SlidersHorizontal, Check, ChevronDown, Guitar, Grip, Music2, Save, Bookmark, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate as useNav } from 'react-router-dom';
import { useChordAudio } from '@/hooks/useChordAudio';
import ChordDetailModal from '@/components/features/ChordDetailModal';
import { useCustomChordStore } from '@/stores/customChordStore';
import { customToLibraryChord } from '@/types/customChord';
import { useChordLibraryStore } from '@/stores/chordLibraryStore';
import { usePresetStore } from '@/stores/presetStore';

type ExtendedChordData = ChordData & { isCustom?: boolean; customMarkers?: any[]; customBarres?: any[]; customMutedStrings?: number[]; customOpenStrings?: number[]; customOpenDiamonds?: number[]; numFrets?: number };

const ALL_CAT_OPTIONS: ChordCategory[] = ['open', 'barre', 'movable', 'custom'];
const BARRE_ROOTS: BarreRoot[] = [6, 5, 4];
const ALL_CHORD_TYPES: ChordType[] = ['major', 'minor', 'augmented', 'slash', 'diminished', 'suspended', 'major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7', '9th', '11th', '13th'];

const TYPE_GROUPS: { label: string; types: ChordType[] }[] = [
  { label: 'Basic', types: ['major', 'minor', 'augmented', 'diminished', 'suspended', 'slash'] },
  { label: '7th Chords', types: ['major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7'] },
  { label: 'Extended', types: ['9th', '11th', '13th'] },
];

const CATEGORY_ICONS: Record<ChordCategory, React.ReactNode> = {
  open: <Guitar className="size-3.5" />,
  barre: <Grip className="size-3.5" />,
  movable: <Music2 className="size-3.5" />,
  custom: <Edit3 className="size-3.5" />,
};

export default function ChordLibrary() {
  const store = useChordLibraryStore();
  const presetStore = usePresetStore();
  const filterCategories = useMemo(() => new Set(store.filterCategories), [store.filterCategories]);
  const filterTypes = useMemo(() => new Set(store.filterTypes), [store.filterTypes]);
  const filterBarreRoots = useMemo(() => new Set(store.filterBarreRoots), [store.filterBarreRoots]);
  const searchQuery = store.searchQuery;
  const setSearchQuery = store.setSearchQuery;

  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { playChord } = useChordAudio();
  const [selectedChord, setSelectedChord] = useState<ChordData | null>(null);
  const closeModal = useCallback(() => setSelectedChord(null), []);

  // ─── Active preset filter (persisted in store) ───
  const activeLibraryPresetId = store.activeLibraryPresetId;
  const setActiveLibraryPresetId = store.setActiveLibraryPreset;

  const handleToggleLibraryPreset = useCallback((id: string) => {
    setActiveLibraryPresetId(activeLibraryPresetId === id ? null : id);
  }, [activeLibraryPresetId, setActiveLibraryPresetId]);

  // ─── Selection ───
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [presetName, setPresetName] = useState('');
  const presetInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const toggleChordSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback((chords: ExtendedChordData[]) => {
    setSelectedIds(new Set(chords.map((c) => c.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name || selectedIds.size === 0) return;
    presetStore.addPreset(name, [...selectedIds]);
    setShowSaveForm(false);
    setPresetName('');
    setSelectedIds(new Set());
    toast.success(`Preset "${name}" saved with ${selectedIds.size} chords`, {
      description: 'Available on the Chord Practice page under My Presets',
      duration: 4000,
    });
  }, [presetName, selectedIds, presetStore]);

  useEffect(() => {
    if (showSaveForm && presetInputRef.current) {
      presetInputRef.current.focus();
    }
  }, [showSaveForm]);

  const { customChords, editChord: editCustomChord, editStandardChord, hiddenStandardChords } = useCustomChordStore();

  const handleEditChord = useCallback((chord: ChordData & { isCustom?: boolean }) => {
    if (chord.isCustom) {
      editCustomChord(chord.id);
    } else {
      editStandardChord(chord);
    }
    navigate('/editor');
  }, [editCustomChord, editStandardChord, navigate]);

  const ALL_CHORDS = useMemo(() => {
    const converted = customChords.map(customToLibraryChord);
    const replacedIds = new Set(customChords.filter((c) => c.sourceChordId).map((c) => c.sourceChordId!));
    const standardChords = CHORDS.filter((c) => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
    return [...standardChords, ...converted] as ExtendedChordData[];
  }, [customChords, hiddenStandardChords]);

  const toggleCategory = store.toggleCategory;
  const toggleType = store.toggleType;
  const toggleBarreRoot = store.toggleBarreRoot;

  const showRootFilter = filterCategories.has('barre') || filterCategories.has('movable');

  const matchesSearch = useCallback((chord: ChordData) => {
    return searchQuery === '' ||
      chord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chord.symbol.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  const activeLibraryPreset = activeLibraryPresetId ? presetStore.presets.find((p) => p.id === activeLibraryPresetId) : null;

  const filteredChords = useMemo(() => {
    if (activeLibraryPreset) {
      const idSet = new Set(activeLibraryPreset.chordIds);
      return ALL_CHORDS.filter((chord) => idSet.has(chord.id));
    }
    return ALL_CHORDS.filter((chord) => {
      const matchCategory = filterCategories.size === 0 || filterCategories.has(chord.category);
      const matchType = filterTypes.size === 0 || filterTypes.has(chord.type);
      const matchRoot = filterBarreRoots.size === 0 || !chord.rootString || filterBarreRoots.has(chord.rootString);
      return matchCategory && matchType && matchRoot && matchesSearch(chord);
    });
  }, [filterCategories, filterTypes, filterBarreRoots, matchesSearch, ALL_CHORDS, activeLibraryPreset]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of ALL_CAT_OPTIONS) {
      counts[cat] = ALL_CHORDS.filter((c) => {
        if (c.category !== cat) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterTypes, filterBarreRoots, matchesSearch, ALL_CHORDS]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const type of ALL_CHORD_TYPES) {
      counts[type] = ALL_CHORDS.filter((c) => {
        if (c.type !== type) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterBarreRoots.size > 0 && c.rootString && !filterBarreRoots.has(c.rootString)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterBarreRoots, matchesSearch, ALL_CHORDS]);

  const rootCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const root of BARRE_ROOTS) {
      counts[root] = ALL_CHORDS.filter((c) => {
        if (c.rootString !== root) return false;
        if (filterCategories.size > 0 && !filterCategories.has(c.category)) return false;
        if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false;
        return matchesSearch(c);
      }).length;
    }
    return counts;
  }, [filterCategories, filterTypes, matchesSearch, ALL_CHORDS]);

  const clearFilters = store.clearAll;

  const hasActiveFilters = filterCategories.size > 0 || filterTypes.size > 0 || filterBarreRoots.size > 0 || searchQuery !== '';

  useEffect(() => {
    if (!typeSheetOpen || window.innerWidth < 640) return;
    const handler = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setTypeSheetOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeSheetOpen]);

  useEffect(() => {
    if (typeSheetOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [typeSheetOpen]);

  const getTypeSummary = () => {
    if (filterTypes.size === 0) return 'All Types';
    if (filterTypes.size === 1) return CHORD_TYPE_LABELS[[...filterTypes][0]];
    return `${filterTypes.size} types`;
  };

  const handleToggleAllTypes = () => {
    if (filterTypes.size === ALL_CHORD_TYPES.length) {
      store.clearTypes();
    } else {
      store.setFilterTypes([...ALL_CHORD_TYPES]);
    }
  };

  const handleToggleGroup = (types: ChordType[]) => {
    const allSelected = types.every((t) => filterTypes.has(t));
    const current = store.filterTypes;
    if (allSelected) {
      store.setFilterTypes(current.filter((t) => !types.includes(t)));
    } else {
      const merged = new Set([...current, ...types]);
      store.setFilterTypes([...merged]);
    }
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      <div className="px-3 sm:px-6 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-3 sm:mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-default))]">
              Chord Library
            </h1>
            <p className="mt-1 font-body text-xs sm:text-sm text-[hsl(var(--text-muted))]">
              Browse all {ALL_CHORDS.length} chord diagrams — tap the checkbox to select chords for a practice preset
            </p>
          </div>



          {/* ═══════════ MY PRESETS ═══════════ */}
          {presetStore.presets.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="size-3.5 text-[hsl(var(--text-muted))]" />
                <span className="text-[11px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest">
                  Saved Presets
                </span>
                <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">
                  ({presetStore.presets.length})
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 pt-2 -mx-1 px-1">
                {presetStore.presets.map((preset) => {
                  const isActive = activeLibraryPresetId === preset.id;
                  return (
                    <div key={preset.id} className="shrink-0 group/preset relative">
                      <button
                        onClick={() => handleToggleLibraryPreset(preset.id)}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-display font-semibold transition-all active:scale-95 ${
                          isActive
                            ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] shadow-md shadow-[hsl(var(--color-primary)/0.2)]'
                            : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--bg-overlay))]'
                        }`}
                      >
                        <Bookmark className={`size-3.5 ${isActive ? 'fill-current' : ''}`} />
                        <span>{preset.name}</span>
                        <span className={`text-[10px] font-body tabular-nums px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[hsl(var(--color-primary)/0.2)] text-[hsl(var(--color-primary))]'
                            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))]'
                        }`}>
                          {preset.chordIds.length}
                        </span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(confirmDeleteId === preset.id ? null : preset.id); }}
                        className="absolute -top-[2px] -right-1.5 size-6 sm:size-5 rounded-full bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-default))] flex items-center justify-center text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:border-[hsl(var(--semantic-error)/0.5)] opacity-100 sm:opacity-0 sm:group-hover/preset:opacity-100 transition-all"
                      >
                        <X className="size-3" />
                      </button>

                      {/* Confirm delete popover */}
                      <AnimatePresence>
                        {confirmDeleteId === preset.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-48 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl shadow-black/40 p-3"
                          >
                            <p className="text-xs font-body text-[hsl(var(--text-subtle))] mb-2 text-center">Delete this preset?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="flex-1 rounded-lg border border-[hsl(var(--border-default))] py-1.5 text-xs font-body font-medium text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (activeLibraryPresetId === preset.id) store.setActiveLibraryPreset(null); presetStore.removePreset(preset.id); setConfirmDeleteId(null); toast('Preset deleted'); }}
                                className="flex-1 rounded-lg bg-[hsl(var(--semantic-error))] py-1.5 text-xs font-body font-bold text-white active:scale-95 transition-transform"
                              >
                                Delete
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════ STICKY FILTER BAR ═══════════ */}
          <div className="sticky top-[3.5rem] z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-2 bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-md border-b border-[hsl(var(--border-subtle)/0.5)] mb-3 sm:mb-6 space-y-2.5">

            {/* Preset active banner */}
            {activeLibraryPreset && (
              <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--color-primary)/0.1)] border border-[hsl(var(--color-primary)/0.3)] px-3 py-2 -mt-1 mb-1">
                <Bookmark className="size-3.5 text-[hsl(var(--color-primary))] fill-current shrink-0" />
                <span className="text-sm font-body font-medium text-[hsl(var(--color-primary))] truncate">
                  Showing preset: <span className="font-display font-bold">{activeLibraryPreset.name}</span>
                </span>
                <button
                  onClick={() => setActiveLibraryPresetId(null)}
                  className="ml-auto shrink-0 text-xs font-body text-[hsl(var(--color-primary))] hover:underline underline-offset-2"
                >
                  Use filters
                </button>
              </div>
            )}

            {/* Row 1: Search + Type dropdown */}
            <div className={`flex items-center gap-2 transition-opacity duration-200 ${activeLibraryPreset ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
                <input
                  type="text"
                  placeholder="Search chords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] pl-10 pr-9 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Type picker trigger */}
              <div ref={typeDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => setTypeSheetOpen(!typeSheetOpen)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-body font-medium transition-all whitespace-nowrap ${
                    filterTypes.size > 0
                      ? 'border-[hsl(var(--color-primary)/0.5)] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
                      : typeSheetOpen
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-default))]'
                        : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <SlidersHorizontal className="size-4" />
                  <span className="hidden sm:inline">{getTypeSummary()}</span>
                  <span className="sm:hidden">{filterTypes.size > 0 ? filterTypes.size : ''}</span>
                  {filterTypes.size > 0 && (
                    <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] text-[10px] font-bold">
                      {filterTypes.size}
                    </span>
                  )}
                  <ChevronDown className={`size-3.5 transition-transform duration-200 ${typeSheetOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Desktop dropdown */}
                <AnimatePresence>
                  {typeSheetOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="hidden sm:block absolute right-0 top-full mt-2 w-72 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                    >
                      <TypeSheetContent
                        filterTypes={filterTypes}
                        typeCounts={typeCounts}
                        onToggleType={toggleType}
                        onToggleAll={handleToggleAllTypes}
                        onToggleGroup={handleToggleGroup}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 2: Horizontal category chips */}
            <div className={`flex items-center gap-1.5 overflow-x-auto sm:overflow-visible pb-0.5 scrollbar-none -mx-1 px-1 transition-opacity duration-200 ${activeLibraryPreset ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                onClick={store.clearCategories}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] sm:text-xs font-display font-semibold transition-all active:scale-95 ${
                  filterCategories.size === 0
                    ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md shadow-[hsl(var(--color-primary)/0.3)]'
                    : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                }`}
              >
                All
              </button>
              {ALL_CAT_OPTIONS.map((cat) => {
                const isActive = filterCategories.has(cat);
                const count = categoryCounts[cat] ?? 0;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] sm:text-xs font-display font-semibold transition-all active:scale-95 ${
                      isActive
                        ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] shadow-md shadow-[hsl(var(--color-primary)/0.3)]'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                    }`}
                  >
                    {CATEGORY_ICONS[cat]}
                    {CATEGORY_LABELS[cat].replace(' Chords', '').replace('My ', '')}
                    <span className={`text-[10px] font-body tabular-nums ${isActive ? 'opacity-70' : 'opacity-50'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Row 3: Contextual Root String chips */}
            <AnimatePresence>
              {showRootFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 pb-0.5">
                    <span className="text-[11px] font-body text-[hsl(var(--text-muted))] uppercase tracking-wider mr-1 shrink-0">Root:</span>
                    {BARRE_ROOTS.map((root) => {
                      const isActive = filterBarreRoots.has(root);
                      return (
                        <button
                          key={String(root)}
                          onClick={() => toggleBarreRoot(root)}
                          className={`shrink-0 rounded-full px-3 py-1 text-[12px] sm:text-[11px] font-body font-medium transition-all active:scale-95 ${
                            isActive
                              ? 'bg-[hsl(200_80%_62%/0.2)] text-[hsl(200_80%_62%)] border border-[hsl(200_80%_62%/0.4)]'
                              : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] border border-transparent'
                          }`}
                        >
                          {root}th String
                          <span className={`ml-1 text-[10px] tabular-nums ${isActive ? 'opacity-70' : 'opacity-50'}`}>{rootCounts[root]}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══════════ ACTIVE FILTER PILLS + RESULT COUNT ═══════════ */}
          <div className="mb-3 sm:mb-5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-body text-[hsl(var(--text-muted))]">
              <span className="text-[hsl(var(--color-primary))] font-display font-bold">{filteredChords.length}</span> chord{filteredChords.length !== 1 ? 's' : ''}
            </span>

            {filterCategories.size > 0 && [...filterCategories].map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1 rounded-full bg-[hsl(var(--color-primary)/0.12)] border border-[hsl(var(--color-primary)/0.25)] text-[hsl(var(--color-primary))] px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                {CATEGORY_LABELS[cat].replace(' Chords', '')}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="size-3.5 flex items-center justify-center rounded-full hover:bg-[hsl(var(--color-primary)/0.2)] transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            {filterTypes.size > 0 && filterTypes.size <= 3 && [...filterTypes].map((type) => (
              <span
                key={type}
                className="flex items-center gap-1 rounded-full bg-[hsl(var(--color-emphasis)/0.12)] border border-[hsl(var(--color-emphasis)/0.25)] text-[hsl(var(--color-emphasis))] px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                {CHORD_TYPE_LABELS[type]}
                <button
                  onClick={() => toggleType(type)}
                  className="size-3.5 flex items-center justify-center rounded-full hover:bg-[hsl(var(--color-emphasis)/0.2)] transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            {filterTypes.size > 3 && (
              <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--color-emphasis)/0.12)] border border-[hsl(var(--color-emphasis)/0.25)] text-[hsl(var(--color-emphasis))] px-2.5 py-0.5 text-[11px] font-body font-medium">
                {filterTypes.size} types
                <button
                  onClick={store.clearTypes}
                  className="size-3.5 flex items-center justify-center rounded-full hover:bg-[hsl(var(--color-emphasis)/0.2)] transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            )}
            {filterBarreRoots.size > 0 && [...filterBarreRoots].map((root) => (
              <span
                key={String(root)}
                className="flex items-center gap-1 rounded-full bg-[hsl(200_80%_62%/0.12)] border border-[hsl(200_80%_62%/0.25)] text-[hsl(200_80%_62%)] px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                Root {root}th
                <button
                  onClick={() => toggleBarreRoot(root)}
                  className="size-3.5 flex items-center justify-center rounded-full hover:bg-[hsl(200_80%_62%/0.2)] transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[11px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] transition-colors underline underline-offset-2"
              >
                Clear all
              </button>
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

          {/* ═══════════ CHORD GRID ═══════════ */}
          {filteredChords.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
              initial="hidden"
              animate="visible"
              key={`${[...filterCategories].join(',')}-${[...filterTypes].join(',')}-${[...filterBarreRoots].join(',')}-${searchQuery}`}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
              }}
            >
              {filteredChords.map((chord) => {
                const isSelected = selectedIds.has(chord.id);
                return (
                  <motion.div
                    key={chord.id}
                    onClick={() => setSelectedChord(chord)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedChord(chord);
                    }}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
                    }}
                    className={`group relative rounded-lg sm:rounded-xl border p-3 sm:p-4 flex flex-row items-center gap-3 sm:gap-4 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_16px_hsl(var(--color-primary)/0.2)]'
                        : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.5)] hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--bg-elevated))] hover:scale-[1.01] hover:shadow-[0_0_16px_hsl(var(--color-primary)/0.15),0_0_40px_hsl(var(--color-primary)/0.06)]'
                    } active:scale-[0.99]`}
                  >
                    {/* Selection checkbox — always visible */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleChordSelection(chord.id); }}
                      className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 p-0.5"
                      aria-label={isSelected ? 'Deselect chord' : 'Select chord'}
                    >
                      <div className={`size-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))] shadow-[0_0_8px_hsl(var(--color-primary)/0.4)]'
                          : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.8)] hover:border-[hsl(var(--color-primary)/0.5)]'
                      }`}>
                        {isSelected && <Check className="size-3.5 text-[hsl(var(--bg-base))]" />}
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex gap-0.5 sm:gap-1 z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditChord(chord as ChordData & { isCustom?: boolean }); }}
                          className="size-7 flex items-center justify-center rounded-md text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface)/0.8)] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.15)] active:scale-95 transition-all"
                          title="Edit chord"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); playChord(chord); }}
                          className="size-7 flex items-center justify-center rounded-md text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] hover:bg-[hsl(var(--color-primary)/0.15)] active:scale-95 transition-all"
                          title="Play chord"
                        >
                          <Volume2 className="size-3.5" />
                        </button>
                    </div>


                    {/* Left: Chord Diagram */}
                    <div className="shrink-0 ml-5 sm:ml-6">
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
                    </div>

                    {/* Center: Name + Category */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-display text-base sm:text-lg font-bold text-[hsl(var(--text-default))] group-hover:text-[hsl(var(--color-primary))] transition-colors leading-tight truncate">
                        {chord.symbol}
                      </h3>
                      <p className="text-[10px] sm:text-xs font-body text-[hsl(var(--text-muted))] mt-0.5 uppercase tracking-wider">
                        {getChordCategoryLabel(chord)}
                      </p>
                      <p className="text-xs font-body text-[hsl(var(--text-subtle))] mt-0.5">
                        {chord.name}
                      </p>
                    </div>

                    {/* Right: Tablature */}
                    <div className="shrink-0">
                      <ChordTablature chord={chord} size="sm" />
                    </div>
                  </motion.div>
                );
              })}
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

      {/* ═══════════ MOBILE BOTTOM SHEET for Type picker ═══════════ */}
      <AnimatePresence>
        {typeSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setTypeSheetOpen(false)}
              className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="sm:hidden fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl max-h-[75vh] flex flex-col"
            >
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 rounded-full bg-[hsl(var(--border-default))]" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 border-b border-[hsl(var(--border-subtle))]">
                <h3 className="font-display text-lg font-bold text-[hsl(var(--text-default))]">Chord Type</h3>
                <div className="flex items-center gap-3">
                  {filterTypes.size > 0 && (
                    <button
                      onClick={store.clearTypes}
                      className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))]"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => setTypeSheetOpen(false)}
                    className="size-8 flex items-center justify-center rounded-lg text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))]"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-1 pb-8">
                <TypeSheetContent
                  filterTypes={filterTypes}
                  typeCounts={typeCounts}
                  onToggleType={store.toggleType}
                  onToggleAll={handleToggleAllTypes}
                  onToggleGroup={handleToggleGroup}
                  isMobile
                />
              </div>
              <div className="px-5 py-3 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))]">
                <button
                  onClick={() => setTypeSheetOpen(false)}
                  className="w-full rounded-xl bg-[hsl(var(--color-primary))] py-3 text-base font-display font-bold text-[hsl(var(--bg-base))] active:scale-[0.98] transition-transform"
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ChordDetailModal
        chord={selectedChord}
        onClose={closeModal}
        filteredChords={filteredChords}
        onNavigate={setSelectedChord}
      />

      {/* ═══════════ FLOATING SAVE BAR ═══════════ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed bottom-[72px] sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-[420px] z-40"
          >
            <div className="rounded-2xl border border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 backdrop-blur-md p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-[hsl(var(--color-primary))]" />
                  <span className="text-sm font-display font-semibold text-[hsl(var(--text-default))]">
                    <span className="text-[hsl(var(--color-primary))]">{selectedIds.size}</span> chord{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => selectAllVisible(filteredChords)}
                    className="text-[11px] font-body text-[hsl(var(--color-primary))] hover:underline underline-offset-2"
                  >
                    Select all
                  </button>
                  <span className="text-[hsl(var(--border-default))]">·</span>
                  <button
                    onClick={deselectAll}
                    className="text-[11px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {showSaveForm ? (
                  <motion.div
                    key="form"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        ref={presetInputRef}
                        type="text"
                        placeholder="Preset name..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSaveForm(false); }}
                        className="flex-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
                      />
                      <button
                        onClick={handleSavePreset}
                        disabled={!presetName.trim() || selectedIds.size === 0}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[hsl(var(--color-primary))] px-4 py-2.5 text-sm font-display font-bold text-[hsl(var(--bg-base))] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                      >
                        <Save className="size-3.5" />
                        Save
                      </button>
                      <button
                        onClick={() => { setShowSaveForm(false); setPresetName(''); }}
                        className="shrink-0 size-8 flex items-center justify-center rounded-lg text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <button
                      onClick={() => setShowSaveForm(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--color-primary))] py-3 text-sm font-display font-bold text-[hsl(var(--bg-base))] hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <Bookmark className="size-4" />
                      Save as Practice Preset
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ TYPE SHEET CONTENT ═══════════ */

interface TypeSheetContentProps {
  filterTypes: Set<ChordType>;
  typeCounts: Record<string, number>;
  onToggleType: (type: ChordType) => void;
  onToggleAll: () => void;
  onToggleGroup: (types: ChordType[]) => void;
  isMobile?: boolean;
}

function TypeSheetContent({ filterTypes, typeCounts, onToggleType, onToggleAll, onToggleGroup, isMobile }: TypeSheetContentProps) {
  const allSelected = filterTypes.size === ALL_CHORD_TYPES.length;
  const py = isMobile ? 'py-3.5' : 'py-2.5';
  const textSize = isMobile ? 'text-base' : 'text-sm';
  const groupTextSize = isMobile ? 'text-xs' : 'text-[10px]';

  return (
    <>
      <button
        onClick={onToggleAll}
        className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
          allSelected ? 'bg-[hsl(var(--color-primary)/0.1)]' : 'hover:bg-[hsl(var(--bg-overlay))]'
        }`}
      >
        <CheckboxIcon checked={allSelected} />
        <span className={`flex-1 font-display ${textSize} font-semibold text-[hsl(var(--text-default))]`}>All Types</span>
      </button>

      <div className="h-px bg-[hsl(var(--border-subtle))]" />

      {TYPE_GROUPS.map((group) => {
        const allInGroup = group.types.every((t) => filterTypes.has(t));
        const someInGroup = group.types.some((t) => filterTypes.has(t)) && !allInGroup;
        return (
          <div key={group.label}>
            <button
              onClick={() => onToggleGroup(group.types)}
              className={`w-full flex items-center gap-3 px-4 pt-3 pb-1.5 text-left transition-colors hover:bg-[hsl(var(--bg-overlay))] ${allInGroup ? 'bg-[hsl(var(--color-primary)/0.05)]' : ''}`}
            >
              <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allInGroup
                  ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
                  : someInGroup
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.3)]'
                    : 'border-[hsl(var(--border-default))]'
              }`}>
                {allInGroup && <Check className="size-2.5 text-[hsl(var(--bg-base))]" />}
                {someInGroup && <div className="size-1.5 rounded-sm bg-[hsl(var(--color-primary))]" />}
              </div>
              <span className={`font-display ${groupTextSize} font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest`}>
                {group.label}
              </span>
            </button>

            {group.types.map((type) => {
              const isActive = filterTypes.has(type);
              const count = typeCounts[type] ?? 0;
              return (
                <button
                  key={type}
                  onClick={() => onToggleType(type)}
                  className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
                    isActive ? 'bg-[hsl(var(--color-primary)/0.08)]' : 'hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <CheckboxIcon checked={isActive} />
                  <span className={`flex-1 font-body ${textSize} font-medium ${
                    isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {CHORD_TYPE_LABELS[type]}
                  </span>
                  <span className={`text-[11px] font-body tabular-nums ${isActive ? 'text-[hsl(var(--color-primary)/0.6)]' : 'text-[hsl(var(--text-muted)/0.5)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <div className={`size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
      checked
        ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]'
        : 'border-[hsl(var(--border-default))]'
    }`}>
      {checked && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
    </div>
  );
}
