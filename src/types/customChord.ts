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
