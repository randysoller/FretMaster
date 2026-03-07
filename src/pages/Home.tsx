import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePracticeStore } from '@/stores/practiceStore';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import type { ChordCategory, ChordType, BarreRoot } from '@/types/chord';
import { KEY_SIGNATURES } from '@/constants/scales';
import type { KeySignature } from '@/constants/scales';
import {
  Play, Music, AlertCircle, ChevronDown, X, KeyRound, Shapes, Layers,
  Guitar, Grip, Music2, Check, SlidersHorizontal,
} from 'lucide-react';
import heroImg from '@/assets/hero-guitar.jpg';

const ALL_CATEGORIES: ChordCategory[] = ['open', 'barre', 'movable'];
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
  custom: null,
};

type SheetId = 'key' | 'category' | 'type' | null;

export default function Home() {
  const navigate = useNavigate();
  const store = usePracticeStore();
  const { startPractice, getAvailableCount, categories, chordTypes, barreRoots, keyFilter, setKeyFilter } = store;
  const availableCount = getAvailableCount();

  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const keyDropdownRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const toggleSheet = useCallback((id: SheetId) => {
    setActiveSheet((prev) => (prev === id ? null : id));
  }, []);

  const hasBorreOrMovable = categories.has('barre') || categories.has('movable');

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!activeSheet || window.innerWidth < 640) return;
    const handler = (e: MouseEvent) => {
      const refs = { key: keyDropdownRef, category: catDropdownRef, type: typeDropdownRef };
      const ref = refs[activeSheet];
      if (ref?.current && !ref.current.contains(e.target as Node)) setActiveSheet(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeSheet]);

  // Lock body scroll when sheet open on mobile
  useEffect(() => {
    if (activeSheet && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [activeSheet]);

  const handleStart = () => {
    if (availableCount === 0) return;
    startPractice();
    navigate('/practice');
  };

  // ─── Summary helpers ───
  const getKeySummary = () => keyFilter ? `${keyFilter.display} Major` : 'Chords in a Key';
  const getCatSummary = () => {
    if (categories.size === 0) return 'All Shapes';
    if (categories.size === 1) return CATEGORY_LABELS[[...categories][0]].replace(' Chords', '');
    return `${categories.size} shapes`;
  };
  const getTypeSummary = () => {
    if (chordTypes.size === 0) return 'All Types';
    if (chordTypes.size === 1) return CHORD_TYPE_LABELS[[...chordTypes][0]];
    return `${chordTypes.size} types`;
  };

  const hasActiveFilters = categories.size > 0 || chordTypes.size > 0 || barreRoots.size > 0 || keyFilter !== null;

  const clearAll = () => {
    store.clearCategories();
    store.clearChordTypes();
    store.clearBarreRoots();
    store.setKeyFilter(null);
  };

  const handleToggleAllTypes = () => {
    if (chordTypes.size === ALL_CHORD_TYPES.length) {
      store.clearChordTypes();
    } else {
      for (const t of ALL_CHORD_TYPES) {
        if (!chordTypes.has(t)) store.toggleChordType(t);
      }
    }
  };

  const handleToggleGroup = (types: ChordType[]) => {
    const allSelected = types.every((t) => chordTypes.has(t));
    if (allSelected) {
      for (const t of types) { if (chordTypes.has(t)) store.toggleChordType(t); }
    } else {
      for (const t of types) { if (!chordTypes.has(t)) store.toggleChordType(t); }
    }
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Guitar fretboard" className="size-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--bg-base)/0.3)] via-[hsl(var(--bg-base)/0.7)] to-[hsl(var(--bg-base))]" />
        </div>
        <div className="relative px-4 sm:px-6 py-10 sm:py-16 md:py-24 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-6">
            <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Guitar Chord Trainer</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight text-balance">
            <span className="text-[hsl(var(--text-default))]">Master Every Chord.</span>
            <br />
            <span className="text-gradient">One Fret at a Time.</span>
          </h1>
          <p className="mt-3 sm:mt-5 font-body text-sm sm:text-base md:text-lg text-[hsl(var(--text-subtle))] max-w-xl mx-auto text-pretty">
            Challenge yourself with timed chord reveals. Pick a category, set your timer, and test how well you know your fretboard.
          </p>
        </div>
      </div>

      {/* ═══════════ SETUP SECTION ═══════════ */}
      <div className="px-3 sm:px-6 pb-12 sm:pb-16 -mt-2 sm:-mt-4">
        <div className="max-w-5xl mx-auto">

          {/* ═══════════ STICKY FILTER BAR ═══════════ */}
          <div className="sticky top-[3.5rem] z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-2 bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-md border-b border-[hsl(var(--border-subtle)/0.5)] mb-4 sm:mb-6 space-y-2.5">

            {/* Row 1: Three filter chips — Key | Category | Type */}
            <div className="flex items-center gap-2 overflow-x-auto sm:overflow-visible scrollbar-none -mx-1 px-1 pb-0.5">
              {/* Key chip */}
              <div ref={keyDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => toggleSheet('key')}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-body font-medium transition-all whitespace-nowrap active:scale-95 ${
                    keyFilter
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : activeSheet === 'key'
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-default))]'
                        : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <KeyRound className="size-4" />
                  <span>{getKeySummary()}</span>
                  <ChevronDown className={`size-3.5 transition-transform duration-200 ${activeSheet === 'key' ? 'rotate-180' : ''}`} />
                </button>

                {/* Desktop key dropdown */}
                <AnimatePresence>
                  {activeSheet === 'key' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="hidden sm:block absolute left-0 top-full mt-2 w-80 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                    >
                      <KeySheetContent keyFilter={keyFilter} onSelect={(ks) => { setKeyFilter(ks); setActiveSheet(null); }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category chip */}
              <div ref={catDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => toggleSheet('category')}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-body font-medium transition-all whitespace-nowrap active:scale-95 ${
                    categories.size > 0
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : activeSheet === 'category'
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-default))]'
                        : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <Shapes className="size-4" />
                  <span>{getCatSummary()}</span>
                  {categories.size > 0 && (
                    <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[hsl(var(--bg-base))] text-[10px] font-bold">
                      {categories.size}
                    </span>
                  )}
                  <ChevronDown className={`size-3.5 transition-transform duration-200 ${activeSheet === 'category' ? 'rotate-180' : ''}`} />
                </button>

                {/* Desktop category dropdown */}
                <AnimatePresence>
                  {activeSheet === 'category' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="hidden sm:block absolute left-0 top-full mt-2 w-72 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                    >
                      <CategorySheetContent
                        categories={categories}
                        barreRoots={barreRoots}
                        onToggleCategory={store.toggleCategory}
                        onClearCategories={store.clearCategories}
                        onToggleBarreRoot={store.toggleBarreRoot}
                        onClearBarreRoots={store.clearBarreRoots}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Type chip */}
              <div ref={typeDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => toggleSheet('type')}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-body font-medium transition-all whitespace-nowrap active:scale-95 ${
                    chordTypes.size > 0
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                      : activeSheet === 'type'
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-default))]'
                        : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <Layers className="size-4" />
                  <span className="hidden sm:inline">{getTypeSummary()}</span>
                  <span className="sm:hidden">{chordTypes.size > 0 ? `${chordTypes.size} types` : 'Types'}</span>
                  {chordTypes.size > 0 && (
                    <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-violet-500 text-[hsl(var(--bg-base))] text-[10px] font-bold">
                      {chordTypes.size}
                    </span>
                  )}
                  <ChevronDown className={`size-3.5 transition-transform duration-200 ${activeSheet === 'type' ? 'rotate-180' : ''}`} />
                </button>

                {/* Desktop type dropdown */}
                <AnimatePresence>
                  {activeSheet === 'type' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="hidden sm:block absolute left-0 top-full mt-2 w-72 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                    >
                      <TypeSheetContent
                        chordTypes={chordTypes}
                        onToggleType={store.toggleChordType}
                        onToggleAll={handleToggleAllTypes}
                        onToggleGroup={handleToggleGroup}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 2: Contextual Root String chips — slide in when barre/movable selected */}
            <AnimatePresence>
              {hasBorreOrMovable && (
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
                      const isActive = barreRoots.has(root);
                      return (
                        <button
                          key={String(root)}
                          onClick={() => store.toggleBarreRoot(root)}
                          className={`shrink-0 rounded-full px-3 py-1 text-[12px] sm:text-[11px] font-body font-medium transition-all active:scale-95 ${
                            isActive
                              ? 'bg-[hsl(200_80%_62%/0.2)] text-[hsl(200_80%_62%)] border border-[hsl(200_80%_62%/0.4)]'
                              : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] border border-transparent'
                          }`}
                        >
                          {root}th String
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══════════ ACTIVE FILTER PILLS + CHORD COUNT ═══════════ */}
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-body text-[hsl(var(--text-muted))]">
              <span className="text-[hsl(var(--color-primary))] font-display font-bold">{availableCount}</span> chord{availableCount !== 1 ? 's' : ''} available
            </span>

            {keyFilter && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/12 border border-amber-500/25 text-amber-400 px-2.5 py-0.5 text-[11px] font-body font-medium">
                {keyFilter.display} Major
                <button onClick={() => setKeyFilter(null)} className="size-3.5 flex items-center justify-center rounded-full hover:bg-amber-500/20 transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            )}
            {categories.size > 0 && [...categories].map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                {CATEGORY_LABELS[cat].replace(' Chords', '')}
                <button onClick={() => store.toggleCategory(cat)} className="size-3.5 flex items-center justify-center rounded-full hover:bg-emerald-500/20 transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            {chordTypes.size > 0 && chordTypes.size <= 3 && [...chordTypes].map((type) => (
              <span
                key={type}
                className="flex items-center gap-1 rounded-full bg-violet-500/12 border border-violet-500/25 text-violet-400 px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                {CHORD_TYPE_LABELS[type]}
                <button onClick={() => store.toggleChordType(type)} className="size-3.5 flex items-center justify-center rounded-full hover:bg-violet-500/20 transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            {chordTypes.size > 3 && (
              <span className="flex items-center gap-1 rounded-full bg-violet-500/12 border border-violet-500/25 text-violet-400 px-2.5 py-0.5 text-[11px] font-body font-medium">
                {chordTypes.size} types
                <button onClick={store.clearChordTypes} className="size-3.5 flex items-center justify-center rounded-full hover:bg-violet-500/20 transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            )}
            {barreRoots.size > 0 && [...barreRoots].map((root) => (
              <span
                key={String(root)}
                className="flex items-center gap-1 rounded-full bg-[hsl(200_80%_62%/0.12)] border border-[hsl(200_80%_62%/0.25)] text-[hsl(200_80%_62%)] px-2.5 py-0.5 text-[11px] font-body font-medium"
              >
                Root {root}th
                <button onClick={() => store.toggleBarreRoot(root)} className="size-3.5 flex items-center justify-center rounded-full hover:bg-[hsl(200_80%_62%/0.2)] transition-colors">
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
            {hasActiveFilters && (
              <button onClick={clearAll} className="text-[11px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] transition-colors underline underline-offset-2">
                Clear all
              </button>
            )}
          </div>

          {/* ═══════════ SUMMARY + START ═══════════ */}
          <div className="max-w-md mx-auto lg:max-w-lg">
            <div className="relative rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis)/0.3)]" />
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-lg bg-[hsl(var(--color-primary)/0.15)]">
                  <Play className="size-4 text-[hsl(var(--color-primary))]" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                  Ready to Practice
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-body">
                  <span className="text-[hsl(var(--text-muted))]">Category</span>
                  <span className="text-[hsl(var(--text-default))] font-medium">
                    {categories.size === 0 || categories.size === 3
                      ? 'All Chords'
                      : [...categories].map((c) => CATEGORY_LABELS[c].replace(' Chords', '')).join(', ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-body">
                  <span className="text-[hsl(var(--text-muted))]">Type</span>
                  <span className="text-[hsl(var(--text-default))] font-medium truncate ml-4 text-right">
                    {chordTypes.size === 0
                      ? 'All Types'
                      : chordTypes.size <= 3
                        ? [...chordTypes].map((t) => CHORD_TYPE_LABELS[t]).join(', ')
                        : `${chordTypes.size} types`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-body">
                  <span className="text-[hsl(var(--text-muted))]">Key</span>
                  <span className="text-[hsl(var(--text-default))] font-medium">
                    {keyFilter ? `${keyFilter.display} Major` : 'All'}
                  </span>
                </div>
                {hasBorreOrMovable && barreRoots.size > 0 && barreRoots.size < 3 && (
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-[hsl(var(--text-muted))]">Root String</span>
                    <span className="text-[hsl(var(--text-default))] font-medium">
                      {[...barreRoots].map((r) => BARRE_ROOT_LABELS[r]).join(', ')}
                    </span>
                  </div>
                )}
                <div className="h-px bg-[hsl(var(--border-subtle))]" />
                <div className="flex items-center justify-between text-sm font-body">
                  <span className="text-[hsl(var(--text-muted))]">Available chords</span>
                  <span className={`font-display font-bold text-lg ${
                    availableCount > 0 ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--semantic-error))]'
                  }`}>
                    {availableCount}
                  </span>
                </div>
              </div>

              {availableCount === 0 && (
                <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.2)] px-3 py-2">
                  <AlertCircle className="size-4 text-[hsl(var(--semantic-error))]" />
                  <span className="text-xs text-[hsl(var(--semantic-error))] font-body">
                    No chords match this combination. Try a different category or type.
                  </span>
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={availableCount === 0}
                className={`
                  group/btn relative w-full flex items-center justify-center gap-3 rounded-xl py-4 font-display text-lg font-bold tracking-wide uppercase overflow-hidden transition-all duration-200
                  ${availableCount > 0
                    ? 'bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))] glow-primary hover:shadow-[0_0_30px_hsl(var(--color-primary)/0.4),0_0_80px_hsl(var(--color-primary)/0.15)] active:scale-[0.97]'
                    : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'
                  }
                `}
              >
                {availableCount > 0 && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                )}
                <Play className="size-5 transition-transform duration-200 group-hover/btn:scale-110" />
                <span className="relative">Start Practice</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ MOBILE BOTTOM SHEETS ═══════════ */}
      <AnimatePresence>
        {activeSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveSheet(null)}
              className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            {/* Sheet */}
            <motion.div
              key={activeSheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="sm:hidden fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl max-h-[75vh] flex flex-col"
            >
              {/* Drag indicator */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 rounded-full bg-[hsl(var(--border-default))]" />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-[hsl(var(--border-subtle))]">
                <h3 className="font-display text-lg font-bold text-[hsl(var(--text-default))]">
                  {activeSheet === 'key' && 'Select Key'}
                  {activeSheet === 'category' && 'Shape Category'}
                  {activeSheet === 'type' && 'Chord Type'}
                </h3>
                <div className="flex items-center gap-3">
                  {activeSheet === 'category' && categories.size > 0 && (
                    <button onClick={store.clearCategories} className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))]">Clear</button>
                  )}
                  {activeSheet === 'type' && chordTypes.size > 0 && (
                    <button onClick={store.clearChordTypes} className="text-xs font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))]">Clear</button>
                  )}
                  <button
                    onClick={() => setActiveSheet(null)}
                    className="size-8 flex items-center justify-center rounded-lg text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-overlay))]"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Sheet body */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-1 pb-8">
                {activeSheet === 'key' && (
                  <KeySheetContent keyFilter={keyFilter} onSelect={(ks) => { setKeyFilter(ks); setActiveSheet(null); }} isMobile />
                )}
                {activeSheet === 'category' && (
                  <CategorySheetContent
                    categories={categories}
                    barreRoots={barreRoots}
                    onToggleCategory={store.toggleCategory}
                    onClearCategories={store.clearCategories}
                    onToggleBarreRoot={store.toggleBarreRoot}
                    onClearBarreRoots={store.clearBarreRoots}
                    isMobile
                  />
                )}
                {activeSheet === 'type' && (
                  <TypeSheetContent
                    chordTypes={chordTypes}
                    onToggleType={store.toggleChordType}
                    onToggleAll={handleToggleAllTypes}
                    onToggleGroup={handleToggleGroup}
                    isMobile
                  />
                )}
              </div>

              {/* Sheet footer — apply */}
              <div className="px-5 py-3 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))]">
                <button
                  onClick={() => setActiveSheet(null)}
                  className="w-full rounded-xl bg-[hsl(var(--color-primary))] py-3 text-base font-display font-bold text-[hsl(var(--bg-base))] active:scale-[0.98] transition-transform"
                >
                  {activeSheet === 'key' ? 'Apply' : 'Show Results'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ KEY SHEET CONTENT ═══════════ */
function KeySheetContent({ keyFilter, onSelect, isMobile }: { keyFilter: KeySignature | null; onSelect: (ks: KeySignature | null) => void; isMobile?: boolean }) {
  const py = isMobile ? 'py-3.5' : 'py-2.5';
  const textSize = isMobile ? 'text-base' : 'text-sm';

  return (
    <>
      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
          !keyFilter ? 'bg-amber-500/10' : 'hover:bg-[hsl(var(--bg-overlay))]'
        }`}
      >
        <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          !keyFilter ? 'border-amber-500 bg-amber-500' : 'border-[hsl(var(--border-default))]'
        }`}>
          {!keyFilter && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
        </div>
        <span className={`font-display ${textSize} font-semibold ${!keyFilter ? 'text-amber-400' : 'text-[hsl(var(--text-default))]'}`}>
          All Keys
        </span>
      </button>
      <div className="h-px bg-[hsl(var(--border-subtle))]" />
      {KEY_SIGNATURES.map((ks) => {
        const isActive = keyFilter?.display === ks.display;
        return (
          <button
            key={ks.display}
            onClick={() => onSelect(ks)}
            className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
              isActive ? 'bg-amber-500/10' : 'hover:bg-[hsl(var(--bg-overlay))]'
            }`}
          >
            <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              isActive ? 'border-amber-500 bg-amber-500' : 'border-[hsl(var(--border-default))]'
            }`}>
              {isActive && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`font-display ${textSize} font-bold min-w-[36px] ${
                  isActive ? 'text-amber-400' : 'text-[hsl(var(--text-default))]'
                }`}>
                  {ks.display} Major
                </span>
                {ks.count === 0 && (
                  <span className="text-xs text-[hsl(var(--text-muted))]">no sharps or flats</span>
                )}
                {ks.count > 0 && (
                  <span className="text-xs text-[hsl(var(--text-muted))]">
                    {ks.count}{ks.type === 'sharp' ? '\u266f' : '\u266d'}
                  </span>
                )}
              </div>
              {ks.count > 0 && (
                <span className={`text-[11px] font-body tabular-nums ${isActive ? 'text-amber-500/60' : 'text-[hsl(var(--text-muted)/0.5)]'}`}>
                  {ks.notes.join(' ')}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </>
  );
}

/* ═══════════ CATEGORY SHEET CONTENT ═══════════ */
interface CategorySheetContentProps {
  categories: Set<ChordCategory>;
  barreRoots: Set<BarreRoot>;
  onToggleCategory: (cat: ChordCategory) => void;
  onClearCategories: () => void;
  onToggleBarreRoot: (root: BarreRoot) => void;
  onClearBarreRoots: () => void;
  isMobile?: boolean;
}

const CATEGORY_DESCRIPTIONS: Record<ChordCategory, string> = {
  open: 'Uses open strings for resonant tones',
  barre: 'Full barre shapes across the neck',
  movable: 'Voicings that shift to any position',
  custom: '',
};

function CategorySheetContent({ categories, barreRoots, onToggleCategory, onClearCategories, onToggleBarreRoot, onClearBarreRoots, isMobile }: CategorySheetContentProps) {
  const showRootSection = categories.has('barre') || categories.has('movable');
  const py = isMobile ? 'py-3.5' : 'py-2.5';
  const textSize = isMobile ? 'text-base' : 'text-sm';
  const allSelected = categories.size === ALL_CATEGORIES.length;

  return (
    <>
      {/* All option */}
      <button
        onClick={onClearCategories}
        className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
          categories.size === 0 ? 'bg-emerald-500/10' : 'hover:bg-[hsl(var(--bg-overlay))]'
        }`}
      >
        <CheckboxIcon checked={categories.size === 0} color="emerald" />
        <span className={`font-display ${textSize} font-semibold ${categories.size === 0 ? 'text-emerald-400' : 'text-[hsl(var(--text-default))]'}`}>
          All Shapes
        </span>
      </button>

      <div className="h-px bg-[hsl(var(--border-subtle))]" />

      {ALL_CATEGORIES.map((cat) => {
        const isActive = categories.has(cat);
        return (
          <button
            key={cat}
            onClick={() => onToggleCategory(cat)}
            className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
              isActive ? 'bg-emerald-500/8' : 'hover:bg-[hsl(var(--bg-overlay))]'
            }`}
          >
            <CheckboxIcon checked={isActive} color="emerald" />
            <div className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-[hsl(var(--text-muted))]'}`}>
              {CATEGORY_ICONS[cat]}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`font-display ${textSize} font-semibold ${
                isActive ? 'text-emerald-400' : 'text-[hsl(var(--text-default))]'
              }`}>
                {CATEGORY_LABELS[cat].replace(' Chords', '')}
              </span>
              <p className="text-xs text-[hsl(var(--text-muted))] leading-snug mt-0.5">
                {CATEGORY_DESCRIPTIONS[cat]}
              </p>
            </div>
          </button>
        );
      })}

      {/* Root string filter within category sheet */}
      {showRootSection && (
        <>
          <div className="h-px bg-[hsl(var(--border-subtle))]" />
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest">Root String</span>
              {barreRoots.size > 0 && (
                <button onClick={onClearBarreRoots} className="text-[10px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))]">Clear</button>
              )}
            </div>
            <div className="flex gap-2">
              {BARRE_ROOTS.map((root) => {
                const isActive = barreRoots.has(root);
                return (
                  <button
                    key={String(root)}
                    onClick={() => onToggleBarreRoot(root)}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-body font-medium transition-all active:scale-95 ${
                      isActive
                        ? 'bg-[hsl(200_80%_62%/0.2)] text-[hsl(200_80%_62%)] border border-[hsl(200_80%_62%/0.4)]'
                        : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] border border-transparent'
                    }`}
                  >
                    {BARRE_ROOT_LABELS[root]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ═══════════ TYPE SHEET CONTENT ═══════════ */
interface TypeSheetContentProps {
  chordTypes: Set<ChordType>;
  onToggleType: (type: ChordType) => void;
  onToggleAll: () => void;
  onToggleGroup: (types: ChordType[]) => void;
  isMobile?: boolean;
}

function TypeSheetContent({ chordTypes, onToggleType, onToggleAll, onToggleGroup, isMobile }: TypeSheetContentProps) {
  const allSelected = chordTypes.size === ALL_CHORD_TYPES.length;
  const py = isMobile ? 'py-3.5' : 'py-2.5';
  const textSize = isMobile ? 'text-base' : 'text-sm';
  const groupTextSize = isMobile ? 'text-xs' : 'text-[10px]';

  return (
    <>
      <button
        onClick={onToggleAll}
        className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
          allSelected ? 'bg-violet-500/10' : 'hover:bg-[hsl(var(--bg-overlay))]'
        }`}
      >
        <CheckboxIcon checked={allSelected} color="violet" />
        <span className={`flex-1 font-display ${textSize} font-semibold ${allSelected ? 'text-violet-400' : 'text-[hsl(var(--text-default))]'}`}>All Types</span>
      </button>

      <div className="h-px bg-[hsl(var(--border-subtle))]" />

      {TYPE_GROUPS.map((group) => {
        const allInGroup = group.types.every((t) => chordTypes.has(t));
        const someInGroup = group.types.some((t) => chordTypes.has(t)) && !allInGroup;
        return (
          <div key={group.label}>
            <button
              onClick={() => onToggleGroup(group.types)}
              className={`w-full flex items-center gap-3 px-4 pt-3 pb-1.5 text-left transition-colors hover:bg-[hsl(var(--bg-overlay))] ${allInGroup ? 'bg-violet-500/5' : ''}`}
            >
              <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allInGroup
                  ? 'bg-violet-500 border-violet-500'
                  : someInGroup
                    ? 'border-violet-500 bg-violet-500/30'
                    : 'border-[hsl(var(--border-default))]'
              }`}>
                {allInGroup && <Check className="size-2.5 text-[hsl(var(--bg-base))]" />}
                {someInGroup && <div className="size-1.5 rounded-sm bg-violet-500" />}
              </div>
              <span className={`font-display ${groupTextSize} font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest`}>
                {group.label}
              </span>
            </button>
            {group.types.map((type) => {
              const isActive = chordTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => onToggleType(type)}
                  className={`w-full flex items-center gap-3 px-4 ${py} text-left transition-colors ${
                    isActive ? 'bg-violet-500/8' : 'hover:bg-[hsl(var(--bg-overlay))]'
                  }`}
                >
                  <CheckboxIcon checked={isActive} color="violet" />
                  <span className={`flex-1 font-body ${textSize} font-medium ${
                    isActive ? 'text-violet-400' : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {CHORD_TYPE_LABELS[type]}
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

/* ═══════════ SHARED CHECKBOX ICON ═══════════ */
function CheckboxIcon({ checked, color = 'primary' }: { checked: boolean; color?: 'primary' | 'emerald' | 'violet' | 'amber' }) {
  const colorMap = {
    primary: { bg: 'bg-[hsl(var(--color-primary))]', border: 'border-[hsl(var(--color-primary))]' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500' },
    violet: { bg: 'bg-violet-500', border: 'border-violet-500' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-500' },
  };
  const c = colorMap[color];
  return (
    <div className={`size-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
      checked ? `${c.bg} ${c.border}` : 'border-[hsl(var(--border-default))]'
    }`}>
      {checked && <Check className="size-3 text-[hsl(var(--bg-base))]" />}
    </div>
  );
}
