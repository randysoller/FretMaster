import { create } from 'zustand';
import type { CustomChordData, FretMarker, DotShape } from '@/types/customChord';
import { DEFAULT_DOT_COLOR } from '@/types/customChord';

interface SerializedCustomChord {
  id: string;
  name: string;
  symbol: string;
  baseFret: number;
  numFrets: number;
  mutedStrings: number[];
  openStrings: number[];
  markers: FretMarker[];
  barres: { fret: number; fromString: number; toString: number; color: string }[];
  createdAt: number;
  updatedAt: number;
}

function serialize(chord: CustomChordData): SerializedCustomChord {
  return {
    ...chord,
    mutedStrings: [...chord.mutedStrings],
    openStrings: [...chord.openStrings],
  };
}

function deserialize(data: SerializedCustomChord): CustomChordData {
  return {
    ...data,
    mutedStrings: new Set(data.mutedStrings),
    openStrings: new Set(data.openStrings),
  };
}

function loadFromStorage(): CustomChordData[] {
  try {
    const raw = localStorage.getItem('fretmaster-custom-chords');
    if (!raw) return [];
    const parsed: SerializedCustomChord[] = JSON.parse(raw);
    return parsed.map(deserialize);
  } catch {
    return [];
  }
}

function saveToStorage(chords: CustomChordData[]) {
  localStorage.setItem('fretmaster-custom-chords', JSON.stringify(chords.map(serialize)));
}

