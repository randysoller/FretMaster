# CHORD LIBRARY — FULL RECONSTRUCTION PROMPT

> **Purpose**: Rebuild the FretMaster Chord Library page exactly as implemented.
> This covers: the full browsable/filterable chord grid with 100+ chords across 4 categories
> and 15 chord types, multi-axis filtering (category, type, root string, search), preset
> system with drag-and-drop reordering, chord selection with floating save bar, chord detail
> modal with swipe navigation, SVG chord diagrams with root note indicators, tablature
> display, custom chord integration, and all supporting Zustand stores with localStorage
> persistence. Every component, store, filter behavior, animation, and styling detail is
> specified — do NOT simplify, optimize, or refactor any part.

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Type System — ChordData and Supporting Types](#2-type-system--chorddata-and-supporting-types)
3. [Type System — CustomChordData](#3-type-system--customchorddata)
4. [Chord Library Data — CHORDS Array](#4-chord-library-data--chords-array)
5. [Chord Library Store — chordLibraryStore.ts](#5-chord-library-store--chordlibrarystorets)
6. [Preset Store — presetStore.ts](#6-preset-store--presetstorets)
7. [Custom Chord Store — customChordStore.ts](#7-custom-chord-store--customchordstorets)
8. [ChordLibrary Page — Complete Component](#8-chordlibrary-page--complete-component)
9. [Filter System — Multi-Axis Architecture](#9-filter-system--multi-axis-architecture)
10. [Category Filter Chips](#10-category-filter-chips)
11. [Type Filter Sheet — Desktop Dropdown and Mobile Bottom Sheet](#11-type-filter-sheet--desktop-dropdown-and-mobile-bottom-sheet)
12. [Root String Filter — Contextual Appearance](#12-root-string-filter--contextual-appearance)
13. [Search Filter](#13-search-filter)
14. [Preset Dropdown — PresetDropdown Component](#14-preset-dropdown--presetdropdown-component)
15. [Drag-and-Drop Reordering in Presets](#15-drag-and-drop-reordering-in-presets)
16. [Chord Selection and Floating Save Bar](#16-chord-selection-and-floating-save-bar)
17. [Chord Grid Layout and Card Design](#17-chord-grid-layout-and-card-design)
18. [SVG Chord Diagram — ChordDiagram Component](#18-svg-chord-diagram--chorddiagram-component)
19. [Custom Chord Diagram — CustomChordDiagram Component](#19-custom-chord-diagram--customchorddiagram-component)
20. [Chord Tablature — ChordTablature Component](#20-chord-tablature--chordtablature-component)
21. [Chord Detail Modal — ChordDetailModal Component](#21-chord-detail-modal--chorddetailmodal-component)
22. [Mobile Swipe Navigation in Detail Modal](#22-mobile-swipe-navigation-in-detail-modal)
23. [Bleeding-Edge Cards (Adjacent Chord Previews)](#23-bleeding-edge-cards-adjacent-chord-previews)
24. [Chord Playback Integration](#24-chord-playback-integration)
25. [Custom Chord Library Integration](#25-custom-chord-library-integration)
26. [Edit Chord Flow](#26-edit-chord-flow)
27. [Active Filter Pills and Result Count](#27-active-filter-pills-and-result-count)
28. [Empty State](#28-empty-state)
29. [Sticky Filter Bar](#29-sticky-filter-bar)
30. [CSS Design System](#30-css-design-system)
31. [Animation Specifications](#31-animation-specifications)
32. [Responsive Behavior](#32-responsive-behavior)
33. [localStorage Persistence Schema Summary](#33-localstorage-persistence-schema-summary)
34. [Integration Points with Other Pages](#34-integration-points-with-other-pages)
35. [Edge Cases and Error Handling](#35-edge-cases-and-error-handling)
36. [Verification Checklist](#36-verification-checklist)
37. [Assumptions](#37-assumptions)

---

## 1. Architecture Overview

The Chord Library consists of the following files:

```
src/
├── pages/
│   └── ChordLibrary.tsx           # Main page component
├── components/features/
│   ├── ChordDiagram.tsx           # SVG chord diagram renderer
│   ├── CustomChordDiagram.tsx     # SVG diagram for custom chords
│   ├── ChordTablature.tsx         # ASCII tablature display
│   ├── ChordDetailModal.tsx       # Full-screen detail modal with swipe
│   └── PresetDropdown.tsx         # Preset selector with drag-and-drop
├── stores/
│   ├── chordLibraryStore.ts       # Filter state with Zustand persist
│   ├── presetStore.ts             # Named chord presets
│   └── customChordStore.ts        # Custom/edited chord storage
├── constants/
│   └── chords.ts                  # 100+ chord definitions
├── types/
│   ├── chord.ts                   # ChordData, ChordType, etc.
│   └── customChord.ts             # CustomChordData, FretMarker, etc.
└── hooks/
    └── useChordAudio.ts           # Web Audio chord playback
```

**Technology stack**:
- React 18 + TypeScript
- Zustand with `persist` middleware (for chordLibraryStore, presetStore, customChordStore)
- Framer Motion (AnimatePresence, motion.div for stagger animations, sheet transitions)
- Web Audio API (chord playback via useChordAudio)
- Tailwind CSS + HSL CSS custom properties
- lucide-react icons
- react-router-dom (useNavigate for editor navigation)
- sonner (toast notifications)

**Key design decisions**:
- All filter state (categories, types, barre roots, search, selections, active preset) is persisted to localStorage via Zustand's persist middleware
- Custom chords merge into the library grid alongside standard chords, replacing originals when edited
- The detail modal supports swipe-to-navigate on mobile with bleeding-edge card previews
- Category chips, type selector, and root filter form a 3-layer sticky filter bar
- Preset filtering overrides all other filters when active

---

## 2. Type System — ChordData and Supporting Types

File: `src/types/chord.ts`

```typescript
export type ChordCategory = 'open' | 'barre' | 'movable' | 'custom';
export type BarreRoot = 6 | 5 | 4;

export type ChordType =
  | 'major' | 'minor' | 'augmented' | 'slash' | 'diminished'
  | 'suspended' | 'major7' | 'dominant7' | 'minor7' | 'aug7'
  | 'halfDim7' | 'dim7' | '9th' | '11th' | '13th';

export interface ChordData {
  id: string;
  name: string;          // e.g. "C Major"
  symbol: string;        // e.g. "C"
  category: ChordCategory;
  type: ChordType;
  frets: number[];        // length 6, index 0=low E, 5=high E. -1 = muted
  fingers: number[];      // 0 = no finger, 1-4 = finger number
  baseFret: number;       // 1 = open position, >1 = higher on neck
  barres?: number[];      // absolute fret numbers that are barred
  rootString?: BarreRoot; // which string group the root is on (for barre/movable)
  rootNoteString: number; // 0-indexed string where root note lives (0=low E, 5=high E)
}

export type TimerDuration = 0 | 2 | 5 | 10;

export interface PracticeSettings {
  category: ChordCategory | 'all';
  chordType: ChordType | 'all';
  timerDuration: TimerDuration;
  barreRoot: BarreRoot | 'all';
}

export const CHORD_TYPE_LABELS: Record<ChordType | 'all', string> = {
  all: 'All Types', major: 'Major', minor: 'Minor', augmented: 'Augmented',
  slash: 'Slash', diminished: 'Diminished', suspended: 'Suspended',
  major7: 'Major 7th', dominant7: 'Dominant 7th', minor7: 'Minor 7th',
  aug7: 'Augmented 7th', halfDim7: 'Half Dim 7th', dim7: 'Fully Dim 7th',
  '9th': '9th', '11th': '11th', '13th': '13th',
};

export const CATEGORY_LABELS: Record<ChordCategory | 'all', string> = {
  all: 'All Chords', open: 'Open Chords', barre: 'Barre Chords',
  movable: 'Movable Chords', custom: 'My Chords',
};

export const BARRE_ROOT_LABELS: Record<BarreRoot | 'all', string> = {
  all: 'All Roots', 6: 'Root 6th String', 5: 'Root 5th String', 4: 'Root 4th String',
};

export function getChordCategoryLabel(chord: ChordData): string {
  if (chord.category === 'custom') return 'Custom';
  if (chord.category === 'movable' && chord.rootString) return `Root ${chord.rootString} Movable`;
  if (chord.category === 'barre' && chord.rootString) return `Root ${chord.rootString} Barre`;
  return CATEGORY_LABELS[chord.category];
}
```

---

## 3. Type System — CustomChordData

File: `src/types/customChord.ts`

```typescript
export type DotShape = 'circle' | 'diamond';

export interface FretMarker {
  fret: number;     // 1-based relative fret number
  string: number;   // 0-based string index (0=low E, 5=high E)
  finger: number;   // 0 = no label, 1-4 = finger number
  color: string;    // HSL or hex color string
  shape: DotShape;  // circle (normal) or diamond (root)
  label: string;    // custom text label (overrides finger number)
}

export interface CustomChordData {
  id: string;
  name: string;
  symbol: string;
  baseFret: number;
  numFrets: number;
  mutedStrings: Set<number>;
  openStrings: Set<number>;
  openDiamonds: Set<number>;     // open strings rendered as blue diamonds (root)
  markers: FretMarker[];
  barres: { fret: number; fromString: number; toString: number; color: string }[];
  chordType?: ChordType;
  chordCategory?: ChordCategory;
  sourceChordId?: string;        // links back to original standard chord when edited
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_DOT_COLOR = 'hsl(38 75% 52%)';
export const DEFAULT_ROOT_COLOR = 'hsl(200 80% 62%)';
export const DEFAULT_BARRE_COLOR = 'hsl(38 75% 52%)';

export const PRESET_COLORS = [
  'hsl(38 75% 52%)', 'hsl(200 80% 62%)', '#ef4444', '#22c55e',
  '#a855f7', '#f97316', '#ec4899', '#14b8a6',
  '#eab308', '#6366f1', '#f8fafc', '#64748b',
];
```

### `customToLibraryChord` conversion function

This function converts a `CustomChordData` into a `ChordData`-compatible object with extra fields for custom rendering:

```typescript
export function customToLibraryChord(custom: CustomChordData): ChordData & {
  isCustom: true;
  customMarkers: FretMarker[];
  customBarres: CustomChordData['barres'];
  customMutedStrings: number[];
  customOpenStrings: number[];
  customOpenDiamonds: number[];
  numFrets: number;
  sourceChordId?: string;
}
```

**Logic**:
1. Build `frets[]` and `fingers[]` from markers (absolute fret = baseFret + marker.fret - 1)
2. Mark muted strings as -1, open strings as 0
3. Convert barres to absolute fret numbers
4. Determine rootNoteString from diamond-shaped markers or openDiamonds set
5. Default category to `'custom'`, type to `'major'` if not specified

---

## 4. Chord Library Data — CHORDS Array

File: `src/constants/chords.ts`

The library contains **100+ chords** organized by category. **Reproduce the COMPLETE array verbatim**. Categories:

| Category | Chord Types | Approximate Count |
|----------|------------|-------------------|
| Open | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, aug7, halfDim7, dim7 | ~50 |
| Barre | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, aug7, halfDim7, dim7 | ~30 |
| Movable | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, 11th, 13th, aug7, halfDim7, dim7 | ~30 |

Each chord entry follows this exact structure:
```typescript
{
  id: 'open-c-major',
  name: 'C Major',
  symbol: 'C',
  category: 'open',
  type: 'major',
  frets: [-1, 3, 2, 0, 1, 0],
  fingers: [0, 3, 2, 0, 1, 0],
  baseFret: 1,
  rootNoteString: 1,
}
```

Barre/movable chords additionally have `barres`, `rootString`, and higher `baseFret` values.

---

## 5. Chord Library Store — chordLibraryStore.ts

File: `src/stores/chordLibraryStore.ts`

Zustand store **WITH persist middleware**. Stores all filter state and chord selections.

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChordLibraryState {
  filterCategories: ChordCategory[];
  filterTypes: ChordType[];
  filterBarreRoots: BarreRoot[];
  searchQuery: string;
  activeLibraryPresetId: string | null;
  selectedChordIds: string[];
  // ... actions
}

export const useChordLibraryStore = create<ChordLibraryState>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'fretmaster-chord-library-filters',
      partialize: (state) => ({
        filterCategories: state.filterCategories,
        filterTypes: state.filterTypes,
        filterBarreRoots: state.filterBarreRoots,
        searchQuery: state.searchQuery,
        activeLibraryPresetId: state.activeLibraryPresetId,
        selectedChordIds: state.selectedChordIds,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted ? {
          filterCategories: persisted.filterCategories ?? [],
          filterTypes: persisted.filterTypes ?? [],
          filterBarreRoots: persisted.filterBarreRoots ?? [],
          searchQuery: persisted.searchQuery ?? '',
          activeLibraryPresetId: persisted.activeLibraryPresetId ?? null,
          selectedChordIds: persisted.selectedChordIds ?? [],
        } : {}),
      }),
    }
  )
);
```

### Key behaviors:

**toggleCategory(cat)**:
- Toggles the category in the array (add if not present, remove if present)
- **Side effect**: If after toggle neither `'barre'` nor `'movable'` is in the array, clears `filterBarreRoots` to `[]` (root filter becomes irrelevant)

**clearCategories()**: Sets `filterCategories: []` AND `filterBarreRoots: []`

**toggleType(type)**: Toggles in array

**setFilterTypes(types)**: Replaces entire types array (used for group toggle)

**clearTypes()**: Sets `filterTypes: []`

**toggleBarreRoot(root)**: Toggles in array

**clearBarreRoots()**: Sets `filterBarreRoots: []`

**setSearchQuery(q)**: Sets search string

**setActiveLibraryPreset(id)**: Sets active preset ID (or null to deactivate)

**toggleChordSelection(id)**: Toggles chord ID in selectedChordIds array

**setSelectedChordIds(ids)**: Replaces entire selection (used for "Select All")

**clearSelectedChords()**: Sets `selectedChordIds: []`

**clearAll()**: Resets all filters: `filterCategories: [], filterTypes: [], filterBarreRoots: [], searchQuery: '', activeLibraryPresetId: null`

### localStorage key: `'fretmaster-chord-library-filters'`

---

## 6. Preset Store — presetStore.ts

File: `src/stores/presetStore.ts`

```typescript
export interface ChordPreset {
  id: string;          // 'preset-{timestamp}'
  name: string;
  chordIds: string[];
  createdAt: number;
}
```

Zustand store **WITH persist middleware**.

### Key behaviors:

**addPreset(name, chordIds)**:
- Creates `id: 'preset-${Date.now()}'`
- Appends to presets array
- **Force-syncs to localStorage** immediately via manual `localStorage.setItem` after zustand set (for navigation safety — user may navigate away before persist middleware writes)
- Returns the new preset ID

**removePreset(id)**: Filters out by ID

**renamePreset(id, name)**: Updates name

**reorderPreset(fromIndex, toIndex)**: Splice-based reorder with bounds checking

**getPreset(id)**: Returns preset by ID or undefined

### localStorage key: `'fretmaster-presets'`

---

## 7. Custom Chord Store — customChordStore.ts

File: `src/stores/customChordStore.ts`

Large Zustand store with persist middleware. Manages custom chord creation, editing standard chords, and hidden standard chords.

### Key properties used by Chord Library:
- `customChords: CustomChordData[]` — all user-created/edited chords
- `hiddenStandardChords: Set<string>` — IDs of standard chords the user has deleted
- `editChord(id)` — loads a custom chord for editing (navigates to /editor)
- `editStandardChord(chord)` — converts a standard ChordData to CustomChordData for editing

### localStorage key: `'fretmaster-custom-chords-v2'`

### Hidden chords key: `'fretmaster-hidden-chords'` (manual localStorage, not zustand persist)

### Migration: On first load, checks old key `'fretmaster-custom-chords'` and migrates data

### `editStandardChord` conversion logic:
1. Check if an existing custom chord has `sourceChordId === chord.id` — if so, load that instead
2. Otherwise, convert the standard chord to CustomChordData:
   - Calculate `baseFret` from fretted values
   - Calculate `numFrets` as `max(5, maxFret - baseFret + 2)`, capped at 7
   - Mark muted/open strings from frets array
   - Create markers with correct colors: root notes get `'hsl(200 80% 62%)'` and `'diamond'` shape; others get `'hsl(38 75% 52%)'` and `'circle'` shape
   - Convert barres from absolute fret to relative fret
   - Set `sourceChordId` to the standard chord's ID

---

## 8. ChordLibrary Page — Complete Component

File: `src/pages/ChordLibrary.tsx`

### Component structure (top to bottom):
1. **Header** — Title "Chord Library" + subtitle with total count + deselect button
2. **Sticky filter bar** (sticks below header at `top: 3.5rem`):
   - Row 0: PresetDropdown
   - Preset active banner (if preset selected)
   - Row 1: Search input + Type dropdown trigger
   - Row 2: Category chips (horizontal scroll)
   - Row 3: Root string chips (animated, shown only when barre/movable selected)
3. **Active filter pills + result count**
4. **Legend** (finger position + root note indicators)
5. **Chord grid** — responsive card layout
6. **Mobile type bottom sheet** (AnimatePresence)
7. **ChordDetailModal** (overlay)
8. **Floating save bar** (when chords selected)

### Key local state:
- `typeSheetOpen: boolean` — type filter sheet visibility
- `selectedChord: ChordData | null` — modal target
- `showSaveForm: boolean` — preset name form visibility
- `presetName: string` — text input value

### ExtendedChordData type:
```typescript
type ExtendedChordData = ChordData & {
  isCustom?: boolean;
  customMarkers?: any[];
  customBarres?: any[];
  customMutedStrings?: number[];
  customOpenStrings?: number[];
  customOpenDiamonds?: number[];
  numFrets?: number;
};
```

### ALL_CHORDS computation (useMemo):
1. Convert all custom chords via `customToLibraryChord`
2. Build a Set of `sourceChordId`s from custom chords (these are replacements)
3. Filter standard CHORDS to exclude: replaced chords AND hidden chords
4. Merge: `[...standardChords, ...convertedCustomChords]`

### Filtered chords computation (useMemo):
- **If activeLibraryPreset is set**: Filter ALL_CHORDS to only those whose ID is in the preset's `chordIds`
- **Otherwise**: Apply all 4 filter axes simultaneously:
  - Category: `filterCategories.size === 0` means all pass; otherwise must match
  - Type: `filterTypes.size === 0` means all pass; otherwise must match
  - Root: `filterBarreRoots.size === 0` means all pass; if chord has no `rootString` it passes; otherwise must match
  - Search: case-insensitive match against `chord.name` or `chord.symbol`

### Count computations (useMemo each):
- `categoryCounts`: For each category, count chords matching other active filters
- `typeCounts`: For each type, count chords matching other active filters
- `rootCounts`: For each root, count chords matching other active filters

These cross-filter counts ensure chips show relevant numbers.

---

## 9. Filter System — Multi-Axis Architecture

The filter system uses 4 independent axes that AND together:

| Axis | State | Empty = All | Persisted |
|------|-------|-------------|-----------|
| Category | `ChordCategory[]` | Yes | Yes |
| Type | `ChordType[]` | Yes | Yes |
| Root String | `BarreRoot[]` | Yes | Yes |
| Search | `string` | Yes (empty string) | Yes |

Plus one override axis:
- **Active Preset**: When set, bypasses ALL other filters and shows only preset chords

### Filter interaction rules:
1. When preset is active, filter UI becomes `opacity-40 pointer-events-none`
2. Clearing preset re-enables filters
3. Toggling a category clears root filter if neither barre nor movable remains
4. Each filter axis shows counts computed against all OTHER active filters

---

## 10. Category Filter Chips

Horizontal scrollable row of pill buttons:

```
[All] [Open (count)] [Barre (count)] [Movable (count)] [Custom (count)]
```

### Constants:
```typescript
const ALL_CAT_OPTIONS: ChordCategory[] = ['open', 'barre', 'movable', 'custom'];

const CATEGORY_ICONS: Record<ChordCategory, React.ReactNode> = {
  open: <Guitar className="size-3.5" />,
  barre: <Grip className="size-3.5" />,
  movable: <Music2 className="size-3.5" />,
  custom: <Edit3 className="size-3.5" />,
};
```

### "All" button behavior:
- Active when `filterCategories.size === 0`
- Clicking clears categories AND barre roots
- Uses primary color fill when active

### Individual category button behavior:
- Clicking toggles that category via `store.toggleCategory`
- Active state: primary background, base text, shadow
- Inactive state: surface background, subtle text
- Label text: `CATEGORY_LABELS[cat]` with " Chords" and "My " stripped

### Container classes:
```
flex items-center gap-1.5 overflow-x-auto sm:overflow-visible pb-0.5 scrollbar-none -mx-1 px-1
```

Faded when preset active: `opacity-40 pointer-events-none`

---

## 11. Type Filter Sheet — Desktop Dropdown and Mobile Bottom Sheet

### Trigger button:
- Shows `SlidersHorizontal` icon + summary text
- Summary: "All Types" (0 selected), type label (1 selected), "{n} types" (2+ selected)
- Badge: count pill when types selected
- ChevronDown rotates 180° when open

### Desktop dropdown (hidden on mobile `sm:block`):
- `absolute right-0 top-full mt-2 w-72 rounded-xl`
- max-height: `60vh` with overflow scroll
- Closes on outside click

### Mobile bottom sheet (hidden on desktop `sm:hidden`):
- Full-screen overlay with `bg-black/60 backdrop-blur-sm`
- Sheet slides up from bottom with spring animation: `stiffness: 400, damping: 36`
- Drag handle bar at top
- "Show Results" button at bottom
- `max-h-[75vh]` with scroll
- Body scroll locked when open (`document.body.style.overflow = 'hidden'`)

### TypeSheetContent (shared between desktop and mobile):

```typescript
const TYPE_GROUPS = [
  { label: 'Basic', types: ['major', 'minor', 'augmented', 'diminished', 'suspended', 'slash'] },
  { label: '7th Chords', types: ['major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7'] },
  { label: 'Extended', types: ['9th', '11th', '13th'] },
];
```

Structure:
1. **"All Types" toggle** — selects/deselects all 15 types
2. Divider
3. **For each group**:
   - Group header with tri-state checkbox (all, some, none) — clicking toggles entire group
   - Individual type buttons with checkbox, label, and count

### Checkbox states:
- **Checked**: Primary fill with Check icon
- **Indeterminate** (group only): Primary border with small dot inside
- **Unchecked**: Default border, no fill

### Group toggle logic:
```typescript
const handleToggleGroup = (types: ChordType[]) => {
  const allSelected = types.every(t => filterTypes.has(t));
  if (allSelected) {
    // Remove all group types from current selection
    store.setFilterTypes(current.filter(t => !types.includes(t)));
  } else {
    // Add all group types to current selection
    const merged = new Set([...current, ...types]);
    store.setFilterTypes([...merged]);
  }
};
```

### Mobile-specific sizing:
- `isMobile`: padding `py-3.5` (vs `py-2.5`), text `text-base` (vs `text-sm`)

---

## 12. Root String Filter — Contextual Appearance

Only visible when `filterCategories` includes `'barre'` or `'movable'`. Animated in/out with Framer Motion:

```typescript
const showRootFilter = filterCategories.has('barre') || filterCategories.has('movable');
```

### Animation:
```jsx
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
/>
```

### Layout:
```
Root: [6th String (count)] [5th String (count)] [4th String (count)]
```

- "Root:" label in uppercase with 11px text
- Chips use a distinct blue accent: `hsl(200 80% 62%)` for active state
- Inactive: surface background with transparent border
- Counts shown as 10px tabular nums

---

## 13. Search Filter

Full-width text input with search icon and clear button:

```
[🔍 Search chords...           ✕]
```

- Left: `Search` icon at `left-3`, `size-4`
- Input: `pl-10 pr-9 py-2.5 text-sm`, focus ring with primary color
- Right: Clear button appears only when `searchQuery !== ''`
- Clear button: `size-5` circle with `X` icon

### Search matching function:
```typescript
const matchesSearch = useCallback((chord: ChordData) => {
  return searchQuery === '' ||
    chord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chord.symbol.toLowerCase().includes(searchQuery.toLowerCase());
}, [searchQuery]);
```

---

## 14. Preset Dropdown — PresetDropdown Component

File: `src/components/features/PresetDropdown.tsx`

Props:
```typescript
interface PresetDropdownProps {
  presets: ChordPreset[];
  activePresetId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}
```

### Trigger button:
- Full width on mobile, auto-width on desktop
- Shows `Bookmark` icon (filled when active), preset name or "EASY START - Presets", count badge, ChevronDown
- Active: primary border/bg with shadow
- Inactive: default border, overlay hover

### Dropdown panel:
- `absolute left-0 top-full mt-1.5`
- `w-full sm:w-80 rounded-xl`
- max-height: `50vh`
- Header: "EASY START - Presets" + "Clear filter" link (when active)
- Empty state: Bookmark icon + "No presets yet" message
- Preset list items:
  - Drag handle (GripVertical icon)
  - Preset info (Bookmark icon, name, count badge)
  - Delete button (Trash2 icon)
- Footer hint: "Drag the grip handle to reorder" or "Save more presets from the Chord Library"

### Delete confirmation modal:
- Fixed fullscreen overlay with centered card
- `max-w-[280px] rounded-2xl`
- "Delete Preset" title, preset name, Cancel/Delete buttons
- Delete button: `bg-[hsl(var(--semantic-error))]`

### Preset activation behavior:
- Clicking a preset toggles it: if already active, deactivates; otherwise activates
- When active, the ChordLibrary page shows ONLY chords in the preset (bypasses filters)
- An active banner appears below the dropdown showing preset name with "Use filters" link

---

## 15. Drag-and-Drop Reordering in Presets

Pointer-event based drag system (works for both mouse and touch):

### Activation:
- **Mouse**: Activates immediately on pointer down on drag handle
- **Touch**: Activates after 200ms long press (cancelled if moved >8px before activation)
- Haptic feedback via `navigator.vibrate?.(30)` on activation

### During drag:
- Dragged item gets: `bg-primary/0.15 scale-[1.02] shadow-lg opacity-0.85`
- Other items shift up/down by 48px based on their position relative to drag target
- Shift direction calculated from pointer Y position relative to list top

### On release:
- Calls `onReorder(fromIndex, currentOverIndex)` if positions differ
- All visual state resets

### State management:
- Uses `useRef` for drag state to avoid stale closures in global event listeners
- Visual state managed separately via `dragVisual: { from: number; over: number } | null`

---

## 16. Chord Selection and Floating Save Bar

### Selection behavior:
- Each chord card has a checkbox in top-left corner (always visible)
- Clicking checkbox toggles chord selection via `store.toggleChordSelection(id)`
- Selected state: primary border, primary bg at 8% opacity, glow shadow
- Selected checkbox: primary fill with Check icon and glow

### Floating save bar:
- Appears when `selectedIds.size > 0`
- Fixed position: `bottom-[72px]` on mobile (above tab bar), `bottom-6` on desktop
- Width: full with `left-3 right-3` on mobile, `sm:w-[420px]` on desktop
- Animated in/out with spring: `stiffness: 400, damping: 32`

### Save bar content:
1. **Header row**: Bookmark icon + "{n} chords selected" + "Select all" / "Clear" links
2. **Save button** (default state): "Save as Practice Preset" with Bookmark icon
3. **Save form** (when clicked):
   - Text input auto-focused
   - "Save" button (disabled until name entered)
   - Close button
   - Enter key submits, Escape key cancels

### Save flow:
1. User enters name → clicks Save or presses Enter
2. `presetStore.addPreset(name, [...selectedIds])` creates the preset
3. `store.clearSelectedChords()` clears selection
4. Toast: `Preset "${name}" saved with ${count} chords` with description "Available on the Chord Practice page under My Presets"
5. Form closes

### "Select all" behavior:
- `store.setSelectedChordIds(filteredChords.map(c => c.id))` — selects only currently visible chords

---

## 17. Chord Grid Layout and Card Design

### Grid:
```
grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4
```

### Stagger animation:
```jsx
<motion.div
  initial="hidden"
  animate="visible"
  key={`${filterKey}`}  // re-animates when filters change
  variants={{
    hidden: {},
    visible: { transition: { staggerChildren: 0.04 } },
  }}
>
```

Each card:
```jsx
variants={{
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}}
```

### Card layout (horizontal row):
```
[Checkbox]  [ChordDiagram]  [Name + Category + Full Name]  [Tablature]
[Edit] [Play]  (top-right action buttons)
```

- Left margin `ml-5 sm:ml-6` on diagram to accommodate checkbox
- Flex row: `flex-row items-center gap-3 sm:gap-4`
- Card border: subtle on default, primary/0.4 on hover, primary on selected
- Hover: `scale-[1.01]`, glow shadow
- Active: `scale-[0.99]`
- Click: opens detail modal via `setSelectedChord(chord)`

### Action buttons (top-right):
- Edit: `Edit3` icon, `size-7`, muted color, hover primary
- Play: `Volume2` icon, `size-7`, primary color, primary/0.1 bg
- Both use `e.stopPropagation()` to prevent card click

### Text hierarchy:
- Symbol: `text-base sm:text-lg font-bold`, transitions to primary on hover
- Category: `text-[10px] sm:text-xs uppercase tracking-wider text-muted`
- Name: `text-xs text-subtle`

---

## 18. SVG Chord Diagram — ChordDiagram Component

File: `src/components/features/ChordDiagram.tsx`

### Size configurations:
```typescript
const SIZES = {
  sm: { width: 100, height: 130, dotRadius: 7, fontSize: 14, topY: 18, fretLabelSize: 9 },
  md: { width: 140, height: 175, dotRadius: 9.5, fontSize: 18, topY: 22, fretLabelSize: 11 },
  lg: { width: 200, height: 250, dotRadius: 13, fontSize: 24, topY: 30, fretLabelSize: 14 },
};
```

### Extra padding for fret label:
When `baseFret > 1`, add left padding: `{ sm: 10, md: 14, lg: 20 }` px

### SVG elements (render order):
1. **Fret number label** — e.g. "3fr", positioned left of grid, only when `baseFret > 1`
2. **Fret lines** — horizontal, 6 lines (5 frets + top), top line thicker when no nut
3. **Fret dot inlays** — decorative dots at frets 3, 5, 7, 9, 15, 17, 19, 21 (single) and 12, 24 (double). Color: `hsl(30 15% 50%)` at `opacity: 0.5`
4. **String lines** — vertical, realistic thickness gradient: `[2.6, 2.2, 1.8, 1.4, 1.0, 0.7]` (low E thickest)
5. **Nut** — solid rectangle at top when `baseFret === 1`, rendered AFTER strings (sits in front)
6. **Barre indicators** — for each barre fret:
   - Connecting bar (rounded rect) between outermost contact strings
   - Individual dots at each contact string
   - Root dots rendered as diamonds, others as circles
   - Finger number text on each dot
7. **Open/muted indicators** — above the nut:
   - Open (fret 0): circle outline, or diamond if root note
   - Muted (fret -1): X shape with two crossed lines
8. **Finger dots** (non-barre):
   - Root notes: diamond shape via `RootDiamond` component
   - Others: filled circles
   - Finger number text overlay

### Barre rendering deduplication:
Build a `barreRenderedStrings` Set of `"${stringIndex}-${fretNumber}"` keys to prevent double-rendering dots that belong to both barre and individual sections.

### Root note diamond:
```typescript
function RootDiamond({ x, y, r }) {
  const d = r * 1.15;
  const points = `${x},${y-d} ${x+d},${y} ${x},${y+d} ${x-d},${y}`;
  return <polygon points={points} className="chord-root" />;
}
```

### CSS classes used:
- `.chord-fret` — white, 2px stroke
- `.chord-dot` — fill primary color
- `.chord-dot-text` — fill base color, bold DM Sans
- `.chord-open` — subtle stroke, no fill
- `.chord-muted` — muted stroke, 1.5px
- `.chord-barre` — fill primary color
- `.chord-root` — fill `hsl(200 80% 62%)` (light blue)
- `.chord-root-text` — fill dark, bold DM Sans

---

## 19. Custom Chord Diagram — CustomChordDiagram Component

File: `src/components/features/CustomChordDiagram.tsx`

Similar to ChordDiagram but:
- Accepts `CustomChordData` instead of `ChordData`
- Supports variable `numFrets` (3-7)
- SVG height scales: `config.height * (numFrets / 5)`
- Markers have individual colors and shapes (circle/diamond)
- Barres have individual colors
- Open strings can be regular (circle outline) or diamond (root indicator via `openDiamonds`)
- Muted strings fade the string line to `opacity: 0.3`
- Uses hardcoded color values instead of CSS classes (e.g. `fill="hsl(33 14% 72%)"`)

### Text color contrast:
```typescript
function isLightColor(color: string): boolean {
  // Parse HSL or hex, return true if lightness > 40% or perceived brightness > 160
}
```
Text on markers: dark on light colors, white on dark colors.

---

## 20. Chord Tablature — ChordTablature Component

File: `src/components/features/ChordTablature.tsx`

Renders standard guitar tablature notation. Frets array is reversed to display high e on top.

### Layout:
```
e --0--
B --1--
G --0--
D --2--
A --3--
E --x--
```

### Size configurations:
```typescript
const textSizes = {
  sm: { label: 'text-[10px]', fret: 'text-[13px]', lineH: 'h-[14px]' },
  md: { label: 'text-xs', fret: 'text-[14px]', lineH: 'h-[18px]' },
  lg: { label: 'text-sm', fret: 'text-base', lineH: 'h-[22px]' },
};
```

### Styling:
- White background with neutral border (unlike the dark theme of the rest of the app)
- String labels: bold neutral-800
- Fret numbers: bold neutral-900
- Muted strings: neutral-400
- Dashes: neutral-400
- Font: monospace

---

## 21. Chord Detail Modal — ChordDetailModal Component

File: `src/components/features/ChordDetailModal.tsx`

Props:
```typescript
interface ChordDetailModalProps {
  chord: ExtendedChordData | null;
  onClose: () => void;
  filteredChords?: ExtendedChordData[];   // for navigation
  onNavigate?: (chord: ExtendedChordData) => void;
}
```

### Layout:
1. **Overlay**: Fixed fullscreen, `bg-black/70 backdrop-blur-sm`
2. **Desktop navigation arrows**: Left/right chevrons at screen edges (hidden on mobile)
3. **Mobile bleeding-edge cards**: Adjacent chord previews at screen edges (hidden on desktop)
4. **Content card**: `max-w-md`, rounded-2xl, `border-2 border-[hsl(200_80%_62%/0.45)]`
5. **Header**: Symbol (3xl bold) + category/type/root badges + close button
6. **Diagram section**: ChordDiagram (or CustomChordDiagram) + Tablature side-by-side
7. **Action buttons**: Play (primary) + Edit (outlined)
8. **Legend**: Finger + Root Note indicators (desktop only)
9. **Position indicator**: "3 / 15" (mobile only)
10. **Finger Position Details**: Table with 6 rows showing string name, fret label, finger name

### String detail table:
```typescript
const STRING_NAMES = ['E (6th)', 'A (5th)', 'D (4th)', 'G (3rd)', 'B (2nd)', 'e (1st)'];
```
- Muted strings: `opacity-40`
- Open strings: success color
- Root strings: blue highlight background + blue diamond indicator

### Keyboard handling:
- `Escape` closes modal
- Body scroll locked when open

---

## 22. Mobile Swipe Navigation in Detail Modal

### Swipe phases:
```typescript
type SwipePhase = 'idle' | 'dragging' | 'exit' | 'reposition' | 'enter';
```

### Touch handling:
1. **touchStart**: Record start position and time (mobile only, < 640px)
2. **touchMove**: Calculate dx, ignore if mostly vertical (>10px vertical before horizontal lock). Once 10px horizontal, lock into swipe. Apply damping at edges.
3. **touchEnd**: If offset exceeds 60px threshold:
   - **Swipe left (next)**: Phase → exit (fly out left) → reposition (new card off-screen right) → enter (slide in from right)
   - **Swipe right (prev)**: Phase → exit (fly out right) → reposition (new card off-screen left) → enter (slide in from left)
   - Below threshold: snap back

### Transition timing by phase:
- `dragging`: `none` (immediate follow)
- `exit`: `0.28s cubic-bezier(0.4, 0, 0.2, 1)` + opacity fade
- `reposition`: `none` (instant jump)
- `enter`: `0.3s cubic-bezier(0.16, 1, 0.3, 1)` + opacity in
- `idle`: `0.25s ease-out`

### Rubber-band effect:
When swiping beyond available chords, max offset is 40px with 0.3× dampening.

---

## 23. Bleeding-Edge Cards (Adjacent Chord Previews)

Mobile-only (`sm:hidden`). Partially visible cards at left/right screen edges showing adjacent chord symbol and navigation chevron.

### Layout:
- Width: 68px, positioned with 33px offscreen
- Height: `calc((100vh - 80px) * 0.75)`
- Parallax effect: follows swipe at 0.35× speed

### Threshold bounce:
When swipe offset crosses 60px threshold:
- Border brightens: `hsl(200 80% 62% / 0.5)` → `0.85`
- Scale bounces: `1.0` → `1.08` with spring curve `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Shadow intensifies
- Text and icon change to primary color

### Hidden during exit/reposition phases (`opacity: 0`)

---

## 24. Chord Playback Integration

Uses `useChordAudio` hook from `src/hooks/useChordAudio.ts`.

### Playback triggers:
- **Card play button**: `playChord(chord)` with `e.stopPropagation()`
- **Detail modal play button**: `playChord(chord)`

The chord playback system synthesizes audio via Web Audio API oscillators (3 per string, with low-pass filter sweep). Full details in the separate Chord Playback Reconstruction Prompt.

---

## 25. Custom Chord Library Integration

### Merging logic (in ALL_CHORDS useMemo):
```typescript
const converted = customChords.map(customToLibraryChord);
const replacedIds = new Set(customChords.filter(c => c.sourceChordId).map(c => c.sourceChordId!));
const standardChords = CHORDS.filter(c => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
return [...standardChords, ...converted] as ExtendedChordData[];
```

### Rendering custom chords:
When `chord.isCustom` is true, render `CustomChordDiagram` instead of `ChordDiagram`, reconstructing the `CustomChordData` from the extended fields:
```typescript
{
  id: chord.id, name: chord.name, symbol: chord.symbol,
  baseFret: chord.baseFret, numFrets: chord.numFrets ?? 5,
  mutedStrings: new Set(chord.customMutedStrings ?? []),
  openStrings: new Set(chord.customOpenStrings ?? []),
  openDiamonds: new Set(chord.customOpenDiamonds ?? []),
  markers: chord.customMarkers ?? [],
  barres: chord.customBarres ?? [],
  createdAt: 0, updatedAt: 0,
}
```

---

## 26. Edit Chord Flow

### From card edit button:
```typescript
const handleEditChord = (chord) => {
  if (chord.isCustom) {
    editCustomChord(chord.id);     // loads from custom chord store
  } else {
    editStandardChord(chord);       // converts standard to custom
  }
  navigate('/editor');
};
```

### From detail modal edit button:
Same logic but also calls `onClose()` first to dismiss modal.

---

## 27. Active Filter Pills and Result Count

Below the sticky filter bar, shows:

```
[count] chords   [Category pill ✕]  [Type pill ✕]  [Root pill ✕]  Clear all
```

### Pill design:
- Category pills: primary color accent
- Type pills: emphasis color accent (when ≤3 types shown individually; >3 shows "{n} types" as single pill)
- Root pills: blue accent `hsl(200 80% 62%)`
- Each pill has X button to remove that filter
- "Clear all" link appears when any filter active

---

## 28. Empty State

When `filteredChords.length === 0`:

```
[Search icon in circle]
No chords found
Try adjusting your filters or search query...
[Clear all filters]
```

- Circle: `size-16 rounded-full bg-surface`
- Search icon: `size-7 text-muted`
- Max width: `max-w-sm` for description

---

## 29. Sticky Filter Bar

```
sticky top-[3.5rem] z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-2
bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-md
border-b border-[hsl(var(--border-subtle)/0.5)]
```

Sticks 3.5rem from top (below the app header). Semi-transparent with backdrop blur for content visibility behind it.

---

## 30. CSS Design System

File: `src/index.css`

### Color tokens (HSL format, used as `hsl(var(--token))`):
```css
--color-primary: 38 75% 52%;     /* Amber/gold */
--color-brand: 30 62% 44%;       /* Deeper amber */
--color-emphasis: 43 83% 65%;    /* Light gold */
--text-default: 36 33% 93%;      /* Near white */
--text-subtle: 33 14% 72%;       /* Light gray */
--text-muted: 30 7% 47%;         /* Medium gray */
--bg-base: 30 25% 4%;            /* Near black */
--bg-elevated: 28 20% 8%;        /* Dark gray */
--bg-overlay: 28 17% 11%;        /* Lighter dark */
--bg-surface: 28 14% 15%;        /* Surface gray */
--border-default: 28 12% 21%;
--border-subtle: 28 10% 16%;
--semantic-success: 142 71% 45%;
--semantic-warning: 43 96% 56%;
--semantic-error: 0 84% 60%;
--semantic-info: 217 91% 60%;
```

### Fonts:
- Display font: Sora (weights 300-800)
- Body font: DM Sans (weights 300-700)
- Classes: `font-display`, `font-body`

### Stage gradient (page background):
```css
.stage-gradient {
  background: radial-gradient(ellipse at 50% 0%, hsl(var(--color-primary) / 0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 50%, hsl(var(--color-brand) / 0.05) 0%, transparent 50%),
              hsl(var(--bg-base));
}
```

### Chord diagram CSS utilities:
```css
.chord-dot { fill: hsl(var(--color-primary)); }
.chord-dot-text { fill: hsl(var(--bg-base)); font-weight: 700; font-family: 'DM Sans'; }
.chord-open { stroke: hsl(var(--text-subtle)); stroke-width: 1.5; fill: none; }
.chord-muted { stroke: hsl(var(--text-muted)); stroke-width: 1.5; }
.chord-barre { fill: hsl(var(--color-primary)); }
.chord-root { fill: hsl(200 80% 62%); }
.chord-root-text { fill: hsl(220 20% 10%); font-weight: 700; font-family: 'DM Sans'; }
.chord-fret { stroke: #ffffff; stroke-width: 2; }
```

---

## 31. Animation Specifications

### Grid stagger:
- Stagger delay: `0.04s` per card
- Card enter: `opacity 0→1, y 20→0, duration 0.35s, ease easeOut`
- Grid re-keys on filter change to retrigger animation

### Root filter row:
- Enter: `height 0→auto, opacity 0→1, duration 0.2s, ease easeOut`
- Exit: reverse

### Type sheet (mobile):
- Overlay: fade 0.2s
- Sheet: `y 100% → 0`, spring `stiffness 400, damping 36`

### Type sheet (desktop):
- `opacity 0→1, y -8→0, duration 0.15s`

### Floating save bar:
- `y 80→0, opacity 0→1`, spring `stiffness 400, damping 32`

### Save form toggle:
- `height 0→auto, opacity 0→1` with `AnimatePresence mode="wait"`

### Card hover:
- `scale-[1.01]`, glow shadow, `transition-all duration-200`

### Card press:
- `scale-[0.99]`

---

## 32. Responsive Behavior

### Mobile (< 640px):
- Single column grid
- Category chips: horizontal scroll with `scrollbar-none`
- Type filter: bottom sheet (not dropdown)
- Floating save bar: `bottom-[72px]` (above 56px tab bar + padding)
- Detail modal: full-width with swipe navigation and bleeding-edge cards
- Font sizes bump up (e.g. type sheet uses `text-base` instead of `text-sm`)

### Tablet (640px-1023px):
- 2-column grid
- Desktop-style type dropdown
- Navigation arrows in detail modal

### Desktop (≥ 1024px):
- 3-column at `lg`, 4-column at `xl`
- Type dropdown: `w-72` fixed width
- Preset dropdown: `sm:w-80`
- Floating save bar: `sm:w-[420px]` right-aligned

---

## 33. localStorage Persistence Schema Summary

| Key | Middleware | Data Shape |
|-----|-----------|------------|
| `fretmaster-chord-library-filters` | Zustand persist | `{ filterCategories, filterTypes, filterBarreRoots, searchQuery, activeLibraryPresetId, selectedChordIds }` |
| `fretmaster-presets` | Zustand persist | `{ presets: ChordPreset[] }` |
| `fretmaster-custom-chords-v2` | Zustand persist | `{ customChords: SerializedCustomChord[] }` |
| `fretmaster-hidden-chords` | Manual localStorage | `string[]` (chord IDs) |
| `fretmaster-audio` | Manual localStorage | `{ volume: number, muted: boolean }` |

All Zustand persist stores use the standard Zustand persist wrapper format:
```json
{ "state": { ... }, "version": 0 }
```

---

## 34. Integration Points with Other Pages

### Practice page:
- Presets created in the library are used as chord pools in Practice mode
- Preset IDs reference chord IDs from the CHORDS array

### Chord Editor (`/editor`):
- Edit button navigates to `/editor` after loading the chord into `customChordStore`
- Saved edits appear in the library on next render

### Chord Playback:
- Play button uses `useChordAudio.playChord(chord)` from the audio system
- Volume controlled by global `audioStore`

### Navigation:
- `useNavigate()` from react-router-dom
- Edit flow: `navigate('/editor')`
- Back navigation: standard browser back

---

## 35. Edge Cases and Error Handling

1. **No matching chords**: Shows empty state with clear filters button
2. **Preset with deleted chords**: Chords not in library silently don't appear (filtered by ID match)
3. **Custom chord replacing standard**: `sourceChordId` links replacement to original; standard is excluded from library
4. **Hidden standard chord**: Permanently removed from view via `hiddenStandardChords` Set
5. **Rapid filter changes**: Grid animation re-keys on every filter change, AnimatePresence handles cleanup
6. **Preset save with empty name**: Save button disabled (`!presetName.trim()`)
7. **Touch vs mouse drag**: Different activation timing (200ms for touch, immediate for mouse)
8. **Drag cancel on scroll**: If touch moves >8px vertically before drag activates, drag is cancelled
9. **Type sheet body scroll lock**: Only applied on mobile, cleaned up on unmount
10. **Outside click handling**: Both type dropdown and preset dropdown close on outside mousedown
11. **Swipe during animation**: Blocked — swipe handlers check `swipePhase !== 'idle'` before activating
12. **Modal cleanup**: Animation timers cleaned up on unmount via useEffect return

---

## 36. Verification Checklist

- [ ] Library displays all 100+ standard chords in correct categories
- [ ] Custom chords appear alongside standard chords, replacing originals when `sourceChordId` matches
- [ ] Hidden standard chords do not appear
- [ ] Category filter toggles correctly with count updates
- [ ] Type filter sheet works on both mobile (bottom sheet) and desktop (dropdown)
- [ ] Type groups toggle all types in group
- [ ] Root filter appears only when barre/movable category selected
- [ ] Root filter clears when last barre/movable category is deselected
- [ ] Search matches against chord name and symbol (case-insensitive)
- [ ] All filters persist to localStorage and restore on reload
- [ ] Preset dropdown shows all saved presets with correct counts
- [ ] Activating a preset overrides all filters and shows only preset chords
- [ ] Filter UI becomes disabled (opacity + pointer-events) when preset active
- [ ] Drag-and-drop reordering works with haptic feedback on mobile
- [ ] Chord selection checkboxes toggle correctly
- [ ] Floating save bar appears/disappears with animation
- [ ] "Select all" selects only currently filtered chords
- [ ] Saving preset creates entry in presetStore with correct chord IDs
- [ ] Toast notification appears after save
- [ ] Chord cards show diagram, name/symbol, tablature in horizontal layout
- [ ] Play button triggers chord playback audio
- [ ] Edit button navigates to /editor with correct chord loaded
- [ ] Detail modal opens with chord info, diagram, tablature, finger positions
- [ ] Detail modal supports keyboard dismiss (Escape)
- [ ] Desktop navigation arrows work in detail modal
- [ ] Mobile swipe navigation works with exit/enter animation phases
- [ ] Bleeding-edge cards show adjacent chord symbols with parallax effect
- [ ] Threshold bounce feedback on bleeding-edge cards works
- [ ] Grid animation staggers on filter change
- [ ] Empty state shows when no chords match
- [ ] "Clear all" resets all filters
- [ ] Active filter pills show correct values with remove buttons
- [ ] Sticky filter bar remains visible while scrolling

---

## 37. Assumptions

1. **React Router**: App uses `BrowserRouter` with routes defined in `App.tsx`. The `/editor` route exists for the Chord Editor page.
2. **Framer Motion**: Version 10+ with `AnimatePresence` and `motion` components.
3. **Zustand**: Version 4+ with persist middleware.
4. **lucide-react**: Icons imported individually (Search, X, Volume2, Edit3, SlidersHorizontal, Check, ChevronDown, Guitar, Grip, Music2, Save, Bookmark, Play, GripVertical, Trash2, ChevronLeft, ChevronRight, FileText, ArrowLeft).
5. **sonner**: Toast library used for user feedback.
6. **Tailwind CSS**: v3.x with custom theme extensions for `font-display` (Sora) and `font-body` (DM Sans).
7. **CSS custom properties**: All color values stored as HSL triplets without `hsl()` wrapper. Used as `hsl(var(--token))` in Tailwind arbitrary values.
8. **Mobile tab bar**: 56px height, positioned fixed at bottom. The floating save bar accounts for this with `bottom-[72px]`.
9. **The CHORDS array must be reproduced COMPLETELY** — every chord's frets, fingers, baseFret, barres, rootString, and rootNoteString must be exact for correct diagram rendering and audio playback.
10. **No backend**: All data stored in localStorage. No API calls for chord data.
11. **CustomChordData uses Sets** for `mutedStrings`, `openStrings`, `openDiamonds` — these must be serialized to arrays for localStorage and deserialized back to Sets on load.
12. **The `customToLibraryChord` function is critical** — it bridges the custom chord system with the standard library rendering. Both the grid and the detail modal check `isCustom` to choose the correct diagram component.
