/**
 * Music theory data for scales, keys, and chord progressions.
 *
 * Each scale defines intervals (semitones from root) and the chord quality
 * built on each degree.
 */

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** Display-friendly enharmonic names for keys */
export const NOTE_DISPLAY: Record<NoteName, string> = {
  C: 'C',
  'C#': 'C♯ / D♭',
  D: 'D',
  Eb: 'E♭',
  E: 'E',
  F: 'F',
  'F#': 'F♯ / G♭',
  G: 'G',
  Ab: 'A♭',
  A: 'A',
  Bb: 'B♭',
  B: 'B',
};

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'dom7' | 'maj7' | 'min7' | 'halfDim7' | 'dim7' | 'sus4';

export interface ScaleDegree {
  /** Semitone interval from root (0–11) */
  interval: number;
  /** Chord quality built on this degree */
  quality: ChordQuality;
  /** Roman numeral label (e.g. "I", "ii", "III+") */
  roman: string;
}

export interface ScaleDefinition {
  id: string;
  name: string;
  degrees: ScaleDegree[];
}

export const SCALES: ScaleDefinition[] = [
  {
    id: 'major',
    name: 'Major Scale',
    degrees: [
      { interval: 0, quality: 'maj', roman: 'I' },
      { interval: 2, quality: 'min', roman: 'ii' },
      { interval: 4, quality: 'min', roman: 'iii' },
      { interval: 5, quality: 'maj', roman: 'IV' },
      { interval: 7, quality: 'maj', roman: 'V' },
      { interval: 9, quality: 'min', roman: 'vi' },
      { interval: 11, quality: 'dim', roman: 'vii°' },
    ],
  },
  {
    id: 'natural-minor',
    name: 'Minor Scale',
    degrees: [
      { interval: 0, quality: 'min', roman: 'i' },
      { interval: 2, quality: 'dim', roman: 'ii°' },
      { interval: 3, quality: 'maj', roman: 'III' },
      { interval: 5, quality: 'min', roman: 'iv' },
      { interval: 7, quality: 'min', roman: 'v' },
      { interval: 8, quality: 'maj', roman: 'VI' },
      { interval: 10, quality: 'maj', roman: 'VII' },
    ],
  },
  {
    id: 'harmonic-minor',
    name: 'Harmonic Minor Scale',
    degrees: [
      { interval: 0, quality: 'min', roman: 'i' },
      { interval: 2, quality: 'dim', roman: 'ii°' },
      { interval: 3, quality: 'aug', roman: 'III+' },
      { interval: 5, quality: 'min', roman: 'iv' },
      { interval: 7, quality: 'maj', roman: 'V' },
      { interval: 8, quality: 'maj', roman: 'VI' },
      { interval: 11, quality: 'dim', roman: 'vii°' },
    ],
  },
  {
    id: 'melodic-minor',
    name: 'Melodic Minor Scale',
    degrees: [
      { interval: 0, quality: 'min', roman: 'i' },
      { interval: 2, quality: 'min', roman: 'ii' },
      { interval: 3, quality: 'aug', roman: 'III+' },
      { interval: 5, quality: 'maj', roman: 'IV' },
      { interval: 7, quality: 'maj', roman: 'V' },
      { interval: 9, quality: 'dim', roman: 'vi°' },
      { interval: 11, quality: 'dim', roman: 'vii°' },
    ],
  },
  {
    id: 'harmonic-major',
    name: 'Harmonic Major Scale',
    degrees: [
      { interval: 0, quality: 'maj', roman: 'I' },
      { interval: 2, quality: 'dim', roman: 'ii°' },
      { interval: 4, quality: 'min', roman: 'iii' },
      { interval: 5, quality: 'min', roman: 'iv' },
      { interval: 7, quality: 'maj', roman: 'V' },
      { interval: 8, quality: 'maj', roman: 'bVI' },
      { interval: 11, quality: 'dim', roman: 'vii°' },
    ],
  },
  {
    id: 'double-harmonic-major',
    name: 'Double Harmonic Major Scale',
    degrees: [
      { interval: 0, quality: 'maj', roman: 'I' },
      { interval: 1, quality: 'maj', roman: 'bII' },
      { interval: 4, quality: 'min', roman: 'iii' },
      { interval: 5, quality: 'min', roman: 'iv' },
      { interval: 7, quality: 'maj', roman: 'V' },
      { interval: 8, quality: 'maj', roman: 'bVI' },
      { interval: 11, quality: 'dim', roman: 'vii°' },
    ],
  },
];

