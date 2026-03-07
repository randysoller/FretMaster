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
  getPreset: (id: string) => ChordPreset | undefined;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],

      addPreset: (name, chordIds) => {
        const id = `preset-${Date.now()}`;
        set((s) => ({
          presets: [
            ...s.presets,
            { id, name, chordIds, createdAt: Date.now() },
          ],
        }));
        return id;
      },

      removePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      renamePreset: (id, name) =>
        set((s) => ({
          presets: s.presets.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      getPreset: (id) => get().presets.find((p) => p.id === id),
    }),
    { name: 'fretmaster-presets' }
  )
);
