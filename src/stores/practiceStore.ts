import { create } from 'zustand';
import type { ChordCategory, ChordData, ChordType, TimerDuration, BarreRoot } from '@/types/chord';
import { CHORDS } from '@/constants/chords';
import { useCustomChordStore } from '@/stores/customChordStore';
import { customToLibraryChord } from '@/types/customChord';

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

function filterChords(categories: Set<ChordCategory>, types: Set<ChordType>, barreRoots: Set<BarreRoot>): ChordData[] {
  const allCats = categories.size === 0 || categories.size === 3;
  const allRoots = barreRoots.size === 0 || barreRoots.size === 3;
  return getEffectiveChords().filter((chord) => {
    const matchCategory = allCats || categories.has(chord.category);
    const matchType = types.size === 0 || types.has(chord.type);
    const hasRootFilter = categories.has('barre') || categories.has('movable') || allCats;
    const matchRoot = allRoots || !hasRootFilter || !chord.rootString || barreRoots.has(chord.rootString);
    return matchCategory && matchType && matchRoot;
  });
}

interface PracticeState {
  categories: Set<ChordCategory>;
  chordTypes: Set<ChordType>;
  timerDuration: TimerDuration;
  barreRoots: Set<BarreRoot>;
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
  startPractice: () => void;
  stopPractice: () => void;
  revealChord: () => void;
  nextChord: () => void;
  getCurrentChord: () => ChordData | null;
  getAvailableCount: () => number;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  categories: new Set<ChordCategory>(),
  chordTypes: new Set<ChordType>(),
  timerDuration: 0,
  barreRoots: new Set<BarreRoot>(),
  currentIndex: 0,
  isRevealed: false,
  isPracticing: false,
  practiceChords: [],
  totalPracticed: 0,

  toggleCategory: (cat) => set((state) => {
    const next = new Set(state.categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    // Clear root filters if no barre/movable selected and not all selected
    const hasBM = next.has('barre') || next.has('movable');
    const allSelected = next.size === 3;
    if (!hasBM && !allSelected) return { categories: next, barreRoots: new Set<BarreRoot>() };
    return { categories: next };
  }),
  clearCategories: () => set({ categories: new Set<ChordCategory>(), barreRoots: new Set<BarreRoot>() }),
  toggleChordType: (type) => set((state) => {
    const next = new Set(state.chordTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return { chordTypes: next };
  }),
  clearChordTypes: () => set({ chordTypes: new Set<ChordType>() }),
  setTimerDuration: (timerDuration) => set({ timerDuration }),
  toggleBarreRoot: (root) => set((state) => {
    const next = new Set(state.barreRoots);
    if (next.has(root)) next.delete(root);
    else next.add(root);
    return { barreRoots: next };
  }),
  clearBarreRoots: () => set({ barreRoots: new Set<BarreRoot>() }),

  startPractice: () => {
    const { categories, chordTypes, barreRoots } = get();
    const filtered = filterChords(categories, chordTypes, barreRoots);
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

  getCurrentChord: () => {
    const { practiceChords, currentIndex } = get();
    return practiceChords[currentIndex] ?? null;
  },

  getAvailableCount: () => {
    const { categories, chordTypes, barreRoots } = get();
    return filterChords(categories, chordTypes, barreRoots).length;
  },
}));
