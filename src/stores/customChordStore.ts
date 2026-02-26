import { create } from 'zustand';
import type { CustomChordData, FretMarker, DotShape } from '@/types/customChord';
import { DEFAULT_DOT_COLOR } from '@/types/customChord';
import type { ChordData, ChordType, ChordCategory } from '@/types/chord';

interface SerializedCustomChord {
  id: string;
  name: string;
  symbol: string;
  baseFret: number;
  numFrets: number;
  mutedStrings: number[];
  openStrings: number[];
  openDiamonds: number[];
  markers: FretMarker[];
  barres: { fret: number; fromString: number; toString: number; color: string }[];
  chordType?: ChordType;
  chordCategory?: ChordCategory;
  sourceChordId?: string;
  createdAt: number;
  updatedAt: number;
}

function serialize(chord: CustomChordData): SerializedCustomChord {
  return {
    ...chord,
    mutedStrings: [...chord.mutedStrings],
    openStrings: [...chord.openStrings],
    openDiamonds: [...(chord.openDiamonds ?? [])],
    chordType: chord.chordType,
    chordCategory: chord.chordCategory,
    sourceChordId: chord.sourceChordId,
  };
}

function deserialize(data: SerializedCustomChord): CustomChordData {
  return {
    ...data,
    mutedStrings: new Set(data.mutedStrings),
    openStrings: new Set(data.openStrings),
    openDiamonds: new Set(data.openDiamonds ?? []),
    chordType: data.chordType,
    chordCategory: data.chordCategory,
    sourceChordId: data.sourceChordId,
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

function loadHiddenChords(): Set<string> {
  try {
    const raw = localStorage.getItem('fretmaster-hidden-chords');
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveHiddenChords(ids: Set<string>) {
  localStorage.setItem('fretmaster-hidden-chords', JSON.stringify([...ids]));
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
    openDiamonds: new Set<number>(),
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
  toggleOpenDiamond: (stringIdx: number) => void;
  addMarker: (fret: number, string: number) => void;
  addMarkerDirect: (fret: number, string: number, finger: number, label: string) => void;
  removeMarker: (fret: number, string: number) => void;
  toggleMarker: (fret: number, string: number) => void;
  addBarre: (fret: number, fromString: number, toString: number) => void;
  removeBarre: (fret: number) => void;
  moveMarker: (fromFret: number, fromString: number, toFret: number, toString: number) => void;
  updateMarkerFinger: (fret: number, string: number, finger: number, label: string) => void;
  setChordType: (type: ChordType) => void;
  setChordCategory: (category: ChordCategory) => void;
  hiddenStandardChords: Set<string>;
  hideStandardChord: (id: string) => void;
  deleteFromLibrary: () => void;
  saveChord: () => void;
  deleteChord: (id: string) => void;
  editChord: (id: string) => void;
  editStandardChord: (chord: ChordData) => void;
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
  hiddenStandardChords: loadHiddenChords(),

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
    const diamonds = new Set(next.openDiamonds ?? new Set());
    if (muted.has(stringIdx)) {
      muted.delete(stringIdx);
    } else {
      muted.add(stringIdx);
      open.delete(stringIdx);
      diamonds.delete(stringIdx);
      next.markers = next.markers.filter((m) => m.string !== stringIdx);
    }
    return { currentChord: { ...next, mutedStrings: muted, openStrings: open, openDiamonds: diamonds } };
  }),

  toggleOpenString: (stringIdx) => set((s) => {
    const next = { ...s.currentChord };
    const open = new Set(next.openStrings);
    const muted = new Set(next.mutedStrings);
    const diamonds = new Set(next.openDiamonds ?? new Set());
    if (open.has(stringIdx)) {
      open.delete(stringIdx);
      diamonds.delete(stringIdx);
    } else {
      open.add(stringIdx);
      muted.delete(stringIdx);
      next.markers = next.markers.filter((m) => m.string !== stringIdx);
    }
    return { currentChord: { ...next, openStrings: open, mutedStrings: muted, openDiamonds: diamonds } };
  }),

  toggleOpenDiamond: (stringIdx) => set((s) => {
    const diamonds = new Set(s.currentChord.openDiamonds ?? new Set());
    if (diamonds.has(stringIdx)) {
      diamonds.delete(stringIdx);
    } else {
      diamonds.add(stringIdx);
    }
    return { currentChord: { ...s.currentChord, openDiamonds: diamonds } };
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

  moveMarker: (fromFret, fromString, toFret, toString) => set((s) => {
    const marker = s.currentChord.markers.find((m) => m.fret === fromFret && m.string === fromString);
    if (!marker) return s;
    // Don't move if target already has a marker
    const targetExists = s.currentChord.markers.some((m) => m.fret === toFret && m.string === toString);
    if (targetExists) return s;
    const markers = s.currentChord.markers.map((m) => {
      if (m.fret === fromFret && m.string === fromString) {
        return { ...m, fret: toFret, string: toString };
      }
      return m;
    });
    // Clear open/muted on new string
    const open = new Set(s.currentChord.openStrings);
    const muted = new Set(s.currentChord.mutedStrings);
    open.delete(toString);
    muted.delete(toString);
    return { currentChord: { ...s.currentChord, markers, openStrings: open, mutedStrings: muted } };
  }),

  updateMarkerFinger: (fret, string, finger, label) => set((s) => {
    const markers = s.currentChord.markers.map((m) => {
      if (m.fret === fret && m.string === string) {
        return { ...m, finger, label };
      }
      return m;
    });
    return { currentChord: { ...s.currentChord, markers } };
  }),

  setChordType: (chordType) => set((s) => ({ currentChord: { ...s.currentChord, chordType } })),
  setChordCategory: (chordCategory) => set((s) => ({ currentChord: { ...s.currentChord, chordCategory } })),

  hideStandardChord: (id) => {
    const hidden = new Set(get().hiddenStandardChords);
    hidden.add(id);
    saveHiddenChords(hidden);
    set({ hiddenStandardChords: hidden });
  },

  deleteFromLibrary: () => {
    const { currentChord, isEditing, customChords } = get();
    if (isEditing) {
      // Delete the custom chord
      const newList = customChords.filter((c) => c.id !== currentChord.id);
      saveToStorage(newList);
      // If it replaced a standard chord, also hide the standard
      if (currentChord.sourceChordId) {
        const hidden = new Set(get().hiddenStandardChords);
        hidden.add(currentChord.sourceChordId);
        saveHiddenChords(hidden);
        set({ customChords: newList, hiddenStandardChords: hidden, currentChord: createBlankChord(), isEditing: false });
      } else {
        set({ customChords: newList, currentChord: createBlankChord(), isEditing: false });
      }
    } else if (currentChord.sourceChordId) {
      // Editing a standard chord not yet saved — hide the standard chord
      const hidden = new Set(get().hiddenStandardChords);
      hidden.add(currentChord.sourceChordId);
      saveHiddenChords(hidden);
      set({ hiddenStandardChords: hidden, currentChord: createBlankChord(), isEditing: false });
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
          openDiamonds: new Set(chord.openDiamonds ?? []),
        },
        isEditing: true,
      });
    }
  },

  editStandardChord: (chord: ChordData) => {
    // Convert a standard ChordData into a CustomChordData for editing
    const markers: FretMarker[] = [];
    const mutedStrings = new Set<number>();
    const openStrings = new Set<number>();
    const openDiamonds = new Set<number>();

    // Determine baseFret from frets array
    const frettedValues = chord.frets.filter((f) => f > 0);
    const minFret = frettedValues.length > 0 ? Math.min(...frettedValues) : 1;
    const maxFret = frettedValues.length > 0 ? Math.max(...frettedValues) : 1;
    const baseFret = chord.baseFret > 1 ? chord.baseFret : (minFret > 3 ? minFret : 1);
    const numFrets = Math.max(5, maxFret - baseFret + 2);

    for (let i = 0; i < 6; i++) {
      const fret = chord.frets[i];
      if (fret === -1) {
        mutedStrings.add(i);
      } else if (fret === 0) {
        openStrings.add(i);
        if (i === chord.rootNoteString) {
          openDiamonds.add(i);
        }
      } else {
        const relativeFret = fret - baseFret + 1;
        const isRoot = i === chord.rootNoteString;
        markers.push({
          fret: relativeFret,
          string: i,
          finger: chord.fingers[i],
          color: isRoot ? 'hsl(200 80% 62%)' : 'hsl(38 75% 52%)',
          shape: isRoot ? 'diamond' : 'circle',
          label: '',
        });
      }
    }

    // Handle barres from the standard chord
    const barres: CustomChordData['barres'] = [];
    if (chord.barres && chord.barres.length > 0) {
      for (const barreFret of chord.barres) {
        const relativeFret = barreFret - baseFret + 1;
        // Find the string range for this barre
        const barreStrings = chord.frets
          .map((f, idx) => ({ f, idx }))
          .filter((x) => x.f === barreFret)
          .map((x) => x.idx);
        if (barreStrings.length >= 2) {
          barres.push({
            fret: relativeFret,
            fromString: Math.min(...barreStrings),
            toString: Math.max(...barreStrings),
            color: 'hsl(38 75% 52%)',
          });
        }
      }
    }

    const customChord: CustomChordData = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: chord.name,
      symbol: chord.symbol,
      baseFret,
      numFrets: Math.min(numFrets, 7),
      mutedStrings,
      openStrings,
      openDiamonds,
      markers,
      barres,
      chordType: chord.type,
      chordCategory: chord.category === 'custom' ? 'open' : chord.category,
      sourceChordId: chord.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({ currentChord: customChord, isEditing: false });
  },

  newChord: () => set({ currentChord: createBlankChord(), isEditing: false }),

  clearFretboard: () => set((s) => ({
    currentChord: {
      ...s.currentChord,
      markers: [],
      barres: [],
      mutedStrings: new Set<number>(),
      openStrings: new Set<number>(),
      openDiamonds: new Set<number>(),
    },
  })),
}));
