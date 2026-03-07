import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChordCategory, ChordType, BarreRoot } from '@/types/chord';

interface ChordLibraryState {
  filterCategories: ChordCategory[];
  filterTypes: ChordType[];
  filterBarreRoots: BarreRoot[];
  searchQuery: string;
  activeLibraryPresetId: string | null;
  toggleCategory: (cat: ChordCategory) => void;
  clearCategories: () => void;
  toggleType: (type: ChordType) => void;
  setFilterTypes: (types: ChordType[]) => void;
  clearTypes: () => void;
  toggleBarreRoot: (root: BarreRoot) => void;
  clearBarreRoots: () => void;
  setSearchQuery: (q: string) => void;
  setActiveLibraryPreset: (id: string | null) => void;
  clearAll: () => void;
}

export const useChordLibraryStore = create<ChordLibraryState>()(
  persist(
    (set) => ({
      filterCategories: [],
      filterTypes: [],
      filterBarreRoots: [],
      searchQuery: '',
      activeLibraryPresetId: null,

      toggleCategory: (cat) =>
        set((s) => {
          const next = s.filterCategories.includes(cat)
            ? s.filterCategories.filter((c) => c !== cat)
            : [...s.filterCategories, cat];
          // Clear barre roots if no barre/movable selected
          const hasBM = next.includes('barre') || next.includes('movable');
          return { filterCategories: next, filterBarreRoots: hasBM ? s.filterBarreRoots : [] };
        }),

      clearCategories: () => set({ filterCategories: [], filterBarreRoots: [] }),

      toggleType: (type) =>
        set((s) => ({
          filterTypes: s.filterTypes.includes(type)
            ? s.filterTypes.filter((t) => t !== type)
            : [...s.filterTypes, type],
        })),

      setFilterTypes: (types) => set({ filterTypes: types }),

      clearTypes: () => set({ filterTypes: [] }),

      toggleBarreRoot: (root) =>
        set((s) => ({
          filterBarreRoots: s.filterBarreRoots.includes(root)
            ? s.filterBarreRoots.filter((r) => r !== root)
            : [...s.filterBarreRoots, root],
        })),

      clearBarreRoots: () => set({ filterBarreRoots: [] }),

      setSearchQuery: (q) => set({ searchQuery: q }),

      setActiveLibraryPreset: (id) => set({ activeLibraryPresetId: id }),

      clearAll: () => set({ filterCategories: [], filterTypes: [], filterBarreRoots: [], searchQuery: '', activeLibraryPresetId: null }),
    }),
    {
      name: 'fretmaster-chord-library-filters',
    }
  )
);
