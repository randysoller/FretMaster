import { create } from 'zustand';
import type { NoteName } from '@/constants/scales';
import type { ScaleDefinition, ProgressionPreset } from '@/constants/scales';
import { SCALES, COMMON_PROGRESSIONS, resolveScaleChords, QUALITY_SUFFIX } from '@/constants/scales';
import { CHORDS } from '@/constants/chords';
import { useCustomChordStore } from '@/stores/customChordStore';
import { customToLibraryChord } from '@/types/customChord';
import type { ChordData, ChordType } from '@/types/chord';

/** Map quality string to ChordType used in the chord library */
function qualityToChordType(quality: string): ChordType[] {
  switch (quality) {
    case 'maj': return ['major'];
    case 'min': return ['minor'];
    case 'dim': return ['diminished'];
    case 'aug': return ['augmented'];
    case 'dom7': return ['dominant7'];
    case 'maj7': return ['major7'];
    case 'min7': return ['minor7'];
    case 'halfDim7': return ['halfDim7'];
    case 'dim7': return ['dim7'];
    case 'sus4': return ['suspended'];
    default: return ['major'];
  }
}

/** Find the best matching chord from the library for a given symbol + quality */
function findChordInLibrary(chordSymbol: string, quality: string): ChordData | null {
  const { customChords, hiddenStandardChords } = useCustomChordStore.getState();
  const replacedIds = new Set(customChords.filter((c) => c.sourceChordId).map((c) => c.sourceChordId!));
  const standardChords = CHORDS.filter((c) => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
  const converted = customChords.map(customToLibraryChord);
  const allChords = [...standardChords, ...converted];

  const targetTypes = qualityToChordType(quality);

  // Try exact symbol match first
  let match = allChords.find(
    (c) => c.symbol === chordSymbol && targetTypes.includes(c.type)
  );
  if (match) return match;

  // Try with enharmonic equivalents
  const enharmonics: Record<string, string[]> = {
    'C#': ['Db'], 'Db': ['C#'],
    'D#': ['Eb'], 'Eb': ['D#'],
    'F#': ['Gb'], 'Gb': ['F#'],
    'G#': ['Ab'], 'Ab': ['G#'],
    'A#': ['Bb'], 'Bb': ['A#'],
  };

  // Extract root note from symbol
  const rootNote = chordSymbol.match(/^[A-G][#b]?/)?.[0] || '';
  const suffix = QUALITY_SUFFIX[quality as keyof typeof QUALITY_SUFFIX] || '';
  const alts = enharmonics[rootNote];
  if (alts) {
    for (const alt of alts) {
      const altSymbol = `${alt}${suffix}`;
      match = allChords.find(
        (c) => c.symbol === altSymbol && targetTypes.includes(c.type)
      );
      if (match) return match;
    }
  }

  // Fallback: any chord of matching type with the same root note name start
  match = allChords.find(
    (c) => c.symbol.startsWith(rootNote) && targetTypes.includes(c.type)
  );

  return match || null;
}

export interface ProgressionChordInfo {
  roman: string;
  chordSymbol: string;
  quality: string;
  /** The actual ChordData from our library, or null if not found */
  chordData: ChordData | null;
  degreeIndex: number;
}

export type ProgressionTimerDuration = 0 | 2 | 4 | 8;

interface ProgressionState {
  // Setup
  selectedKey: NoteName;
  selectedScale: ScaleDefinition;
  selectedPreset: ProgressionPreset | null;
  customDegrees: number[];
  useCustom: boolean;
  timerPerChord: ProgressionTimerDuration;

  // Practice
  isPracticing: boolean;
  progressionChords: ProgressionChordInfo[];
  currentChordIndex: number;
  isRevealed: boolean;
  loopCount: number;

  // Actions
  setKey: (key: NoteName) => void;
  setScale: (scale: ScaleDefinition) => void;
  setPreset: (preset: ProgressionPreset) => void;
  setCustomDegrees: (degrees: number[]) => void;
  toggleCustomDegree: (degreeIdx: number) => void;
  setUseCustom: (val: boolean) => void;
  setTimerPerChord: (dur: ProgressionTimerDuration) => void;
  startProgression: () => void;
  stopProgression: () => void;
  revealChord: () => void;
  nextChord: () => void;
  prevChord: () => void;
  getCurrentChord: () => ProgressionChordInfo | null;
  getResolvedChords: () => ProgressionChordInfo[];
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  selectedKey: 'C',
  selectedScale: SCALES[0],
  selectedPreset: COMMON_PROGRESSIONS[0],
  customDegrees: [],
  useCustom: false,
  timerPerChord: 4,
  isPracticing: false,
  progressionChords: [],
  currentChordIndex: 0,
  isRevealed: false,
  loopCount: 0,

  setKey: (key) => set({ selectedKey: key }),
  setScale: (scale) => set({ selectedScale: scale }),
  setPreset: (preset) => set({ selectedPreset: preset, useCustom: false }),
  setCustomDegrees: (degrees) => set({ customDegrees: degrees }),
  toggleCustomDegree: (degreeIdx) => set((state) => {
    const next = [...state.customDegrees, degreeIdx];
    return { customDegrees: next, useCustom: true, selectedPreset: null };
  }),
  setUseCustom: (val) => set({ useCustom: val }),
  setTimerPerChord: (dur) => set({ timerPerChord: dur }),

  getResolvedChords: () => {
    const { selectedKey, selectedScale, selectedPreset, customDegrees, useCustom } = get();
    const scaleChords = resolveScaleChords(selectedKey, selectedScale);
    const degrees = useCustom ? customDegrees : (selectedPreset?.degrees ?? []);

    return degrees.map((degIdx) => {
      const deg = scaleChords[degIdx];
      if (!deg) return { roman: '?', chordSymbol: '?', quality: 'maj', chordData: null, degreeIndex: degIdx };
      const chordData = findChordInLibrary(deg.chordSymbol, deg.quality);
      return {
        roman: deg.roman,
        chordSymbol: deg.chordSymbol,
        quality: deg.quality,
        chordData,
        degreeIndex: deg.degreeIndex,
      };
    });
  },

  startProgression: () => {
    const resolved = get().getResolvedChords();
    set({
      progressionChords: resolved,
      currentChordIndex: 0,
      isRevealed: false,
      isPracticing: true,
      loopCount: 0,
    });
  },

  stopProgression: () => set({ isPracticing: false, isRevealed: false }),

  revealChord: () => set({ isRevealed: true }),

  nextChord: () => {
    const { progressionChords, currentChordIndex, loopCount } = get();
    const nextIndex = currentChordIndex + 1;
    if (nextIndex >= progressionChords.length) {
      set({ currentChordIndex: 0, isRevealed: false, loopCount: loopCount + 1 });
    } else {
      set({ currentChordIndex: nextIndex, isRevealed: false });
    }
  },

  prevChord: () => {
    const { currentChordIndex, progressionChords } = get();
    const prevIndex = currentChordIndex - 1;
    if (prevIndex < 0) {
      set({ currentChordIndex: progressionChords.length - 1, isRevealed: false });
    } else {
      set({ currentChordIndex: prevIndex, isRevealed: false });
    }
  },

  getCurrentChord: () => {
    const { progressionChords, currentChordIndex } = get();
    return progressionChords[currentChordIndex] ?? null;
  },
}));
