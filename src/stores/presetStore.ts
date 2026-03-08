import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChordPreset {
  id: string;
  name: string;
  chordIds: string[];
  createdAt: number;
}

interface PresetState {
  presets: ChordPreset[];
  addPreset: (name: string, chordIds: string[]) => string;
  removePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  reorderPreset: (id: string, direction: 'up' | 'down') => void;
  getPreset: (id: string) => ChordPreset | undefined;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],

      addPreset: (name, chordIds) => {
        const id = `preset-${Date.now()}`;
        const newPreset: ChordPreset = { id, name, chordIds, createdAt: Date.now() };
        set((s) => ({
          presets: [...s.presets, newPreset],
        }));
        // Force-sync to localStorage immediately for navigation safety
        try {
          const current = JSON.parse(localStorage.getItem('fretmaster-presets') || '{"state":{"presets":[]}}');
          current.state.presets = [...(current.state?.presets ?? []), newPreset];
          localStorage.setItem('fretmaster-presets', JSON.stringify(current));
        } catch (_) { /* persist middleware handles it */ }
        return id;
      },

      removePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      renamePreset: (id, name) =>
        set((s) => ({
          presets: s.presets.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      reorderPreset: (id, direction) =>
        set((s) => {
          const idx = s.presets.findIndex((p) => p.id === id);
          if (idx === -1) return s;
          const newIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= s.presets.length) return s;
          const next = [...s.presets];
          [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
          return { presets: next };
        }),

      getPreset: (id) => get().presets.find((p) => p.id === id),
    }),
    {
      name: 'fretmaster-presets',
      version: 1,
      partialize: (state) => ({ presets: state.presets }),
      merge: (persisted: any, current) => ({
        ...current,
        presets: (persisted as any)?.presets ?? [],
      }),
    }
  )
);
