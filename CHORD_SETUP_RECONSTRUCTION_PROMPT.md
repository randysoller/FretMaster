# CHORD SETUP PAGE — FULL RECONSTRUCTION PROMPT

> **Purpose**: Rebuild the FretMaster Chord Setup page exactly as implemented.
> This covers: the complete practice configuration UI with hero section, sticky
> filter bar with three multi-axis filter chips (Key Signature, Shape Category,
> Chord Type) using desktop dropdowns and mobile bottom sheets, contextual root
> string sub-filter, preset dropdown with drag-and-drop reordering, active filter
> pills, chord count indicator, practice summary card with gradient start button,
> two Zustand stores with localStorage persistence (practice filters + presets),
> chord filtering logic with key signature major-scale matching, custom chord
> integration, Fisher–Yates shuffle on start, and all animation/responsive specs.
> Every component, store, filter behavior, animation, and styling detail is
> specified — do NOT simplify, optimize, or refactor any part.

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Type Definitions — chord.ts](#2-type-definitions--chordts)
3. [Key Signatures — scales.ts](#3-key-signatures--scalests)
4. [Practice Store — practiceStore.ts](#4-practice-store--practicestorets)
5. [Preset Store — presetStore.ts](#5-preset-store--presetstorets)
6. [Effective Chords — Custom Chord Integration](#6-effective-chords--custom-chord-integration)
7. [Chord Filtering Logic](#7-chord-filtering-logic)
8. [Key Signature Filtering — Major Scale Matching](#8-key-signature-filtering--major-scale-matching)
9. [Preset-Based Filtering](#9-preset-based-filtering)
10. [Fisher–Yates Shuffle on Practice Start](#10-fisheryates-shuffle-on-practice-start)
11. [ChordSetup Page — Complete Component](#11-chordsetup-page--complete-component)
12. [Hero Section](#12-hero-section)
13. [Sticky Filter Bar — Layout and Behavior](#13-sticky-filter-bar--layout-and-behavior)
14. [Preset Dropdown — Trigger and Active Banner](#14-preset-dropdown--trigger-and-active-banner)
15. [PresetDropdown Component — Full Specification](#15-presetdropdown-component--full-specification)
16. [Filter Chip — Key Signature](#16-filter-chip--key-signature)
17. [Filter Chip — Shape Category](#17-filter-chip--shape-category)
18. [Filter Chip — Chord Type](#18-filter-chip--chord-type)
19. [Key Sheet Content — Internal Component](#19-key-sheet-content--internal-component)
20. [Category Sheet Content — Internal Component](#20-category-sheet-content--internal-component)
21. [Type Sheet Content — Internal Component](#21-type-sheet-content--internal-component)
22. [Contextual Root String Chips](#22-contextual-root-string-chips)
23. [Active Filter Pills and Chord Count](#23-active-filter-pills-and-chord-count)
24. [Practice Summary Card](#24-practice-summary-card)
25. [Start Practice Button](#25-start-practice-button)
26. [Mobile Bottom Sheets](#26-mobile-bottom-sheets)
27. [Desktop Dropdowns](#27-desktop-dropdowns)
28. [CheckboxIcon — Shared Component](#28-checkboxicon--shared-component)
29. [CSS Design System](#29-css-design-system)
30. [Animation Specifications](#30-animation-specifications)
31. [Responsive Behavior](#31-responsive-behavior)
32. [localStorage Persistence Schema](#32-localstorage-persistence-schema)
33. [Integration Points with Other Pages](#33-integration-points-with-other-pages)
34. [Edge Cases and Error Handling](#34-edge-cases-and-error-handling)
35. [Verification Checklist](#35-verification-checklist)
36. [Assumptions](#36-assumptions)

---

## 1. Architecture Overview

The Chord Setup feature consists of the following files:

```
src/
├── pages/
│   └── ChordSetup.tsx                 # Main page (all filter UI + start practice)
├── components/features/
│   └── PresetDropdown.tsx             # Preset dropdown with drag-and-drop reorder
├── stores/
│   ├── practiceStore.ts               # Practice filter state (Zustand + persist)
│   ├── presetStore.ts                 # Preset CRUD state (Zustand + persist)
│   └── customChordStore.ts            # Custom chord state (used by filtering)
├── constants/
│   ├── chords.ts                      # CHORDS array (100+ chord definitions)
│   └── scales.ts                      # KEY_SIGNATURES array
├── types/
│   ├── chord.ts                       # ChordData, ChordCategory, ChordType, etc.
│   └── customChord.ts                 # Custom chord types + converter
└── assets/
    └── hero-guitar.jpg                # Hero background image
```

**Technology stack**:
- React 18 + TypeScript
- Zustand 4+ with `persist` middleware (partialize + merge for Set serialization)
- Framer Motion (AnimatePresence, motion.div)
- Tailwind CSS + HSL CSS custom properties
- lucide-react icons
- react-router-dom

**Key design decisions**:
- Three filter axes (Key, Category, Type) each open as desktop dropdowns OR mobile bottom sheets
- Presets override manual filters — when a preset is active, filter chips are dimmed + non-interactive
- Root string sub-filter only appears when barre or movable categories are selected
- Key filter uses major scale interval matching (not exact note names)
- Practice store serializes `Set` types to arrays for localStorage, then restores them in `merge`
- The page itself is stateless except for `activeSheet: SheetId` — all filter state lives in Zustand
- Navigation to `/practice` on start

---

## 2. Type Definitions — chord.ts

File: `src/types/chord.ts`

```typescript
export type ChordCategory = 'open' | 'barre' | 'movable' | 'custom';
export type BarreRoot = 6 | 5 | 4;
export type ChordType =
  | 'major' | 'minor' | 'augmented' | 'slash' | 'diminished' | 'suspended'
  | 'major7' | 'dominant7' | 'minor7' | 'aug7' | 'halfDim7' | 'dim7'
  | '9th' | '11th' | '13th';

export interface ChordData {
  id: string;
  name: string;
  symbol: string;
  category: ChordCategory;
  type: ChordType;
  frets: number[];       // 6 elements, -1 = muted string
  fingers: number[];     // 6 elements, 0 = open/unplayed
  baseFret: number;
  barres?: number[];
  rootString?: BarreRoot;
  rootNoteString: number; // 0-indexed (0 = low E, 5 = high E)
}

export type TimerDuration = 0 | 2 | 5 | 10;
```

### Label Records:

```typescript
export const CHORD_TYPE_LABELS: Record<ChordType | 'all', string> = {
  all: 'All Types',
  major: 'Major', minor: 'Minor', augmented: 'Augmented', slash: 'Slash',
  diminished: 'Diminished', suspended: 'Suspended', major7: 'Major 7th',
  dominant7: 'Dominant 7th', minor7: 'Minor 7th', aug7: 'Augmented 7th',
  halfDim7: 'Half Dim 7th', dim7: 'Fully Dim 7th',
  '9th': '9th', '11th': '11th', '13th': '13th',
};

export const CATEGORY_LABELS: Record<ChordCategory | 'all', string> = {
  all: 'All Chords',
  open: 'Open Chords', barre: 'Barre Chords', movable: 'Movable Chords', custom: 'My Chords',
};

export const BARRE_ROOT_LABELS: Record<BarreRoot | 'all', string> = {
  all: 'All Roots',
  6: 'Root 6th String', 5: 'Root 5th String', 4: 'Root 4th String',
};
```

---

## 3. Key Signatures — scales.ts

File: `src/constants/scales.ts`

Only the `KEY_SIGNATURES` array and `NOTE_NAMES` are used by the Chord Setup page (scales and progressions are used by the Progression Practice page, not here).

```typescript
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

export interface KeySignature {
  display: string;       // e.g. "C", "G", "F♯", "B♭"
  noteName: NoteName;    // internal semitone reference
  useFlats: boolean;
  type: 'none' | 'sharp' | 'flat';
  count: number;
  notes: string[];       // individual sharp/flat note names
}
```

### KEY_SIGNATURES Array (15 entries, circle-of-fifths order):

| Display | NoteName | useFlats | Type | Count | Notes |
|---------|----------|----------|------|-------|-------|
| C | C | false | none | 0 | [] |
| G | G | false | sharp | 1 | [F♯] |
| D | D | false | sharp | 2 | [F♯, C♯] |
| A | A | false | sharp | 3 | [F♯, C♯, G♯] |
| E | E | false | sharp | 4 | [F♯, C♯, G♯, D♯] |
| B | B | false | sharp | 5 | [F♯, C♯, G♯, D♯, A♯] |
| F♯ | F# | false | sharp | 6 | [F♯, C♯, G♯, D♯, A♯, E♯] |
| C♯ | C# | false | sharp | 7 | [F♯, C♯, G♯, D♯, A♯, E♯, B♯] |
| F | F | true | flat | 1 | [B♭] |
| B♭ | Bb | true | flat | 2 | [B♭, E♭] |
| E♭ | Eb | true | flat | 3 | [B♭, E♭, A♭] |
| A♭ | Ab | true | flat | 4 | [B♭, E♭, A♭, D♭] |
| D♭ | C# | true | flat | 5 | [B♭, E♭, A♭, D♭, G♭] |
| G♭ | F# | true | flat | 6 | [B♭, E♭, A♭, D♭, G♭, C♭] |
| C♭ | B | true | flat | 7 | [B♭, E♭, A♭, D♭, G♭, C♭, F♭] |

---

## 4. Practice Store — practiceStore.ts

File: `src/stores/practiceStore.ts`

Zustand store with `persist` middleware. Uses `partialize` to serialize `Set` types to arrays, and `merge` to restore them.

### State Shape:

```typescript
interface PracticeState {
  // Filter state
  categories: Set<ChordCategory>;        // empty = all
  chordTypes: Set<ChordType>;            // empty = all
  barreRoots: Set<BarreRoot>;            // empty = all
  keyFilter: KeySignature | null;        // null = all keys
  activePresetId: string | null;         // null = manual filters
  timerDuration: TimerDuration;

  // Practice session state
  currentIndex: number;
  isRevealed: boolean;
  isPracticing: boolean;
  practiceChords: ChordData[];
  totalPracticed: number;

  // Actions...
}
```

### Initial Values:
```typescript
categories: new Set<ChordCategory>(),
chordTypes: new Set<ChordType>(),
barreRoots: new Set<BarreRoot>(),
keyFilter: null,
activePresetId: null,
timerDuration: 0,
currentIndex: 0,
isRevealed: false,
isPracticing: false,
practiceChords: [],
totalPracticed: 0,
```

### Persist Configuration:

```typescript
{
  name: 'fretmaster-practice-filters',
  partialize: (state) => ({
    categories: [...state.categories] as ChordCategory[],
    chordTypes: [...state.chordTypes] as ChordType[],
    barreRoots: [...state.barreRoots] as BarreRoot[],
    keyFilter: state.keyFilter,
    timerDuration: state.timerDuration,
    activePresetId: state.activePresetId,
  }),
  merge: (persisted: any, current) => ({
    ...current,
    ...(persisted ? {
      categories: new Set<ChordCategory>(persisted.categories ?? []),
      chordTypes: new Set<ChordType>(persisted.chordTypes ?? []),
      barreRoots: new Set<BarreRoot>(persisted.barreRoots ?? []),
      keyFilter: persisted.keyFilter ?? null,
      timerDuration: persisted.timerDuration ?? 0,
      activePresetId: persisted.activePresetId ?? null,
    } : {}),
  }),
}
```

### Key Actions:

**toggleCategory(cat)**:
1. Clone Set, toggle membership
2. If neither barre nor movable is in the new set AND not all 3 selected: clear barreRoots
3. Always set `activePresetId: null` (manual filter change deactivates preset)

**clearCategories()**: Reset to empty Set + clear barreRoots + null preset

**toggleChordType(type)**:
1. Clone Set, toggle membership
2. Set `activePresetId: null`

**clearChordTypes()**: Reset to empty Set + null preset

**toggleBarreRoot(root)**: Clone Set, toggle membership, null preset

**clearBarreRoots()**: Reset to empty Set, null preset

**setKeyFilter(ks)**: Set keyFilter directly, null preset

**setActivePreset(id)**: Set activePresetId directly (does NOT clear manual filters — they're just dimmed)

**startPractice()**:
1. If `activePresetId` is set, look up preset chords by ID set match
2. Otherwise, use `filterChords()` with current categories, types, barreRoots, keyFilter
3. Shuffle result with Fisher–Yates
4. Set `practiceChords`, reset `currentIndex: 0, isRevealed: false, isPracticing: true, totalPracticed: 0`

**stopPractice()**: `isPracticing: false, isRevealed: false`

**nextChord()**:
1. Increment currentIndex
2. If past end: reshuffle entire array, reset to index 0 (infinite loop)
3. Increment totalPracticed

**prevChord()**: Decrement if > 0, set isRevealed false

**getCurrentChord()**: Return `practiceChords[currentIndex] ?? null`

**getAvailableCount()**:
1. If activePresetId: count matching preset chord IDs in effective chords
2. Otherwise: count `filterChords()` result length

---

## 5. Preset Store — presetStore.ts

File: `src/stores/presetStore.ts`

Zustand store with `persist` middleware.

### State Shape:

```typescript
export interface ChordPreset {
  id: string;              // 'preset-{timestamp}'
  name: string;
  chordIds: string[];
  createdAt: number;
}

interface PresetState {
  presets: ChordPreset[];
  addPreset: (name: string, chordIds: string[]) => string;
  removePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  reorderPreset: (fromIndex: number, toIndex: number) => void;
  getPreset: (id: string) => ChordPreset | undefined;
}
```

### Persist Configuration:
```typescript
{
  name: 'fretmaster-presets',
  partialize: (state) => ({ presets: state.presets }),
  merge: (persisted: any, current) => ({
    ...current,
    presets: (persisted as any)?.presets ?? [],
  }),
}
```

### addPreset:
1. Generate ID: `preset-{Date.now()}`
2. Create `ChordPreset` object
3. Append to presets array
4. **Force-sync to localStorage immediately** (not just via middleware):
   ```typescript
   const current = JSON.parse(localStorage.getItem('fretmaster-presets') || '{"state":{"presets":[]}}');
   current.state.presets = [...(current.state?.presets ?? []), newPreset];
   localStorage.setItem('fretmaster-presets', JSON.stringify(current));
   ```
5. Return the new preset ID

### reorderPreset(fromIndex, toIndex):
1. Guard: if same index or out of bounds, return unchanged
2. Splice from `fromIndex`, insert at `toIndex`

### removePreset/renamePreset: Standard CRUD operations.

---

## 6. Effective Chords — Custom Chord Integration

The chord filtering system merges standard chords with custom chords:

```typescript
function getEffectiveChords(): ChordData[] {
  const { customChords, hiddenStandardChords } = useCustomChordStore.getState();
  // Custom chords that replace a standard chord
  const replacedIds = new Set(customChords.filter(c => c.sourceChordId).map(c => c.sourceChordId!));
  // Standard chords excluding replaced and hidden ones
  const standardChords = CHORDS.filter(c => !replacedIds.has(c.id) && !hiddenStandardChords.has(c.id));
  // Convert custom chords to ChordData format
  const converted = customChords.map(customToLibraryChord);
  return [...standardChords, ...converted];
}
```

This ensures:
- Custom chords appear in practice alongside standard chords
- Replaced standard chords are excluded (no duplicates)
- Hidden standard chords are excluded
- Custom chords converted via `customToLibraryChord()` have `category: 'custom'`

---

## 7. Chord Filtering Logic

```typescript
function filterChords(
  categories: Set<ChordCategory>,
  types: Set<ChordType>,
  barreRoots: Set<BarreRoot>,
  keyFilter: KeySignature | null
): ChordData[] {
  const allCats = categories.size === 0 || categories.size === 3;
  const allRoots = barreRoots.size === 0 || barreRoots.size === 3;

  return getEffectiveChords().filter(chord => {
    const matchCategory = allCats || categories.has(chord.category);
    const matchType = types.size === 0 || types.has(chord.type);
    const hasRootFilter = categories.has('barre') || categories.has('movable') || allCats;
    const matchRoot = allRoots || !hasRootFilter || !chord.rootString || barreRoots.has(chord.rootString);
    let matchKey = true;
    if (keyFilter) {
      const rootIdx = NOTE_NAMES.indexOf(keyFilter.noteName);
      const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
      const scaleNotes = new Set(majorIntervals.map(i => (rootIdx + i) % 12));
      const chordRoot = getChordRootSemitone(chord.symbol);
      matchKey = chordRoot >= 0 && scaleNotes.has(chordRoot);
    }
    return matchCategory && matchType && matchRoot && matchKey;
  });
}
```

### Filter Semantics:
- **Categories**: Empty set OR all 3 selected = "All" (no filter). Otherwise, match against `chord.category`.
- **Types**: Empty set = "All". Otherwise, match against `chord.type`.
- **Root String**: Empty set OR all 3 = "All". Only applied when barre/movable is selected or all categories are shown. Chords without `rootString` are included.
- **Key Filter**: When null, no filtering. When set, computes major scale intervals from the key's root note and only includes chords whose root pitch class falls on a scale degree.

---

## 8. Key Signature Filtering — Major Scale Matching

```typescript
function getChordRootSemitone(symbol: string): number {
  const match = symbol.match(/^([A-G])([#b]?)/);
  if (!match) return -1;
  const noteBase: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = noteBase[match[1]] ?? -1;
  if (match[2] === '#') semitone = (semitone + 1) % 12;
  if (match[2] === 'b') semitone = (semitone + 11) % 12;
  return semitone;
}
```

### Algorithm:
1. Extract root note from chord symbol using regex `/^([A-G])([#b]?)/`
2. Convert to semitone index (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
3. Apply sharp (+1) or flat (-1 mod 12) adjustment
4. Compute key's major scale: root + `[0, 2, 4, 5, 7, 9, 11]` mod 12
5. Check if chord's root semitone is in the scale note set

This means selecting "Key of G" shows chords with roots: G, A, B, C, D, E, F#.

---

## 9. Preset-Based Filtering

When `activePresetId` is set:

```typescript
const preset = usePresetStore.getState().presets.find(p => p.id === activePresetId);
if (preset) {
  const idSet = new Set(preset.chordIds);
  filtered = getEffectiveChords().filter(c => idSet.has(c.id));
}
```

Presets store chord IDs directly. Filtering simply matches by ID against the effective chords array (including custom chords). This bypasses all category/type/root/key filters.

---

## 10. Fisher–Yates Shuffle on Practice Start

```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

Called on `startPractice()` and again when `nextChord()` wraps past the end (infinite reshuffle loop).

---

## 11. ChordSetup Page — Complete Component

File: `src/pages/ChordSetup.tsx`

### Imports:
```typescript
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePracticeStore } from '@/stores/practiceStore';
import { usePresetStore } from '@/stores/presetStore';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import type { ChordCategory, ChordType, BarreRoot } from '@/types/chord';
import { KEY_SIGNATURES } from '@/constants/scales';
import type { KeySignature } from '@/constants/scales';
import {
  Play, Music, AlertCircle, ChevronDown, X, KeyRound, Shapes, Layers,
  Guitar, Grip, Music2, Check, Bookmark,
} from 'lucide-react';
import PresetDropdown from '@/components/features/PresetDropdown';
import heroImg from '@/assets/hero-guitar.jpg';
```

### Constants defined inside ChordSetup.tsx:

```typescript
const ALL_CATEGORIES: ChordCategory[] = ['open', 'barre', 'movable'];
const BARRE_ROOTS: BarreRoot[] = [6, 5, 4];
const ALL_CHORD_TYPES: ChordType[] = [
  'major', 'minor', 'augmented', 'slash', 'diminished', 'suspended',
  'major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7',
  '9th', '11th', '13th'
];

const TYPE_GROUPS: { label: string; types: ChordType[] }[] = [
  { label: 'Basic', types: ['major', 'minor', 'augmented', 'diminished', 'suspended', 'slash'] },
  { label: '7th Chords', types: ['major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7'] },
  { label: 'Extended', types: ['9th', '11th', '13th'] },
];

const CATEGORY_ICONS: Record<ChordCategory, React.ReactNode> = {
  open: <Guitar className="size-3.5" />,
  barre: <Grip className="size-3.5" />,
  movable: <Music2 className="size-3.5" />,
  custom: null,
};
```

### Local State:
```typescript
type SheetId = 'key' | 'category' | 'type' | null;
const [activeSheet, setActiveSheet] = useState<SheetId>(null);
```

### Refs:
```typescript
const keyDropdownRef = useRef<HTMLDivElement>(null);
const catDropdownRef = useRef<HTMLDivElement>(null);
const typeDropdownRef = useRef<HTMLDivElement>(null);
```

### Key Behaviors:

**toggleSheet(id)**: If current sheet matches `id`, close it (null). Otherwise, open `id`.

**Outside-click close (desktop only)**: Effect that listens for `mousedown` when `activeSheet` is set and `window.innerWidth >= 640`. Checks if click is outside the active dropdown's ref.

**Body scroll lock (mobile only)**: Effect that sets `document.body.style.overflow = 'hidden'` when a sheet is open on mobile (`window.innerWidth < 640`). Restored on cleanup.

**handleStart()**: Guard `availableCount === 0`. Call `startPractice()`, then `navigate('/practice')`.

**handleActivatePreset(id)**: Toggle logic — if already active, deactivate; otherwise activate.

**handleDeletePreset(id)**: Remove from preset store. If the deleted preset was active, deactivate it.

---

## 12. Hero Section

```
<div class="relative overflow-hidden">
  <!-- Background -->
  <div class="absolute inset-0">
    <img src={heroImg} alt="Guitar fretboard" class="size-full object-cover opacity-30" />
    <div class="absolute inset-0 bg-gradient-to-b from-[hsl(var(--bg-base)/0.3)] via-[hsl(var(--bg-base)/0.7)] to-[hsl(var(--bg-base))]" />
  </div>

  <!-- Content -->
  <div class="relative px-4 sm:px-6 py-10 sm:py-16 md:py-24 text-center max-w-3xl mx-auto">
    <!-- Badge -->
    <div class="inline-flex items-center gap-2 rounded-full border border-primary/0.3 bg-primary/0.08 px-4 py-1.5 mb-6">
      <Music class="size-3.5 text-primary" />
      <span class="text-xs font-body font-medium text-primary">Guitar Chord Trainer</span>
    </div>

    <!-- Title -->
    <h1 class="font-display text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight text-balance">
      <span class="text-default">Master Every Chord.</span>
      <br />
      <span class="text-gradient">One Fret at a Time.</span>
    </h1>

    <!-- Subtitle -->
    <p class="mt-3 sm:mt-5 font-body text-sm sm:text-base md:text-lg text-subtle max-w-xl mx-auto text-pretty">
      Challenge yourself with timed chord reveals. Pick a category, set your timer, and test how well you know your fretboard.
    </p>
  </div>
</div>
```

### Background: Generated hero image of a guitar fretboard at 30% opacity with 3-stop gradient overlay (transparent → 70% bg → solid bg).

### `text-gradient` class: Defined in `index.css`:
```css
.text-gradient {
  background: linear-gradient(135deg, hsl(var(--color-brand)), hsl(var(--color-primary)), hsl(var(--color-emphasis)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 13. Sticky Filter Bar — Layout and Behavior

```
<div class="sticky top-[3.5rem] z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-2
            bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-md
            border-b border-[hsl(var(--border-subtle)/0.5)]
            mb-4 sm:mb-6 space-y-2.5 transition-opacity duration-200">
```

### Offset: `top-[3.5rem]` — sits below the 58px header.

### Content order (top to bottom):
1. PresetDropdown component
2. Preset active banner (conditional)
3. Three filter chips in a horizontal scrollable row
4. Contextual root string chips (conditional, animated)

### When preset is active: Filter chip row gets `opacity-40 pointer-events-none`.

---

## 14. Preset Dropdown — Trigger and Active Banner

### PresetDropdown receives:
```typescript
<PresetDropdown
  presets={presets}
  activePresetId={activePresetId}
  onActivate={handleActivatePreset}
  onDeactivate={() => setActivePreset(null)}
  onDelete={handleDeletePreset}
  onReorder={presetStore.reorderPreset}
/>
```

### Active Preset Banner (shown when `activePreset` is truthy):
```
<div class="flex items-center gap-2 rounded-lg bg-primary/0.1 border border-primary/0.3 px-3 py-2 -mt-1 mb-1">
  <Bookmark class="size-3.5 text-primary fill-current shrink-0" />
  <span class="text-sm font-body font-medium text-primary truncate">
    Using preset: <span class="font-display font-bold">{activePreset.name}</span>
  </span>
  <button class="ml-auto shrink-0 text-xs font-body text-primary hover:underline">
    Use filters
  </button>
</div>
```

The "Use filters" button calls `setActivePreset(null)` to deactivate the preset and restore manual filter control.

---

## 15. PresetDropdown Component — Full Specification

File: `src/components/features/PresetDropdown.tsx`

### Props:
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

### Trigger Button:
- Full width on mobile (`w-full sm:w-auto`)
- Shows Bookmark icon (filled when active) + preset name or "EASY START - Presets"
- Preset count badge (rounded-full, tabular-nums)
- ChevronDown rotates 180° when open
- 3 visual states: Active (primary border/bg/text with shadow), Open (primary border, default text), Default (subtle text with overlay hover)

### Dropdown Panel:
- Absolute positioned, full-width on mobile, 320px on desktop (`w-full sm:w-80`)
- AnimatePresence with opacity + y-8 animation, duration 0.15s
- Max height 50vh with scroll
- Header: "EASY START - Presets" label + "Clear filter" link (when active)
- Each preset row has 3 sections:
  1. **Drag handle** (GripVertical icon, `size-7`): Initiates drag-and-drop reorder
  2. **Preset info** (clickable): Bookmark icon + name + chord count badge
  3. **Delete button** (Trash2 icon, `size-7`): Opens confirm dialog

### Drag-and-Drop Reorder:
- **Pointer-based** (works with mouse + touch)
- Touch: 200ms long-press to activate drag (cancelled if moved >8px before activation)
- Mouse: Immediate activation on pointer down on grip handle
- During drag: Calculate which index pointer is over based on `(clientY - listTop) / itemHeight`
- Non-dragged items shift by `±48px` translateY to make room
- Dragged item gets: `bg-primary/0.15, scale-[1.02], shadow-lg, z-10, opacity-0.85`
- On release: Call `onReorder(fromIndex, currentOver)` if indices differ
- Vibration feedback on activation: `navigator.vibrate?.(30)`

### Confirm Delete Modal:
- Fixed overlay with black/50 backdrop + blur
- Centered card (max-w-[280px]) with scale animation
- Shows preset name in quotes
- Cancel + Delete (semantic-error bg) buttons
- AnimatePresence wrapping

### Empty State:
- Bookmark icon (size-6, faded) + "No presets yet" + hint to go to Chord Library

### Footer Hint:
- When >1 preset: "Drag the grip handle to reorder"
- When ≤1: "Save more presets from the Chord Library"

---

## 16. Filter Chip — Key Signature

### Trigger:
```
<button class="flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-body font-medium transition-all whitespace-nowrap active:scale-95">
  <KeyRound class="size-4" />
  <span>{getKeySummary()}</span>
  <ChevronDown class="size-3.5 transition-transform duration-200 {rotate-180 when open}" />
</button>
```

### Summary Logic:
```typescript
const getKeySummary = () => keyFilter ? `${keyFilter.display} Major` : 'Chords in a Key';
```

### Visual States:
- **Active** (keyFilter set): `border-amber-500/50 bg-amber-500/10 text-amber-400`
- **Open** (sheet active): `border-primary bg-elevated text-default`
- **Default**: `border-default bg-elevated text-subtle hover:bg-overlay`

### Desktop Dropdown:
- Absolute, 320px wide, max-h-[60vh], z-50
- AnimatePresence: opacity 0→1, y -8→0, duration 0.15s
- Renders `<KeySheetContent />`

---

## 17. Filter Chip — Shape Category

### Trigger:
```
<button class="...">
  <Shapes class="size-4" />
  <span>{getCatSummary()}</span>
  {count badge on desktop when categories.size > 0}
  <ChevronDown class="size-3.5" />
</button>
```

### Summary Logic:
```typescript
const getCatSummary = () => {
  if (categories.size === 0) return 'All Shapes';
  if (categories.size === 1) return CATEGORY_LABELS[[...categories][0]].replace(' Chords', '');
  return `${categories.size} shapes`;
};
```

### Visual States:
- **Active**: `border-emerald-500/50 bg-emerald-500/10 text-emerald-400`
- Count badge: `size-5 rounded-full bg-emerald-500 text-bg-base text-[10px] font-bold` (hidden sm:flex)

### Desktop Dropdown:
- 288px wide (`w-72`), renders `<CategorySheetContent />`

---

## 18. Filter Chip — Chord Type

### Trigger:
```
<button class="...">
  <Layers class="size-4" />
  <span class="hidden sm:inline">{getTypeSummary()}</span>
  <span class="sm:hidden">{short version}</span>
  {count badge on desktop}
  <ChevronDown class="size-3.5" />
</button>
```

### Summary Logic:
```typescript
const getTypeSummary = () => {
  if (chordTypes.size === 0) return 'All Types';
  if (chordTypes.size === 1) return CHORD_TYPE_LABELS[[...chordTypes][0]];
  return `${chordTypes.size} types`;
};
```

### Mobile summary: `chordTypes.size > 0 ? '{n} types' : 'Types'`

### Visual States:
- **Active**: `border-violet-500/50 bg-violet-500/10 text-violet-400`
- Count badge: `bg-violet-500`

### Desktop Dropdown:
- 288px wide, renders `<TypeSheetContent />`

---

## 19. Key Sheet Content — Internal Component

```typescript
function KeySheetContent({
  keyFilter,
  onSelect,
  isMobile
}: {
  keyFilter: KeySignature | null;
  onSelect: (ks: KeySignature | null) => void;
  isMobile?: boolean;
})
```

### "All Keys" Row:
- Radio-style circle (size-5 rounded-full, border-2)
- Active: `border-amber-500 bg-amber-500` with Check icon
- Inactive: `border-default`
- Label: "All Keys" in `font-display font-semibold`

### Separator: `h-px bg-border-subtle`

### Key Signature Rows (15 entries):
Each row shows:
- Radio circle (same as above, amber color)
- Display name (bold, `min-w-[36px]`): e.g. "C Major", "G Major"
- Sharp/flat count text: e.g. "2♯" or "3♭" (using Unicode ♯ and ♭)
- Individual note names (right-aligned, very subtle): e.g. "F♯ C♯"
- Count 0 shows: "no sharps or flats"

### Sizing:
- Mobile: `py-3.5, text-base`
- Desktop: `py-2.5, text-sm`

### Selection behavior: Calls `onSelect(ks)` which sets the key filter and closes the sheet.

---

## 20. Category Sheet Content — Internal Component

```typescript
interface CategorySheetContentProps {
  categories: Set<ChordCategory>;
  barreRoots: Set<BarreRoot>;
  onToggleCategory: (cat: ChordCategory) => void;
  onClearCategories: () => void;
  onToggleBarreRoot: (root: BarreRoot) => void;
  onClearBarreRoots: () => void;
  isMobile?: boolean;
}
```

### Category Descriptions:
```typescript
const CATEGORY_DESCRIPTIONS: Record<ChordCategory, string> = {
  open: 'Uses open strings for resonant tones',
  barre: 'Full barre shapes across the neck',
  movable: 'Voicings that shift to any position',
  custom: '',
};
```

### "All Shapes" Row:
- Checkbox icon (emerald color), active when `categories.size === 0`
- Clicking calls `onClearCategories()`

### Category Rows (3: open, barre, movable):
Each shows:
- Checkbox icon (emerald)
- Category icon (`CATEGORY_ICONS[cat]`)
- Category name (bold) — `CATEGORY_LABELS[cat]` with " Chords" removed
- Description text (xs, muted, leading-snug)

### Root String Section (conditional):
- Only appears when barre or movable is selected (`showRootSection`)
- Header: "ROOT STRING" (uppercase, tracking-widest, 10px) + "Clear" button
- 3 buttons in a flex row: "Root 6th String", "Root 5th String", "Root 4th String"
- Active: `bg-[hsl(200_80%_62%/0.2)] text-[hsl(200_80%_62%)] border border-[hsl(200_80%_62%/0.4)]`
- Inactive: `bg-surface text-subtle border-transparent`

---

## 21. Type Sheet Content — Internal Component

```typescript
interface TypeSheetContentProps {
  chordTypes: Set<ChordType>;
  onToggleType: (type: ChordType) => void;
  onToggleAll: () => void;
  onToggleGroup: (types: ChordType[]) => void;
  isMobile?: boolean;
}
```

### "All Types" Row:
- Checkbox icon (violet), active when all 15 types selected
- Clicking calls `onToggleAll()` which selects all or clears all

### Grouped Type Rows:
3 groups with headers:

**Group: Basic** — major, minor, augmented, diminished, suspended, slash
**Group: 7th Chords** — major7, dominant7, minor7, aug7, halfDim7, dim7
**Group: Extended** — 9th, 11th, 13th

### Group Header:
- Clickable (toggles all types in the group)
- Tri-state checkbox:
  - All selected: `bg-violet-500 border-violet-500` + Check icon
  - Some selected: `border-violet-500 bg-violet-500/30` + small square dot
  - None selected: `border-default`
- Label: `font-display, 10px/xs uppercase tracking-widest, text-muted`

### Individual Type Rows:
- Checkbox icon (violet)
- Label: `CHORD_TYPE_LABELS[type]`
- Active: `bg-violet-500/8`
- Font: `font-body font-medium`

### Toggle All Logic:
```typescript
const handleToggleAllTypes = () => {
  if (chordTypes.size === ALL_CHORD_TYPES.length) {
    store.clearChordTypes();
  } else {
    for (const t of ALL_CHORD_TYPES) {
      if (!chordTypes.has(t)) store.toggleChordType(t);
    }
  }
};
```

### Toggle Group Logic:
```typescript
const handleToggleGroup = (types: ChordType[]) => {
  const allSelected = types.every(t => chordTypes.has(t));
  if (allSelected) {
    for (const t of types) { if (chordTypes.has(t)) store.toggleChordType(t); }
  } else {
    for (const t of types) { if (!chordTypes.has(t)) store.toggleChordType(t); }
  }
};
```

---

## 22. Contextual Root String Chips

Appear only when barre or movable category is selected (`hasBorreOrMovable`):

```typescript
const hasBorreOrMovable = categories.has('barre') || categories.has('movable');
```

### AnimatePresence Animation:
```typescript
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className="overflow-hidden"
>
```

### Content:
- Label: "Root:" (11px uppercase tracking-wider, muted)
- 3 chip buttons: "4th String", "5th String", "6th String"
- Active: `bg-[hsl(200_80%_62%/0.2)] text-[hsl(200_80%_62%)] border-[hsl(200_80%_62%/0.4)]`
- Inactive: `bg-surface text-subtle border-transparent`
- Size: `rounded-full px-3 py-1 text-[12px] sm:text-[11px] font-body font-medium`

---

## 23. Active Filter Pills and Chord Count

### Chord Count:
```
<span class="text-primary font-display font-bold">{availableCount}</span> chord{s} available
```

### Active Preset Pill:
- Bookmark icon (filled) + name + X close button
- Colors: `bg-primary/0.12 border-primary/0.25 text-primary`

### Key Filter Pill (when not preset):
- `{display} Major` + X button
- Colors: `bg-amber-500/12 border-amber-500/25 text-amber-400`

### Category Pills (when not preset, shown individually):
- Category name (without " Chords") + X button
- Colors: `bg-emerald-500/12 border-emerald-500/25 text-emerald-400`

### Type Pills (when not preset):
- If ≤3 types: individual pills with `bg-violet-500/12 border-violet-500/25 text-violet-400`
- If >3 types: single pill showing "{n} types" with X that clears all types

### Root String Pills (when not preset):
- "Root {n}th" + X button
- Colors: `bg-[hsl(200_80%_62%/0.12)] border-[hsl(200_80%_62%/0.25)] text-[hsl(200_80%_62%)]`

### "Clear all" Link:
- Visible when any filter is active OR preset is active
- Calls: `clearAll()` (clears categories, types, roots, key) + `setActivePreset(null)`
- Styled: `text-[11px] text-muted hover:text-semantic-error underline underline-offset-2`

### All pills: `rounded-full px-2.5 py-0.5 text-[11px] font-body font-medium`

---

## 24. Practice Summary Card

### Container:
```
<div class="relative rounded-xl border border-subtle bg-elevated/0.6 backdrop-blur-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
  <!-- Accent bar -->
  <div class="absolute top-0 left-0 w-full h-[3px] rounded-t-xl
    bg-gradient-to-r from-brand via-primary to-emphasis/0.3" />
```

### Header:
- Play icon in primary-tinted square (`size-7 rounded-lg bg-primary/0.15`)
- "Ready to Practice" text (`font-display text-base sm:text-lg font-semibold uppercase tracking-wider`)

### Summary Rows — Two Modes:

**When preset is active:**
| Label | Value |
|-------|-------|
| Preset | {name} with Bookmark icon (primary, fill) |
| Chords in preset | {count} |

**When using manual filters:**
| Label | Value |
|-------|-------|
| Category | "All Chords" / joined names / single name |
| Type | "All Types" / joined names (≤3) / "{n} types" |
| Key | "{display} Major" / "All" |
| Root String | (only if barre/movable + specific roots selected) |

### Divider: `h-px bg-border-subtle`

### Available Chords Count:
- `font-display font-bold text-lg`
- Primary color when >0, semantic-error when 0

### Zero Chords Warning:
- AlertCircle icon + explanation text
- `bg-semantic-error/0.1 border-semantic-error/0.2`
- Preset-specific or filter-specific message

---

## 25. Start Practice Button

```
<button
  onClick={handleStart}
  disabled={availableCount === 0}
  class="group/btn relative w-full flex items-center justify-center gap-3 rounded-xl py-4
    font-display text-lg font-bold tracking-wide uppercase overflow-hidden transition-all duration-200
    {enabled: gradient bg + glow + hover effects}
    {disabled: surface bg + muted text + cursor-not-allowed}"
>
```

### Enabled State:
- Background: `bg-gradient-to-r from-brand via-primary to-emphasis`
- Text: `text-bg-base` (dark text on bright gradient)
- Glow: `glow-primary` class (defined in CSS) + hover adds stronger shadow
- Hover shadow: `0 0 30px hsl(primary/0.4), 0 0 80px hsl(primary/0.15)`
- Active: `scale-[0.97]`
- Shimmer effect: White gradient overlay that translates from -100% to +100% on hover, duration 700ms

### Disabled State:
- Background: `bg-surface`
- Text: `text-muted`
- `cursor-not-allowed`

### Play icon: `size-5`, scales up on hover (`group-hover/btn:scale-110`)

---

## 26. Mobile Bottom Sheets

Shown only on `sm:hidden` (< 640px):

### Backdrop:
```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
  onClick={() => setActiveSheet(null)}
  className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
/>
```

### Sheet:
```typescript
<motion.div
  key={activeSheet}
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
  className="sm:hidden fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl
    border-t border-default bg-elevated shadow-2xl max-h-[75vh] flex flex-col"
>
```

### Sheet Structure:
1. **Drag indicator**: `w-10 h-1 rounded-full bg-border-default` centered with `py-3`
2. **Header**: Title (dynamic per sheet type) + Clear button (conditional) + X close button
3. **Body**: `flex-1 overflow-y-auto overscroll-contain px-1 pb-8` — renders appropriate content component
4. **Footer**: Apply/Show Results button — `w-full rounded-xl bg-primary py-3 text-base font-display font-bold`

### Sheet Titles:
- `'key'` → "Select Key"
- `'category'` → "Shape Category"
- `'type'` → "Chord Type"

### Clear Buttons:
- Category: shown when `categories.size > 0`
- Type: shown when `chordTypes.size > 0`
- Key: no clear button (use "All Keys" row instead)

---

## 27. Desktop Dropdowns

Shown only on `hidden sm:block` (≥ 640px):

### Common Styling:
```
absolute left-0 top-full mt-2 rounded-xl border border-default
bg-elevated shadow-2xl shadow-black/50 overflow-hidden z-50
max-h-[60vh] overflow-y-auto
```

### Widths:
- Key: `w-80` (320px)
- Category: `w-72` (288px)
- Type: `w-72` (288px)

### Animation (same for all):
```typescript
initial={{ opacity: 0, y: -8 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -8 }}
transition={{ duration: 0.15 }}
```

### Closing: Outside-click detection via refs (one ref per dropdown). Only the active dropdown's ref is checked.

---

## 28. CheckboxIcon — Shared Component

```typescript
function CheckboxIcon({
  checked,
  color = 'primary'
}: {
  checked: boolean;
  color?: 'primary' | 'emerald' | 'violet' | 'amber';
})
```

### Rendering:
- Container: `size-5 rounded border flex items-center justify-center shrink-0`
- Checked: colored bg + border, white Check icon (size-3)
- Unchecked: `border-default` only

### Color Map:
```typescript
const colorMap = {
  primary: { bg: 'bg-primary', border: 'border-primary' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500' },
  violet: { bg: 'bg-violet-500', border: 'border-violet-500' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-500' },
};
```

Used throughout Key/Category/Type sheet content components. Category and Type use checkboxes; Key uses radio circles (separate implementation with `rounded-full`).

---

## 29. CSS Design System

All colors use HSL CSS custom properties defined in `index.css` `:root`:

### Relevant Tokens (used in this page):
```css
--bg-base           /* Page background */
--bg-elevated       /* Card backgrounds */
--bg-surface        /* Subtle surface (pills, badges) */
--bg-overlay        /* Hover background */
--text-default      /* Primary text */
--text-subtle       /* Secondary text */
--text-muted        /* Tertiary text */
--border-default    /* Prominent borders */
--border-subtle     /* Subtle borders */
--color-primary     /* Primary accent (emerald green) */
--color-brand       /* Brand color (gradient start) */
--color-emphasis    /* Emphasis color (gradient end) */
--semantic-error    /* Error/destructive color (red) */
--semantic-success  /* Success color (green) */
```

### Filter Chip Color Coding:
- **Key**: Amber (`amber-500`, `amber-400`)
- **Category**: Emerald (`emerald-500`, `emerald-400`)
- **Type**: Violet (`violet-500`, `violet-400`)
- **Root String**: Custom blue (`hsl(200 80% 62%)`)

### Special Classes:
- `stage-gradient`: Page background gradient
- `text-gradient`: Multi-color text gradient (brand → primary → emphasis)
- `glow-primary`: Box shadow glow effect
- `scrollbar-none`: Hides scrollbar on horizontal scroll containers
- `safe-area-bottom`: Bottom padding for iOS safe area

### Font Families:
- `font-display`: Sora (headings, labels, buttons)
- `font-body`: DM Sans (body text, descriptions)

---

## 30. Animation Specifications

### Bottom Sheet:
- Spring animation: `stiffness: 400, damping: 36`
- Backdrop: opacity 0→1, duration 0.2s

### Desktop Dropdowns:
- Fade + slide: opacity 0→1, y -8→0, duration 0.15s

### Root String Chips:
- Height auto animation: height 0→auto, opacity 0→1, duration 0.2s, ease: easeOut

### Start Button Shimmer:
- White gradient overlay: `-translate-x-full → translate-x-full` on hover, duration 700ms, ease-in-out

### Filter Chip Interactions:
- `active:scale-95` on all chip buttons
- `transition-all` with default duration

### ChevronDown Rotation:
- `transition-transform duration-200` with `rotate-180` when sheet/dropdown is open

### Preset Dropdown:
- Same fade+slide animation as desktop dropdowns
- Confirm delete modal: scale 0.9→1, opacity 0→1, duration 0.15s

---

## 31. Responsive Behavior

### Mobile (< 640px):
- Filter chips: horizontal scrollable row (`overflow-x-auto scrollbar-none`)
- Sheets: bottom sheets (spring animation from bottom)
- Preset dropdown: full width
- Hero: `py-10`, `text-3xl`
- Summary card: `p-4, space-y-4`
- Start button: `py-4 text-lg`
- Root string chips: `text-[12px]`
- Count badges on chips: hidden (`hidden sm:flex`)
- Type chip label: shortened on mobile (`sm:hidden` / `hidden sm:inline`)

### Desktop (≥ 640px):
- Filter chips: no scroll overflow (`sm:overflow-visible`)
- Sheets: positioned dropdowns (absolute, below trigger)
- Preset dropdown: 320px width
- Hero: `py-16 md:py-24`, `sm:text-4xl md:text-6xl`
- Summary card: `p-6, space-y-5`
- Root string chips: `text-[11px]`
- Count badges: visible
- Summary card wrapper: `max-w-md mx-auto lg:max-w-lg`

### Page Container:
```
<div class="stage-gradient min-h-[calc(100vh-58px)]">
```
58px = header height.

### Setup Section:
```
<div class="px-3 sm:px-6 pb-12 sm:pb-16 mt-2 sm:-mt-4">
  <div class="max-w-5xl mx-auto">
```

---

## 32. localStorage Persistence Schema

| Key | Middleware | Data Shape |
|-----|-----------|------------|
| `fretmaster-practice-filters` | Zustand persist | `{ categories: ChordCategory[], chordTypes: ChordType[], barreRoots: BarreRoot[], keyFilter: KeySignature \| null, timerDuration: TimerDuration, activePresetId: string \| null }` |
| `fretmaster-presets` | Zustand persist | `{ presets: ChordPreset[] }` |

### Set Serialization:
- `partialize`: Converts `Set` → spread array
- `merge`: Converts persisted array → `new Set()`
- This is critical because `JSON.stringify(new Set())` yields `{}`, not an array

### Zustand persist wrapper format:
```json
{
  "state": { ... },
  "version": 0
}
```

---

## 33. Integration Points with Other Pages

### Practice Page (`/practice`):
- `startPractice()` populates `practiceChords` and sets `isPracticing: true`
- Practice page reads `getCurrentChord()`, `nextChord()`, `prevChord()`, `revealChord()`, etc.
- Back button on Practice page calls `stopPractice()`

### Chord Library (`/library`):
- Library page creates presets via `presetStore.addPreset()` with selected chord IDs
- Those presets appear in the Chord Setup's PresetDropdown

### Custom Chords:
- Custom chords from `customChordStore` appear in `getEffectiveChords()` and thus in practice
- Custom chords that replace a standard chord exclude the original

### Home Page (`/`):
- Links to `/chord-practice` which renders ChordSetup

---

## 34. Edge Cases and Error Handling

1. **Empty filter result**: When `availableCount === 0`, Start button is disabled with a warning message. Two different messages: one for preset mode, one for filter mode.

2. **Preset with deleted chords**: If a preset references chord IDs that no longer exist (e.g., custom chord was deleted), those are silently excluded from the count and practice set.

3. **All categories selected**: `categories.size === 3` is treated the same as `categories.size === 0` (all chords). Both mean "no category filter".

4. **Root string filter without barre/movable**: When neither barre nor movable is selected, `barreRoots` is cleared automatically by `toggleCategory`.

5. **Preset deactivation**: Changing any manual filter (category, type, root, key) sets `activePresetId: null`. This prevents conflicts between preset and manual filters.

6. **Double-start prevention**: `startPractice()` always resets `currentIndex`, `isRevealed`, `totalPracticed` — safe to call multiple times.

7. **Fisher–Yates infinite loop**: When `nextChord()` wraps past the end, it reshuffles and resets to index 0. The user never sees a "done" state — practice is infinite.

8. **Body scroll lock**: Only on mobile. Cleaned up on unmount or sheet close.

9. **Outside click**: Only registered when a sheet is open and on desktop. Uses `mousedown` event.

10. **Active preset null safety**: `presets.find(p => p.id === activePresetId)` may return undefined if the preset was deleted elsewhere. All access is guarded with optional chaining.

---

## 35. Verification Checklist

- [ ] Hero section displays with background image at 30% opacity and gradient overlay
- [ ] "Guitar Chord Trainer" badge renders with primary color border and background
- [ ] Title uses `text-gradient` class for multi-color gradient effect
- [ ] Sticky filter bar sticks below header at `top: 3.5rem`
- [ ] PresetDropdown shows all presets with count badges
- [ ] Drag-and-drop reorder works on both mouse and touch (200ms long-press for touch)
- [ ] Reordered presets persist to localStorage immediately
- [ ] Activating a preset shows the active banner and dims filter chips
- [ ] "Use filters" button in banner deactivates preset
- [ ] Key chip opens desktop dropdown (≥640px) or mobile bottom sheet (<640px)
- [ ] Key dropdown shows all 15 key signatures with sharp/flat counts and note names
- [ ] Selecting a key filters chords to that key's major scale
- [ ] Category chip shows correct summary (All Shapes / name / n shapes)
- [ ] Category checkboxes are multi-select with emerald color
- [ ] Each category shows icon + name + description
- [ ] Root string section appears only when barre or movable is selected
- [ ] Root string chips use blue color coding
- [ ] Type chip shows correct summary with violet color coding
- [ ] Types are organized in 3 groups (Basic, 7th Chords, Extended)
- [ ] Group headers toggle all types in the group
- [ ] "All Types" checkbox selects/deselects all 15 types
- [ ] Contextual root chips animate in/out with height transition
- [ ] Active filter pills show below the filter bar with color-coded styling
- [ ] Each pill has an X button to remove that specific filter
- [ ] "Clear all" link removes all filters and preset
- [ ] Chord count updates reactively when filters change
- [ ] Practice summary card shows correct info for preset mode vs filter mode
- [ ] Start button gradient and shimmer effect work correctly
- [ ] Start button is disabled with warning when 0 chords available
- [ ] Pressing Start navigates to `/practice` with shuffled chords
- [ ] Mobile bottom sheets animate from bottom with spring physics
- [ ] Backdrop closes the sheet on tap
- [ ] Sheet body scrolls independently with overscroll containment
- [ ] Apply/Show Results button in sheet footer closes the sheet
- [ ] Desktop dropdowns close on outside click
- [ ] Body scroll is locked when mobile sheet is open
- [ ] All filter state persists to localStorage and restores on reload
- [ ] Changing manual filters deactivates any active preset
- [ ] Preset-based filtering bypasses all manual filters
- [ ] Custom chords appear in practice alongside standard chords
- [ ] Fisher–Yates shuffle produces random order on each start

---

## 36. Assumptions

1. **React Router**: App uses `BrowserRouter`. Route `/practice` exists and renders the Practice page.
2. **Framer Motion**: Version 10+ with `AnimatePresence` and `motion`.
3. **Zustand**: Version 4+ with `persist` middleware supporting `partialize` and `merge`.
4. **lucide-react**: All icons imported individually.
5. **Tailwind CSS**: v3.x with custom theme extending `font-display` (Sora) and `font-body` (DM Sans).
6. **CSS custom properties**: HSL triplets without `hsl()` wrapper, used as `hsl(var(--token))`.
7. **Mobile tab bar**: 56px fixed bottom. This page does NOT have a fixed bottom toolbar (only the practice page does).
8. **Header height**: 58px (`h-[58px]`). Sticky filter bar uses `top-[3.5rem]` (56px).
9. **CHORDS array**: 100+ chord definitions in `src/constants/chords.ts` with the `ChordData` interface.
10. **Custom chords**: Managed by `customChordStore` with `customToLibraryChord()` converter. Custom chords have `category: 'custom'`.
11. **No backend**: All data stored in localStorage. No API calls.
12. **Hero image**: A pre-existing asset at `src/assets/hero-guitar.jpg`. Import via ES6 `import heroImg from '@/assets/hero-guitar.jpg'`.
13. **The preset system is created from the Chord Library page**, not from the Chord Setup page. The Setup page only reads and activates/deactivates presets.
14. **The `stage-gradient` class** is defined in `index.css` and applies the dark page background gradient used throughout the app.
15. **Filter chip row**: Uses `overflow-x-auto` on mobile for horizontal scrolling when all three chips don't fit. On desktop, `sm:overflow-visible` allows dropdowns to render outside the container.
