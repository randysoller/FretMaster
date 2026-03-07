import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChordCategory, ChordData, ChordType, TimerDuration, BarreRoot } from '@/types/chord';
import { CHORDS } from '@/constants/chords';
import { useCustomChordStore } from '@/stores/customChordStore';
import { customToLibraryChord } from '@/types/customChord';
import type { KeySignature } from '@/constants/scales';
import { NOTE_NAMES } from '@/constants/scales';
import { usePresetStore } from '@/stores/presetStore';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getEffectiveChords(): ChordData[] {
  const { customChords, hiddenStandardChords } = useCustomChordStore.getState();
  const replacedIds = new Set(customChords.filter((c) => c.sourceChordId).map((c) => c.sourceChordId!));
  const standardChords = CHORDS.filter((c) => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
  const converted = customChords.map(customToLibraryChord);
  return [...standardChords, ...converted];
}

/** Map a chord symbol to its root note semitone index (0-11) */
function getChordRootSemitone(symbol: string): number {
  const match = symbol.match(/^([A-G])([#b]?)/);
  if (!match) return -1;
  const noteBase: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = noteBase[match[1]] ?? -1;
  if (match[2] === '#') semitone = (semitone + 1) % 12;
  if (match[2] === 'b') semitone = (semitone + 11) % 12;
  return semitone;
}

function filterChords(categories: Set<ChordCategory>, types: Set<ChordType>, barreRoots: Set<BarreRoot>, keyFilter: KeySignature | null): ChordData[] {
  const allCats = categories.size === 0 || categories.size === 3;
  const allRoots = barreRoots.size === 0 || barreRoots.size === 3;
  return getEffectiveChords().filter((chord) => {
    const matchCategory = allCats || categories.has(chord.category);
    const matchType = types.size === 0 || types.has(chord.type);
    const hasRootFilter = categories.has('barre') || categories.has('movable') || allCats;
    const matchRoot = allRoots || !hasRootFilter || !chord.rootString || barreRoots.has(chord.rootString);
    // Key filter: match chords whose root note belongs to the selected key's scale
    let matchKey = true;
    if (keyFilter) {
      const rootIdx = NOTE_NAMES.indexOf(keyFilter.noteName);
      // Major scale intervals
      const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
      const scaleNotes = new Set(majorIntervals.map((i) => (rootIdx + i) % 12));
      const chordRoot = getChordRootSemitone(chord.symbol);
      matchKey = chordRoot >= 0 && scaleNotes.has(chordRoot);
    }
    return matchCategory && matchType && matchRoot && matchKey;
  });
}

interface PracticeState {
  categories: Set<ChordCategory>;
  chordTypes: Set<ChordType>;
  timerDuration: TimerDuration;
  barreRoots: Set<BarreRoot>;
  keyFilter: KeySignature | null;
  activePresetId: string | null;
  currentIndex: number;
  isRevealed: boolean;
  isPracticing: boolean;
  practiceChords: ChordData[];
  totalPracticed: number;

  toggleCategory: (cat: ChordCategory) => void;
  clearCategories: () => void;
  toggleChordType: (type: ChordType) => void;
  clearChordTypes: () => void;
  setTimerDuration: (dur: TimerDuration) => void;
  toggleBarreRoot: (root: BarreRoot) => void;
  clearBarreRoots: () => void;
  setKeyFilter: (ks: KeySignature | null) => void;
  setActivePreset: (id: string | null) => void;
  startPractice: () => void;
  stopPractice: () => void;
  revealChord: () => void;
  nextChord: () => void;
  prevChord: () => void;
  getCurrentChord: () => ChordData | null;
  getAvailableCount: () => number;
}

export const usePracticeStore = create<PracticeState>()(persist((set, get) => ({
  categories: new Set<ChordCategory>(),
  chordTypes: new Set<ChordType>(),
  timerDuration: 0,
  barreRoots: new Set<BarreRoot>(),
  keyFilter: null,
  activePresetId: null,
  currentIndex: 0,
  isRevealed: false,
  isPracticing: false,
  practiceChords: [],
  totalPracticed: 0,

  toggleCategory: (cat) => set((state) => {
    const next = new Set(state.categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    const hasBM = next.has('barre') || next.has('movable');
    const allSelected = next.size === 3;
    if (!hasBM && !allSelected) return { categories: next, barreRoots: new Set<BarreRoot>(), activePresetId: null };
    return { categories: next, activePresetId: null };
  }),
  clearCategories: () => set({ categories: new Set<ChordCategory>(), barreRoots: new Set<BarreRoot>(), activePresetId: null }),
  toggleChordType: (type) => set((state) => {
    const next = new Set(state.chordTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return { chordTypes: next, activePresetId: null };
  }),
  clearChordTypes: () => set({ chordTypes: new Set<ChordType>(), activePresetId: null }),
  setTimerDuration: (timerDuration) => set({ timerDuration }),
  toggleBarreRoot: (root) => set((state) => {
    const next = new Set(state.barreRoots);
    if (next.has(root)) next.delete(root);
    else next.add(root);
    return { barreRoots: next, activePresetId: null };
  }),
  clearBarreRoots: () => set({ barreRoots: new Set<BarreRoot>(), activePresetId: null }),
  setKeyFilter: (ks) => set({ keyFilter: ks, activePresetId: null }),
  setActivePreset: (id) => set({ activePresetId: id }),

  startPractice: () => {
    const { categories, chordTypes, barreRoots, keyFilter, activePresetId } = get();
    let filtered: ChordData[];
    if (activePresetId) {
      const preset = usePresetStore.getState().presets.find((p) => p.id === activePresetId);
      if (preset) {
        const idSet = new Set(preset.chordIds);
        filtered = getEffectiveChords().filter((c) => idSet.has(c.id));
      } else {
        filtered = filterChords(categories, chordTypes, barreRoots, keyFilter);
      }
    } else {
      filtered = filterChords(categories, chordTypes, barreRoots, keyFilter);
    }
    const shuffled = shuffleArray(filtered);
    set({
      practiceChords: shuffled,
      currentIndex: 0,
      isRevealed: false,
      isPracticing: true,
      totalPracticed: 0,
    });
  },

  stopPractice: () => set({ isPracticing: false, isRevealed: false }),

  revealChord: () => set({ isRevealed: true }),

  nextChord: () => {
    const { practiceChords, currentIndex } = get();
    let nextIndex = currentIndex + 1;
    if (nextIndex >= practiceChords.length) {
      const reshuffled = shuffleArray(practiceChords);
      set({
        practiceChords: reshuffled,
        currentIndex: 0,
        isRevealed: false,
        totalPracticed: get().totalPracticed + 1,
      });
    } else {
      set({
        currentIndex: nextIndex,
        isRevealed: false,
        totalPracticed: get().totalPracticed + 1,
      });
    }
  },

  prevChord: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, isRevealed: false });
    }
  },

  getCurrentChord: () => {
    const { practiceChords, currentIndex } = get();
    return practiceChords[currentIndex] ?? null;
  },

  getAvailableCount: () => {
    const { categories, chordTypes, barreRoots, keyFilter, activePresetId } = get();
    if (activePresetId) {
      const preset = usePresetStore.getState().presets.find((p) => p.id === activePresetId);
      if (preset) {
        const idSet = new Set(preset.chordIds);
        return getEffectiveChords().filter((c) => idSet.has(c.id)).length;
      }
    }
    return filterChords(categories, chordTypes, barreRoots, keyFilter).length;
  },
}), {
  name: 'fretmaster-practice-filters',
  partialize: (state) => ({
    categories: [...state.categories] as ChordCategory[],
    chordTypes: [...state.chordTypes] as ChordType[],
    barreRoots: [...state.barreRoots] as BarreRoot[],
    keyFilter: state.keyFilter,
    timerDuration: state.timerDuration,
    activePresetId: state.activePresetId,
  }),
  merge: (persisted: any, current) => ({
    ...current,
    ...(persisted ? {
      categories: new Set<ChordCategory>(persisted.categories ?? []),
      chordTypes: new Set<ChordType>(persisted.chordTypes ?? []),
      barreRoots: new Set<BarreRoot>(persisted.barreRoots ?? []),
      keyFilter: persisted.keyFilter ?? null,
      timerDuration: persisted.timerDuration ?? 0,
      activePresetId: persisted.activePresetId ?? null,
    } : {}),
  }),
}));