/** Quality → suffix for display symbol (e.g. "Cm", "Gdim") */
export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: '+',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  halfDim7: 'm7b5',
  dim7: 'dim7',
  sus4: 'sus4',
};

/**
 * Given a root key and a scale, resolve the chord names for each degree.
 * Returns { roman, chordSymbol, noteName, quality } for each degree.
 */
export function resolveScaleChords(
  key: NoteName,
  scale: ScaleDefinition
): {
  roman: string;
  chordSymbol: string;
  noteName: NoteName;
  quality: ChordQuality;
  degreeIndex: number;
}[] {
  const rootIdx = NOTE_NAMES.indexOf(key);
  return scale.degrees.map((deg, i) => {
    const noteIdx = (rootIdx + deg.interval) % 12;
    const noteName = NOTE_NAMES[noteIdx];
    const suffix = QUALITY_SUFFIX[deg.quality];
    return {
      roman: deg.roman,
      chordSymbol: `${noteName}${suffix}`,
      noteName,
      quality: deg.quality,
      degreeIndex: i,
    };
  });
}

/** Common chord progressions in Roman numeral indices (0-based degree index) */
export interface ProgressionPreset {
  id: string;
  name: string;
  /** Array of degree indices (0-based) referencing the scale degrees */
  degrees: number[];
  /** Roman numeral display */
  romanDisplay: string;
}

export const COMMON_PROGRESSIONS: ProgressionPreset[] = [
  { id: 'I-IV-V-I', name: 'I – IV – V – I', degrees: [0, 3, 4, 0], romanDisplay: 'I – IV – V – I' },
  { id: 'I-V-vi-IV', name: 'I – V – vi – IV', degrees: [0, 4, 5, 3], romanDisplay: 'I – V – vi – IV' },
  { id: 'I-IV-vi-V', name: 'I – IV – vi – V', degrees: [0, 3, 5, 4], romanDisplay: 'I – IV – vi – V' },
  { id: 'ii-V-I', name: 'ii – V – I', degrees: [1, 4, 0], romanDisplay: 'ii – V – I' },
  { id: 'I-vi-IV-V', name: 'I – vi – IV – V', degrees: [0, 5, 3, 4], romanDisplay: 'I – vi – IV – V' },
  { id: 'vi-IV-I-V', name: 'vi – IV – I – V', degrees: [5, 3, 0, 4], romanDisplay: 'vi – IV – I – V' },
  { id: 'I-iii-IV-V', name: 'I – iii – IV – V', degrees: [0, 2, 3, 4], romanDisplay: 'I – iii – IV – V' },
  { id: 'I-IV-V-IV', name: 'I – IV – V – IV', degrees: [0, 3, 4, 3], romanDisplay: 'I – IV – V – IV' },
  { id: 'i-iv-v', name: 'i – iv – v', degrees: [0, 3, 4], romanDisplay: 'i – iv – v' },
  { id: 'i-VI-III-VII', name: 'i – VI – III – VII', degrees: [0, 5, 2, 6], romanDisplay: 'i – VI – III – VII' },
  { id: 'i-iv-VII-III', name: 'i – iv – VII – III', degrees: [0, 3, 6, 2], romanDisplay: 'i – iv – VII – III' },
  { id: 'I-ii-iii-IV-V', name: 'I – ii – iii – IV – V', degrees: [0, 1, 2, 3, 4], romanDisplay: 'I – ii – iii – IV – V' },
  { id: '12-bar-blues', name: '12-Bar Blues', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], romanDisplay: 'I-I-I-I-IV-IV-I-I-V-IV-I-V' },
];