export function createBlankChord(): CustomChordData {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    symbol: '',
    baseFret: 1,
    numFrets: 5,
    mutedStrings: new Set<number>(),
    openStrings: new Set<number>(),
    markers: [],
    barres: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface CustomChordStore {
  customChords: CustomChordData[];
  currentChord: CustomChordData;
  selectedColor: string;
  selectedShape: DotShape;
  selectedFinger: number;
  customLabel: string;
  isEditing: boolean;

  // Actions
  setCurrentChord: (chord: CustomChordData) => void;
  setSelectedColor: (color: string) => void;
  setSelectedShape: (shape: DotShape) => void;
  setSelectedFinger: (finger: number) => void;
  setCustomLabel: (label: string) => void;
  setName: (name: string) => void;
  setSymbol: (symbol: string) => void;
  setBaseFret: (fret: number) => void;
  setNumFrets: (num: number) => void;
  toggleMutedString: (stringIdx: number) => void;
  toggleOpenString: (stringIdx: number) => void;
  addMarker: (fret: number, string: number) => void;
  addMarkerDirect: (fret: number, string: number, finger: number, label: string) => void;
  removeMarker: (fret: number, string: number) => void;
  toggleMarker: (fret: number, string: number) => void;
  addBarre: (fret: number, fromString: number, toString: number) => void;
  removeBarre: (fret: number) => void;
  saveChord: () => void;
  deleteChord: (id: string) => void;
  editChord: (id: string) => void;
  newChord: () => void;
  clearFretboard: () => void;
}

export const useCustomChordStore = create<CustomChordStore>((set, get) => ({
  customChords: loadFromStorage(),
  currentChord: createBlankChord(),
  selectedColor: DEFAULT_DOT_COLOR,
  selectedShape: 'circle' as DotShape,
  selectedFinger: 0,
  customLabel: '',
  isEditing: false,

  setCurrentChord: (chord) => set({ currentChord: chord }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  setSelectedFinger: (finger) => set({ selectedFinger: finger }),
  setCustomLabel: (label) => set({ customLabel: label }),

  setName: (name) => set((s) => ({ currentChord: { ...s.currentChord, name } })),
  setSymbol: (symbol) => set((s) => ({ currentChord: { ...s.currentChord, symbol } })),
  setBaseFret: (baseFret) => set((s) => ({ currentChord: { ...s.currentChord, baseFret: Math.max(1, Math.min(24, baseFret)) } })),
  setNumFrets: (numFrets) => set((s) => ({ currentChord: { ...s.currentChord, numFrets: Math.max(3, Math.min(7, numFrets)) } })),

  toggleMutedString: (stringIdx) => set((s) => {
    const next = { ...s.currentChord };
    const muted = new Set(next.mutedStrings);
    const open = new Set(next.openStrings);
    if (muted.has(stringIdx)) {
      muted.delete(stringIdx);
    } else {
      muted.add(stringIdx);
      open.delete(stringIdx);
      // Remove any markers on this string
      next.markers = next.markers.filter((m) => m.string !== stringIdx);
    }
    return { currentChord: { ...next, mutedStrings: muted, openStrings: open } };
  }),

  toggleOpenString: (stringIdx) => set((s) => {
    const next = { ...s.currentChord };
    const open = new Set(next.openStrings);
    const muted = new Set(next.mutedStrings);
    if (open.has(stringIdx)) {
      open.delete(stringIdx);
    } else {
      open.add(stringIdx);
      muted.delete(stringIdx);
      // Remove any markers on this string
      next.markers = next.markers.filter((m) => m.string !== stringIdx);
    }
    return { currentChord: { ...next, openStrings: open, mutedStrings: muted } };
  }),

  addMarker: (fret, string) => {
    const { selectedColor, selectedShape, selectedFinger, customLabel } = get();
    set((s) => {
      const markers = [...s.currentChord.markers.filter((m) => !(m.fret === fret && m.string === string))];
      markers.push({ fret, string, finger: selectedFinger, color: selectedColor, shape: selectedShape, label: customLabel });
      const open = new Set(s.currentChord.openStrings);
      const muted = new Set(s.currentChord.mutedStrings);
      open.delete(string);
      muted.delete(string);
      return { currentChord: { ...s.currentChord, markers, openStrings: open, mutedStrings: muted } };
    });
  },

  addMarkerDirect: (fret, string, finger, label) => {
    const { selectedColor, selectedShape } = get();
    set((s) => {
      const markers = [...s.currentChord.markers.filter((m) => !(m.fret === fret && m.string === string))];
      markers.push({ fret, string, finger, color: selectedColor, shape: selectedShape, label });
      const open = new Set(s.currentChord.openStrings);
      const muted = new Set(s.currentChord.mutedStrings);
      open.delete(string);
      muted.delete(string);
      return { currentChord: { ...s.currentChord, markers, openStrings: open, mutedStrings: muted } };
    });
  },

  removeMarker: (fret, string) => set((s) => ({
    currentChord: {
      ...s.currentChord,
      markers: s.currentChord.markers.filter((m) => !(m.fret === fret && m.string === string)),
    },
  })),

  toggleMarker: (fret, string) => {
    const existing = get().currentChord.markers.find((m) => m.fret === fret && m.string === string);
    if (existing) {
      get().removeMarker(fret, string);
    } else {
      get().addMarker(fret, string);
    }
  },

  addBarre: (fret, fromString, toString) => set((s) => {
    const barres = [...s.currentChord.barres.filter((b) => b.fret !== fret)];
    barres.push({ fret, fromString, toString, color: get().selectedColor });
    return { currentChord: { ...s.currentChord, barres } };
  }),

  removeBarre: (fret) => set((s) => ({
    currentChord: {
      ...s.currentChord,
      barres: s.currentChord.barres.filter((b) => b.fret !== fret),
    },
  })),

  saveChord: () => {
    const { currentChord, customChords, isEditing } = get();
    if (!currentChord.name.trim() || !currentChord.symbol.trim()) return;

    const updated = { ...currentChord, updatedAt: Date.now() };
    let newList: CustomChordData[];

    if (isEditing) {
      newList = customChords.map((c) => (c.id === updated.id ? updated : c));
    } else {
      newList = [...customChords, updated];
    }

    saveToStorage(newList);
    set({ customChords: newList, currentChord: createBlankChord(), isEditing: false });
  },

  deleteChord: (id) => {
    const newList = get().customChords.filter((c) => c.id !== id);
    saveToStorage(newList);
    set({ customChords: newList });
    if (get().currentChord.id === id) {
      set({ currentChord: createBlankChord(), isEditing: false });
    }
  },

  editChord: (id) => {
    const chord = get().customChords.find((c) => c.id === id);
    if (chord) {
      set({
        currentChord: {
          ...chord,
          mutedStrings: new Set(chord.mutedStrings),
          openStrings: new Set(chord.openStrings),
        },
        isEditing: true,
      });
    }
  },

  newChord: () => set({ currentChord: createBlankChord(), isEditing: false }),

  clearFretboard: () => set((s) => ({
    currentChord: {
      ...s.currentChord,
      markers: [],
      barres: [],
      mutedStrings: new Set<number>(),
      openStrings: new Set<number>(),
    },
  })),
}));
