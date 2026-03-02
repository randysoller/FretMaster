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
  /** Optional: force resolution against a specific scale (overrides user's selected scale) */
  scaleId?: string;
}

/**
 * Resolve chord symbols for a preset, respecting an optional scaleId override.
 * Falls back to the user's selected scale when no override is present.
 */
export function resolvePresetChordSymbols(
  preset: ProgressionPreset,
  key: NoteName,
  selectedScale: ScaleDefinition,
): string {
  const scale = preset.scaleId
    ? SCALES.find((s) => s.id === preset.scaleId) ?? selectedScale
    : selectedScale;
  const chords = resolveScaleChords(key, scale);
  return preset.degrees.map((d) => chords[d]?.chordSymbol ?? '?').join(' \u2013 ');
}

/**
 * Resolve full chord info array for a preset, respecting scaleId override.
 */
export function resolvePresetChords(
  preset: ProgressionPreset,
  key: NoteName,
  selectedScale: ScaleDefinition,
) {
  const scale = preset.scaleId
    ? SCALES.find((s) => s.id === preset.scaleId) ?? selectedScale
    : selectedScale;
  return resolveScaleChords(key, scale);
}

/** Music-style categorized chord progressions.
 * Each style has 3–4 common progressions that define that genre's sound. */
export interface StyleCategory {
  id: string;
  name: string;
  emoji: string;
  /** Suggested BPM range for this style */
  bpmRange: { min: number; max: number; default: number };
  progressions: ProgressionPreset[];
}

