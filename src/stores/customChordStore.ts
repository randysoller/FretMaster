import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    id: chord.id,
    name: chord.name,
    symbol: chord.symbol,
    baseFret: chord.baseFret,
    numFrets: chord.numFrets,
    mutedStrings: [...chord.mutedStrings],
    openStrings: [...chord.openStrings],
    openDiamonds: [...(chord.openDiamonds ?? [])],
    markers: chord.markers.map((m) => ({ ...m })),
    barres: chord.barres.map((b) => ({ ...b })),
    chordType: chord.chordType,
    chordCategory: chord.chordCategory,
    sourceChordId: chord.sourceChordId,
    createdAt: chord.createdAt,
    updatedAt: chord.updatedAt,
  };
}

function deserialize(data: SerializedCustomChord): CustomChordData {
  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    baseFret: data.baseFret,
    numFrets: data.numFrets,
    mutedStrings: new Set(data.mutedStrings ?? []),
    openStrings: new Set(data.openStrings ?? []),
    openDiamonds: new Set(data.openDiamonds ?? []),
    markers: (data.markers ?? []).map((m) => ({ ...m })),
    barres: (data.barres ?? []).map((b) => ({ ...b })),
    chordType: data.chordType,
    chordCategory: data.chordCategory,
    sourceChordId: data.sourceChordId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// Migration: load any chords from the old localStorage key used before persist middleware
function migrateOldStorage(): CustomChordData[] {
  try {
    const raw = localStorage.getItem('fretmaster-custom-chords');
    if (!raw) return [];
    const parsed: SerializedCustomChord[] = JSON.parse(raw);
    const result = parsed.map(deserialize);
    console.log('[FretMaster] Migrated', result.length, 'custom chords from old storage key');
    return result;
  } catch (e) {
    console.error('[FretMaster] Failed to migrate old chords:', e);
    return [];
  }
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
  addBarreFromStrings: (fret: number, strings: number[]) => void;
  removeBarre: (fret: number) => void;
  removeBarreByKey: (fret: number, fromString: number, toString: number) => void;
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

export const useCustomChordStore = create<CustomChordStore>()(
  persist(
    (set, get) => ({
      customChords: [] as CustomChordData[],
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
        const targetExists = s.currentChord.markers.some((m) => m.fret === toFret && m.string === toString);
        if (targetExists) return s;
        const markers = s.currentChord.markers.map((m) => {
          if (m.fret === fromFret && m.string === fromString) {
            return { ...m, fret: toFret, string: toString };
          }
          return m;
        });
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
          const newList = customChords.filter((c) => c.id !== currentChord.id);
          if (currentChord.sourceChordId) {
            const hidden = new Set(get().hiddenStandardChords);
            hidden.add(currentChord.sourceChordId);
            saveHiddenChords(hidden);
            set({ customChords: newList, hiddenStandardChords: hidden, currentChord: createBlankChord(), isEditing: false });
          } else {
            set({ customChords: newList, currentChord: createBlankChord(), isEditing: false });
          }
        } else if (currentChord.sourceChordId) {
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

      addBarreFromStrings: (fret, strings) => set((s) => {
        if (strings.length < 2) return s;
        const sorted = [...strings].sort((a, b) => a - b);
        const fromString = sorted[0];
        const toString = sorted[sorted.length - 1];
        const exists = s.currentChord.barres.some((b) => b.fret === fret && b.fromString === fromString && b.toString === toString);
        if (exists) return s;
        const barres = [...s.currentChord.barres, { fret, fromString, toString, color: 'hsl(38 75% 52%)' }];
        return { currentChord: { ...s.currentChord, barres } };
      }),

      removeBarre: (fret) => set((s) => ({
        currentChord: {
          ...s.currentChord,
          barres: s.currentChord.barres.filter((b) => b.fret !== fret),
        },
      })),

      removeBarreByKey: (fret, fromString, toString) => set((s) => ({
        currentChord: {
          ...s.currentChord,
          barres: s.currentChord.barres.filter((b) => !(b.fret === fret && b.fromString === fromString && b.toString === toString)),
        },
      })),

      saveChord: () => {
        const { currentChord, customChords, isEditing } = get();
        if (!currentChord.name.trim() || !currentChord.symbol.trim()) return;

        const updated: CustomChordData = {
          ...currentChord,
          mutedStrings: new Set(currentChord.mutedStrings),
          openStrings: new Set(currentChord.openStrings),
          openDiamonds: new Set(currentChord.openDiamonds ?? []),
          markers: currentChord.markers.map((m) => ({ ...m })),
          barres: currentChord.barres.map((b) => ({ ...b })),
          updatedAt: Date.now(),
        };
        let newList: CustomChordData[];

        if (isEditing) {
          const existsInList = customChords.some((c) => c.id === updated.id);
          if (existsInList) {
            newList = customChords.map((c) => (c.id === updated.id ? updated : c));
          } else if (updated.sourceChordId) {
            const staleIdx = customChords.findIndex((c) => c.sourceChordId === updated.sourceChordId);
            if (staleIdx >= 0) {
              newList = customChords.map((c, i) => (i === staleIdx ? updated : c));
            } else {
              newList = [...customChords, updated];
            }
          } else {
            newList = [...customChords, updated];
          }
        } else {
          newList = [...customChords, updated];
        }

        set({ customChords: newList, currentChord: createBlankChord(), isEditing: false });
        console.log('[FretMaster] Chord saved. ID:', updated.id, 'Total custom chords:', newList.length);
      },

      deleteChord: (id) => {
        const newList = get().customChords.filter((c) => c.id !== id);
        set({ customChords: newList });
        if (get().currentChord.id === id) {
          set({ currentChord: createBlankChord(), isEditing: false });
        }
      },

      editChord: (id) => {
        const chord = get().customChords.find((c) => c.id === id);
        if (chord) {
          console.log('[FretMaster] editChord: loading custom chord', chord.id);
          set({
            currentChord: {
              ...chord,
              mutedStrings: new Set(chord.mutedStrings),
              openStrings: new Set(chord.openStrings),
              openDiamonds: new Set(chord.openDiamonds ?? []),
              markers: chord.markers.map((m) => ({ ...m })),
              barres: chord.barres.map((b) => ({ ...b })),
            },
            isEditing: true,
          });
        } else {
          console.warn('[FretMaster] editChord: chord not found with id:', id);
        }
      },

      editStandardChord: (chord: ChordData) => {
        const existingReplacement = get().customChords.find((c) => c.sourceChordId === chord.id);
        if (existingReplacement) {
          console.log('[FretMaster] editStandardChord: found existing replacement', existingReplacement.id, 'for', chord.id);
          set({
            currentChord: {
              ...existingReplacement,
              mutedStrings: new Set(existingReplacement.mutedStrings),
              openStrings: new Set(existingReplacement.openStrings),
              openDiamonds: new Set(existingReplacement.openDiamonds ?? []),
              markers: existingReplacement.markers.map((m) => ({ ...m })),
              barres: existingReplacement.barres.map((b) => ({ ...b })),
            },
            isEditing: true,
          });
          return;
        }

        const markers: FretMarker[] = [];
        const mutedStrings = new Set<number>();
        const openStrings = new Set<number>();
        const openDiamonds = new Set<number>();

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

        const barres: CustomChordData['barres'] = [];
        if (chord.barres && chord.barres.length > 0) {
          for (const barreFret of chord.barres) {
            const relativeFret = barreFret - baseFret + 1;
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

        set({ currentChord: customChord, isEditing: true });
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
    }),
    {
      name: 'fretmaster-custom-chords-v2',
      partialize: (state) => ({
        customChords: state.customChords.map(serialize),
      }),
      merge: (persisted: any, current) => {
        let chords: CustomChordData[] = [];

        // Try loading from new persist key first
        if (persisted && Array.isArray(persisted.customChords) && persisted.customChords.length > 0) {
          chords = persisted.customChords.map(deserialize);
          console.log('[FretMaster] Loaded', chords.length, 'custom chords from persist store');
        } else {
          // Fall back to old manual localStorage key for migration
          chords = migrateOldStorage();
          if (chords.length > 0) {
            // Clean up old key after successful migration
            try { localStorage.removeItem('fretmaster-custom-chords'); } catch (_) {}
          }
        }

        return {
          ...current,
          customChords: chords,
        };
      },
    }
  )
);
