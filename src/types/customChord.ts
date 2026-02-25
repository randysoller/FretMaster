export type DotShape = 'circle' | 'diamond';

export interface FretMarker {
  fret: number; // 1-based fret number
  string: number; // 0-based string index (0=low E, 5=high E)
  finger: number; // 0 = no label, 1-4 = finger number
  color: string; // hex color
  shape: DotShape; // circle or diamond
  label: string; // custom text label (overrides finger number display)
}

export interface CustomChordData {
  id: string;
  name: string;
  symbol: string;
  baseFret: number;
  numFrets: number; // how many frets to show (default 5)
  mutedStrings: Set<number>; // string indices that are muted (X)
  openStrings: Set<number>; // string indices that are open (O)
  markers: FretMarker[];
  barres: { fret: number; fromString: number; toString: number; color: string }[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_DOT_COLOR = '#d97706'; // amber-600 (matches primary)
export const DEFAULT_ROOT_COLOR = '#38bdf8'; // sky-400 (matches existing root)
export const DEFAULT_BARRE_COLOR = '#d97706';

/**
 * Convert a CustomChordData to a ChordData-compatible object for the library.
 * Includes extra fields (`customMarkers`, `customBarres`, `isCustom`) so the library
 * can render them with custom colors/shapes.
 */
export function customToLibraryChord(custom: CustomChordData): import('@/types/chord').ChordData & {
  isCustom: true;
  customMarkers: FretMarker[];
  customBarres: CustomChordData['barres'];
  customMutedStrings: number[];
  customOpenStrings: number[];
  numFrets: number;
} {
  // Build standard frets/fingers arrays from markers
  const frets: number[] = Array(6).fill(-1);
  const fingers: number[] = Array(6).fill(0);

  // Mark open strings
  for (const s of custom.openStrings) {
    frets[s] = 0;
  }

  // Fill from markers (use the lowest fret marker per string)
  for (const m of custom.markers) {
    const absoluteFret = custom.baseFret + m.fret - 1;
    if (frets[m.string] <= 0 || absoluteFret < frets[m.string]) {
      frets[m.string] = absoluteFret;
      fingers[m.string] = m.finger;
    }
  }

  // Determine root note string from diamond markers
  const rootMarker = custom.markers.find((m) => m.shape === 'diamond');
  const rootNoteString = rootMarker ? rootMarker.string : 0;

  return {
    id: custom.id,
    name: custom.name,
    symbol: custom.symbol,
    category: 'custom' as const,
    type: 'major' as const, // default type for custom chords
    frets,
    fingers,
    baseFret: custom.baseFret,
    rootNoteString,
    isCustom: true as const,
    customMarkers: custom.markers,
    customBarres: custom.barres,
    customMutedStrings: [...custom.mutedStrings],
    customOpenStrings: [...custom.openStrings],
    numFrets: custom.numFrets,
  };
}

export const PRESET_COLORS = [
  '#d97706', // amber (primary)
  '#38bdf8', // sky blue (root)
  '#ef4444', // red
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#6366f1', // indigo
  '#f8fafc', // white
  '#64748b', // slate
];