export const STYLE_PROGRESSIONS: StyleCategory[] = [
  {
    id: 'blues',
    name: 'Blues',
    emoji: '🎸',
    bpmRange: { min: 80, max: 120, default: 95 },
    progressions: [
      { id: 'blues-12bar', name: '12-Bar Blues', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], romanDisplay: 'I-I-I-I-IV-IV-I-I-V-IV-I-V' },
      { id: 'blues-quick-change', name: 'Quick Change Blues', degrees: [0, 3, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], romanDisplay: 'I-IV-I-I-IV-IV-I-I-V-IV-I-V' },
      { id: 'blues-minor', name: 'Minor Blues', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0], romanDisplay: 'i-i-i-i-iv-iv-i-i-v-iv-i-i', scaleId: 'natural-minor' },
      { id: 'blues-8bar', name: '8-Bar Blues', degrees: [0, 4, 3, 3, 0, 4, 0, 4], romanDisplay: 'I-V-IV-IV-I-V-I-V' },
    ],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    emoji: '🎷',
    bpmRange: { min: 100, max: 180, default: 130 },
    progressions: [
      { id: 'jazz-ii-V-I', name: 'ii–V–I', degrees: [1, 4, 0], romanDisplay: 'ii – V – I' },
      { id: 'jazz-I-vi-ii-V', name: 'Rhythm Changes (A)', degrees: [0, 5, 1, 4], romanDisplay: 'I – vi – ii – V' },
      { id: 'jazz-iii-vi-ii-V', name: 'iii–vi–ii–V', degrees: [2, 5, 1, 4], romanDisplay: 'iii – vi – ii – V' },
      { id: 'jazz-I-IV-iii-vi', name: 'I–IV–iii–vi', degrees: [0, 3, 2, 5], romanDisplay: 'I – IV – iii – vi' },
    ],
  },
  {
    id: 'pop',
    name: 'Pop',
    emoji: '🎤',
    bpmRange: { min: 100, max: 130, default: 115 },
    progressions: [
      { id: 'pop-I-V-vi-IV', name: 'Pop Anthem', degrees: [0, 4, 5, 3], romanDisplay: 'I – V – vi – IV' },
      { id: 'pop-vi-IV-I-V', name: 'Emotional Pop', degrees: [5, 3, 0, 4], romanDisplay: 'vi – IV – I – V' },
      { id: 'pop-I-IV-vi-V', name: 'Uplifting Pop', degrees: [0, 3, 5, 4], romanDisplay: 'I – IV – vi – V' },
      { id: 'pop-I-vi-IV-V', name: 'Classic Doo-Wop', degrees: [0, 5, 3, 4], romanDisplay: 'I – vi – IV – V' },
    ],
  },
  {
    id: 'rock',
    name: 'Rock',
    emoji: '🤘',
    bpmRange: { min: 110, max: 150, default: 125 },
    progressions: [
      { id: 'rock-I-IV-V', name: 'Rock \'n\' Roll', degrees: [0, 3, 4], romanDisplay: 'I – IV – V' },
      { id: 'rock-I-bVII-IV', name: 'Classic Rock', degrees: [0, 6, 3], romanDisplay: 'I – ♭VII – IV' },
      { id: 'rock-i-bVI-bVII', name: 'Power Ballad', degrees: [0, 5, 6], romanDisplay: 'i – ♭VI – ♭VII' },
      { id: 'rock-I-V-IV-V', name: 'Driving Rock', degrees: [0, 4, 3, 4], romanDisplay: 'I – V – IV – V' },
    ],
  },
  {
    id: 'country',
    name: 'Country',
    emoji: '🤠',
    bpmRange: { min: 100, max: 140, default: 115 },
    progressions: [
      { id: 'country-I-IV-V-I', name: 'Country Standard', degrees: [0, 3, 4, 0], romanDisplay: 'I – IV – V – I' },
      { id: 'country-I-V-vi-IV', name: 'Country Pop', degrees: [0, 4, 5, 3], romanDisplay: 'I – V – vi – IV' },
      { id: 'country-I-IV-I-V', name: 'Country Shuffle', degrees: [0, 3, 0, 4], romanDisplay: 'I – IV – I – V' },
      { id: 'country-vi-IV-I-V', name: 'Nashville Ballad', degrees: [5, 3, 0, 4], romanDisplay: 'vi – IV – I – V' },
    ],
  },
  {
    id: 'reggae',
    name: 'Reggae',
    emoji: '🌴',
    bpmRange: { min: 70, max: 100, default: 80 },
    progressions: [
      { id: 'reggae-I-IV-V-IV', name: 'One Drop', degrees: [0, 3, 4, 3], romanDisplay: 'I – IV – V – IV' },
      { id: 'reggae-I-V-vi-IV', name: 'Reggae Pop', degrees: [0, 4, 5, 3], romanDisplay: 'I – V – vi – IV' },
      { id: 'reggae-i-iv-i-v', name: 'Roots Reggae', degrees: [0, 3, 0, 4], romanDisplay: 'i – iv – i – v' },
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip Hop',
    emoji: '🎧',
    bpmRange: { min: 80, max: 115, default: 90 },
    progressions: [
      { id: 'hiphop-vi-IV-I-V', name: 'Hip Hop Standard', degrees: [5, 3, 0, 4], romanDisplay: 'vi – IV – I – V' },
      { id: 'hiphop-i-iv-v-i', name: 'Boom Bap', degrees: [0, 3, 4, 0], romanDisplay: 'i – iv – v – i' },
      { id: 'hiphop-i-VI-III-VII', name: 'Trap Melodic', degrees: [0, 5, 2, 6], romanDisplay: 'i – VI – III – VII' },
      { id: 'hiphop-I-vi-ii-V', name: 'Lo-fi Hip Hop', degrees: [0, 5, 1, 4], romanDisplay: 'I – vi – ii – V' },
    ],
  },
  {
    id: 'rnb',
    name: 'R&B',
    emoji: '🎵',
    bpmRange: { min: 60, max: 100, default: 75 },
    progressions: [
      { id: 'rnb-I-vi-ii-V', name: 'Classic R&B', degrees: [0, 5, 1, 4], romanDisplay: 'I – vi – ii – V' },
      { id: 'rnb-I-IV-vi-V', name: 'Smooth R&B', degrees: [0, 3, 5, 4], romanDisplay: 'I – IV – vi – V' },
      { id: 'rnb-vi-V-IV-V', name: 'Modern R&B', degrees: [5, 4, 3, 4], romanDisplay: 'vi – V – IV – V' },
    ],
  },
  {
    id: 'latin',
    name: 'Latin',
    emoji: '💃',
    bpmRange: { min: 90, max: 140, default: 110 },
    progressions: [
      { id: 'latin-I-IV-V-I', name: 'Son Cubano', degrees: [0, 3, 4, 0], romanDisplay: 'I – IV – V – I' },
      { id: 'latin-i-iv-V-i', name: 'Flamenco', degrees: [0, 3, 4, 0], romanDisplay: 'i – iv – V – i' },
      { id: 'latin-I-IV-ii-V', name: 'Bossa Nova', degrees: [0, 3, 1, 4], romanDisplay: 'I – IV – ii – V' },
      { id: 'latin-i-VII-VI-V', name: 'Andalusian Cadence', degrees: [0, 6, 5, 4], romanDisplay: 'i – VII – VI – V' },
    ],
  },
  {
    id: 'funk',
    name: 'Funk',
    emoji: '🕺',
    bpmRange: { min: 100, max: 130, default: 110 },
    progressions: [
      { id: 'funk-I-IV', name: 'Funk Vamp', degrees: [0, 3], romanDisplay: 'I – IV' },
      { id: 'funk-i-iv-i-v', name: 'Funky Minor', degrees: [0, 3, 0, 4], romanDisplay: 'i – iv – i – v' },
      { id: 'funk-I-iii-IV-V', name: 'Funk Groove', degrees: [0, 2, 3, 4], romanDisplay: 'I – iii – IV – V' },
    ],
  },
  {
    id: 'neosoul',
    name: 'Neo Soul',
    emoji: '✨',
    bpmRange: { min: 65, max: 95, default: 78 },
    progressions: [
      { id: 'neosoul-ii-V-I-IV', name: 'Neo Soul Cycle', degrees: [1, 4, 0, 3], romanDisplay: 'ii – V – I – IV' },
      { id: 'neosoul-I-iii-vi-IV', name: 'Warm Neo Soul', degrees: [0, 2, 5, 3], romanDisplay: 'I – iii – vi – IV' },
      { id: 'neosoul-vi-ii-V-I', name: 'Soulful Turnaround', degrees: [5, 1, 4, 0], romanDisplay: 'vi – ii – V – I' },
      { id: 'neosoul-I-vi-ii-V', name: 'Neo Soul Standard', degrees: [0, 5, 1, 4], romanDisplay: 'I – vi – ii – V' },
    ],
  },
  {
    id: 'bluegrass',
    name: 'Bluegrass',
    emoji: '🪕',
    bpmRange: { min: 120, max: 180, default: 140 },
    progressions: [
      { id: 'bluegrass-I-IV-V-I', name: 'Bluegrass Standard', degrees: [0, 3, 4, 0], romanDisplay: 'I – IV – V – I' },
      { id: 'bluegrass-I-I-IV-I-V-I', name: 'Bluegrass Verse', degrees: [0, 0, 3, 0, 4, 0], romanDisplay: 'I – I – IV – I – V – I' },
      { id: 'bluegrass-I-vi-ii-V', name: 'Bluegrass Waltz', degrees: [0, 5, 1, 4], romanDisplay: 'I – vi – ii – V' },
    ],
  },
  {
    id: 'folk',
    name: 'Folk',
    emoji: '🪗',
    bpmRange: { min: 90, max: 130, default: 105 },
    progressions: [
      { id: 'folk-I-IV-V-I', name: 'Folk Standard', degrees: [0, 3, 4, 0], romanDisplay: 'I – IV – V – I' },
      { id: 'folk-I-V-vi-IV', name: 'Singer-Songwriter', degrees: [0, 4, 5, 3], romanDisplay: 'I – V – vi – IV' },
      { id: 'folk-I-iii-IV-V', name: 'Fingerpicking Folk', degrees: [0, 2, 3, 4], romanDisplay: 'I – iii – IV – V' },
      { id: 'folk-i-iv-V-i', name: 'Folk Minor', degrees: [0, 3, 4, 0], romanDisplay: 'i – iv – V – i' },
    ],
  },
];

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
