export type ChordCategory = 'open' | 'barre' | 'movable';

export type BarreRoot = 6 | 5 | 4;

export type ChordType =
  | 'major'
  | 'minor'
  | 'augmented'
  | 'slash'
  | 'diminished'
  | 'suspended'
  | 'major7'
  | 'dominant7'
  | 'minor7'
  | 'aug7'
  | 'halfDim7'
  | 'dim7'
  | '9th'
  | '11th'
  | '13th';

export interface ChordData {
  id: string;
  name: string;
  symbol: string;
  category: ChordCategory;
  type: ChordType;
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres?: number[];
  rootString?: BarreRoot;
  /** 0-indexed string where the root note lives (0 = low E, 5 = high E) */
  rootNoteString: number;
}

export type TimerDuration = 0 | 2 | 5 | 10;

export interface PracticeSettings {
  category: ChordCategory | 'all';
  chordType: ChordType | 'all';
  timerDuration: TimerDuration;
  barreRoot: BarreRoot | 'all';
}

export const CHORD_TYPE_LABELS: Record<ChordType | 'all', string> = {
  all: 'All Types',
  major: 'Major',
  minor: 'Minor',
  augmented: 'Augmented',
  slash: 'Slash',
  diminished: 'Diminished',
  suspended: 'Suspended',
  major7: 'Major 7th',
  dominant7: 'Dominant 7th',
  minor7: 'Minor 7th',
  aug7: 'Augmented 7th',
  halfDim7: 'Half Dim 7th',
  dim7: 'Fully Dim 7th',
  '9th': '9th',
  '11th': '11th',
  '13th': '13th',
};

export const CATEGORY_LABELS: Record<ChordCategory | 'all', string> = {
  all: 'All Chords',
  open: 'Open Chords',
  barre: 'Barre Chords',
  movable: 'Movable Chords',
};

export const BARRE_ROOT_LABELS: Record<BarreRoot | 'all', string> = {
  all: 'All Roots',
  6: 'Root 6th String',
  5: 'Root 5th String',
  4: 'Root 4th String',
};

/** Returns a display-friendly category label, e.g. "Root 6 Movable" for movable chords with a rootString */
export function getChordCategoryLabel(chord: ChordData): string {
  if (chord.category === 'movable' && chord.rootString) {
    return `Root ${chord.rootString} Movable`;
  }
  if (chord.category === 'barre' && chord.rootString) {
    return `Root ${chord.rootString} Barre`;
  }
  return CATEGORY_LABELS[chord.category];
}
