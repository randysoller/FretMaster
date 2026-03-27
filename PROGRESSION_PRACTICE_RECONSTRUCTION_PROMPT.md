# PROGRESSION PRACTICE PAGE — FULL RECONSTRUCTION PROMPT

> **Purpose**: Rebuild the FretMaster Progression Practice page exactly as implemented.
> This covers: the complete two-phase UI (setup view + practice view), key signature
> selection with circle-of-fifths ordered dropdown, 6 scale definitions with degree-based
> chord resolution, 13 common progressions + 13 genre-specific style categories with 40+
> style progressions, favorites system, custom progression builder, saved progressions with
> localStorage persistence, practice view with progression timeline, chord diagram row with
> auto-scroll, microphone-based chord detection with 6-layer voice rejection, metronome
> beat-sync integration, strumming patterns, session statistics, confusion matrix tracking,
> calibration wizard, and a fixed bottom toolbar. Every component, store, filter behavior,
> animation, and styling detail is specified — do NOT simplify, optimize, or refactor any part.

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Music Theory Data — scales.ts](#2-music-theory-data--scalests)
3. [Key Signatures — Circle of Fifths](#3-key-signatures--circle-of-fifths)
4. [Scale Definitions](#4-scale-definitions)
5. [Chord Quality and Symbol Resolution](#5-chord-quality-and-symbol-resolution)
6. [Common Progressions](#6-common-progressions)
7. [Style Progressions — 13 Genre Categories](#7-style-progressions--13-genre-categories)
8. [Strumming Pattern Data — strumming.ts](#8-strumming-pattern-data--strummingts)
9. [Progression Store — progressionStore.ts](#9-progression-store--progressionstorets)
10. [findChordInLibrary — Library Lookup](#10-findchordinlibrary--library-lookup)
11. [Saved Progressions — localStorage Persistence](#11-saved-progressions--localstorage-persistence)
12. [Favorites System — localStorage Persistence](#12-favorites-system--localstorage-persistence)
13. [ProgressionPractice Page — Complete Component](#13-progressionpractice-page--complete-component)
14. [Setup View — Page Header](#14-setup-view--page-header)
15. [Setup View — Key Selector Component](#15-setup-view--key-selector-component)
16. [Setup View — Scale Selector Component](#16-setup-view--scale-selector-component)
17. [Setup View — Scale Chords Preview](#17-setup-view--scale-chords-preview)
18. [Setup View — Progression Tab System](#18-setup-view--progression-tab-system)
19. [Setup View — Common Progressions Tab](#19-setup-view--common-progressions-tab)
20. [Setup View — Favorites Tab](#20-setup-view--favorites-tab)
21. [Setup View — By Style Tab](#21-setup-view--by-style-tab)
22. [Setup View — Custom Builder Tab](#22-setup-view--custom-builder-tab)
23. [Setup View — My Progressions (Save/Load)](#23-setup-view--my-progressions-saveload)
24. [Setup View — Ready to Practice Summary + Start Button](#24-setup-view--ready-to-practice-summary--start-button)
25. [Practice View — Top Bar](#25-practice-view--top-bar)
26. [Practice View — Mic Status and Sensitivity](#26-practice-view--mic-status-and-sensitivity)
27. [Practice View — Detection Settings and Calibration](#27-practice-view--detection-settings-and-calibration)
28. [Practice View — Metronome Status Indicator](#28-practice-view--metronome-status-indicator)
29. [Practice View — Beat Sync Controls and Strumming](#29-practice-view--beat-sync-controls-and-strumming)
30. [Practice View — Progression Timeline](#30-practice-view--progression-timeline)
31. [Practice View — Main Practice Area](#31-practice-view--main-practice-area)
32. [Practice View — Progression Diagram Row](#32-practice-view--progression-diagram-row)
33. [Practice View — Detection Feedback](#33-practice-view--detection-feedback)
34. [Practice View — Fixed Bottom Toolbar](#34-practice-view--fixed-bottom-toolbar)
35. [Practice View — Session Summary Integration](#35-practice-view--session-summary-integration)
36. [Chord Detection Integration](#36-chord-detection-integration)
37. [Metronome Beat-Sync Integration](#37-metronome-beat-sync-integration)
38. [Style-to-BPM Auto-Set](#38-style-to-bpm-auto-set)
39. [CSS Design System](#39-css-design-system)
40. [Animation Specifications](#40-animation-specifications)
41. [Responsive Behavior](#41-responsive-behavior)
42. [localStorage Persistence Schema Summary](#42-localstorage-persistence-schema-summary)
43. [Integration Points with Other Pages](#43-integration-points-with-other-pages)
44. [Edge Cases and Error Handling](#44-edge-cases-and-error-handling)
45. [Verification Checklist](#45-verification-checklist)
46. [Assumptions](#46-assumptions)

---

## 1. Architecture Overview

The Progression Practice feature consists of the following files:

```
src/
├── pages/
│   └── ProgressionPractice.tsx        # Main page (setup + practice views)
├── components/features/
│   ├── ChordDiagram.tsx               # SVG chord diagram renderer
│   ├── CustomChordDiagram.tsx         # SVG diagram for custom chords
│   ├── BeatSyncControls.tsx           # Metronome sync UI
│   ├── StrummingPatternDisplay.tsx    # Strumming pattern visualization
│   ├── VolumeControl.tsx              # Volume slider
│   ├── ShowDiagramsToggle.tsx         # Diagram visibility toggle
│   ├── SessionSummary.tsx             # End-of-session modal
│   ├── AdvancedDetectionSettings.tsx  # Detection parameter sliders
│   └── CalibrationWizard.tsx          # Auto-calibrate microphone
├── stores/
│   ├── progressionStore.ts            # Progression state (non-persisted Zustand)
│   ├── metronomeStore.ts              # Metronome state + beat-sync
│   ├── detectionSettingsStore.ts      # Detection sensitivity settings
│   └── practiceHistoryStore.ts        # Session history + confusion matrix
├── constants/
│   ├── scales.ts                      # Key signatures, scales, progressions
│   └── strumming.ts                   # Strumming patterns per style
├── hooks/
│   ├── useChordDetection.ts           # Microphone chord recognition
│   ├── useSessionStats.ts             # Session attempt tracking
│   ├── useReferenceTone.ts            # Reference tone playback
│   └── useChordAudio.ts              # Chord playback synthesis
└── types/
    └── chord.ts                       # ChordData types
```

**Technology stack**:
- React 18 + TypeScript
- Zustand (progressionStore is NOT persisted; metronomeStore, detectionSettingsStore use persist)
- Framer Motion (AnimatePresence, motion.div, layoutId for tabs)
- Web Audio API (chord detection, playback, reference tones)
- Tailwind CSS + HSL CSS custom properties
- lucide-react icons
- react-router-dom
- sonner (toast notifications)

**Key design decisions**:
- Two-phase UI: Setup View (select key/scale/progression) → Practice View (play along)
- Key selection uses proper key signatures ordered by circle of fifths (sharps then flats)
- Progression presets can override the selected scale via `scaleId` property
- Style progressions auto-set metronome BPM to the genre's default
- Favorites are persisted separately in localStorage (not in Zustand)
- The progression store uses plain Zustand (no persist) — session state is ephemeral
- Saved progressions use manual localStorage read/write

---

## 2. Music Theory Data — scales.ts

File: `src/constants/scales.ts`

### Note Names:
```typescript
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];
```

### Chord Quality System:
```typescript
export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'dom7' | 'maj7' | 'min7' | 'halfDim7' | 'dim7' | 'sus4';

export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: 'dim', aug: '+', dom7: '7',
  maj7: 'maj7', min7: 'm7', halfDim7: 'm7b5', dim7: 'dim7', sus4: 'sus4',
};
```

---

## 3. Key Signatures — Circle of Fifths

```typescript
export interface KeySignature {
  display: string;        // "C", "G", "F♯", "B♭", etc.
  noteName: NoteName;     // internal semitone reference
  useFlats: boolean;      // whether to use flat note names for chord resolution
  type: 'none' | 'sharp' | 'flat';
  count: number;          // number of sharps or flats
  notes: string[];        // the individual sharp/flat note names
}
```

### KEY_SIGNATURES Array (15 entries, ordered: C → sharps → flats):

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

Note: Enharmonic equivalents share the same `noteName` (e.g., D♭ and C♯ both use `'C#'`; G♭ and F♯ both use `'F#'`).

---

## 4. Scale Definitions

```typescript
export interface ScaleDegree {
  interval: number;        // semitones from root (0–11)
  quality: ChordQuality;   // chord quality on this degree
  roman: string;           // Roman numeral label
}

export interface ScaleDefinition {
  id: string;
  name: string;
  degrees: ScaleDegree[];
}
```

### SCALES Array (6 scales):

**1. Major Scale** (`id: 'major'`):
| Degree | Interval | Quality | Roman |
|--------|----------|---------|-------|
| I | 0 | maj | I |
| ii | 2 | min | ii |
| iii | 4 | min | iii |
| IV | 5 | maj | IV |
| V | 7 | maj | V |
| vi | 9 | min | vi |
| vii° | 11 | dim | vii° |

**2. Minor Scale** (`id: 'natural-minor'`):
| Degree | Interval | Quality | Roman |
|--------|----------|---------|-------|
| i | 0 | min | i |
| ii° | 2 | dim | ii° |
| III | 3 | maj | III |
| iv | 5 | min | iv |
| v | 7 | min | v |
| VI | 8 | maj | VI |
| VII | 10 | maj | VII |

**3. Harmonic Minor** (`id: 'harmonic-minor'`): intervals [0,2,3,5,7,8,11], qualities [min,dim,aug,min,maj,maj,dim]

**4. Melodic Minor** (`id: 'melodic-minor'`): intervals [0,2,3,5,7,9,11], qualities [min,min,aug,maj,maj,dim,dim]

**5. Harmonic Major** (`id: 'harmonic-major'`): intervals [0,2,4,5,7,8,11], qualities [maj,dim,min,min,maj,maj,dim]

**6. Double Harmonic Major** (`id: 'double-harmonic-major'`): intervals [0,1,4,5,7,8,11], qualities [maj,maj,min,min,maj,maj,dim]

---

## 5. Chord Quality and Symbol Resolution

### `resolveScaleChords(key, scale, useFlats?)`:

1. Find root index: `NOTE_NAMES.indexOf(key)`
2. Choose name source: `useFlats ? FLAT_NOTE_NAMES : NOTE_NAMES`
3. For each degree: `noteIdx = (rootIdx + degree.interval) % 12`
4. Build symbol: `nameSource[noteIdx] + QUALITY_SUFFIX[degree.quality]`
5. Return: `{ roman, chordSymbol, noteName, quality, degreeIndex }`

### `resolvePresetChordSymbols(preset, key, selectedScale, useFlats?)`:
- If preset has `scaleId`, use that scale instead of `selectedScale`
- Map preset's degrees to chord symbols, join with " – "

### `resolvePresetChords(preset, key, selectedScale, useFlats?)`:
- Same scale override logic, returns full chord info array

---

## 6. Common Progressions

```typescript
export interface ProgressionPreset {
  id: string;
  name: string;
  degrees: number[];        // 0-based degree indices into the scale
  romanDisplay: string;     // Human-readable roman numeral display
  scaleId?: string;         // Optional: forces resolution against a specific scale
}
```

### COMMON_PROGRESSIONS Array (13 presets):

| ID | Name | Degrees | Roman Display |
|----|------|---------|---------------|
| I-IV-V-I | I – IV – V – I | [0,3,4,0] | I – IV – V – I |
| I-V-vi-IV | I – V – vi – IV | [0,4,5,3] | I – V – vi – IV |
| I-IV-vi-V | I – IV – vi – V | [0,3,5,4] | I – IV – vi – V |
| ii-V-I | ii – V – I | [1,4,0] | ii – V – I |
| I-vi-IV-V | I – vi – IV – V | [0,5,3,4] | I – vi – IV – V |
| vi-IV-I-V | vi – IV – I – V | [5,3,0,4] | vi – IV – I – V |
| I-iii-IV-V | I – iii – IV – V | [0,2,3,4] | I – iii – IV – V |
| I-IV-V-IV | I – IV – V – IV | [0,3,4,3] | I – IV – V – IV |
| i-iv-v | i – iv – v | [0,3,4] | i – iv – v |
| i-VI-III-VII | i – VI – III – VII | [0,5,2,6] | i – VI – III – VII |
| i-iv-VII-III | i – iv – VII – III | [0,3,6,2] | i – iv – VII – III |
| I-ii-iii-IV-V | I – ii – iii – IV – V | [0,1,2,3,4] | I – ii – iii – IV – V |
| 12-bar-blues | 12-Bar Blues | [0,0,0,0,3,3,0,0,4,3,0,4] | I-I-I-I-IV-IV-I-I-V-IV-I-V |

---

## 7. Style Progressions — 13 Genre Categories

```typescript
export interface StyleCategory {
  id: string;
  name: string;
  emoji: string;
  bpmRange: { min: number; max: number; default: number };
  progressions: ProgressionPreset[];
}
```

### STYLE_PROGRESSIONS Array:

| ID | Name | Emoji | BPM Range | # Progressions |
|----|------|-------|-----------|----------------|
| blues | Blues | 🎸 | 80–120 (95) | 4 |
| jazz | Jazz | 🎷 | 100–180 (130) | 4 |
| pop | Pop | 🎤 | 100–130 (115) | 4 |
| rock | Rock | 🤘 | 110–150 (125) | 4 |
| country | Country | 🤠 | 100–140 (115) | 4 |
| reggae | Reggae | 🌴 | 70–100 (80) | 3 |
| hiphop | Hip Hop | 🎧 | 80–115 (90) | 4 |
| rnb | R&B | 🎵 | 60–100 (75) | 3 |
| latin | Latin | 💃 | 90–140 (110) | 4 |
| funk | Funk | 🕺 | 100–130 (110) | 3 |
| neosoul | Neo Soul | ✨ | 65–95 (78) | 4 |
| bluegrass | Bluegrass | 🪕 | 120–180 (140) | 3 |
| folk | Folk | 🪗 | 90–130 (105) | 4 |

**Key behavior**: Some style presets have `scaleId` overrides. For example, `blues-minor` forces `scaleId: 'natural-minor'` regardless of the user's selected scale.

Each style category also maps to strumming patterns in `strumming.ts`.

---

## 8. Strumming Pattern Data — strumming.ts

File: `src/constants/strumming.ts`

```typescript
export type StrumType = 'D' | 'U' | 'Ad' | 'Au' | 'rest' | 'mute';

export interface StrummingPattern {
  id: string;
  name: string;
  description: string;
  subdivisions: number;   // 2=8ths, 3=triplets, 4=16ths
  beats: number;          // pattern length in beats
  pattern: StrumType[];   // length = beats × subdivisions
}
```

### STRUM_LABELS:
```
D: '↓', U: '↑', Ad: '↓', Au: '↑', rest: '·', mute: '✕'
```

### STYLE_STRUMMING: Record mapping `styleId → StrummingPattern[]`. Each of the 13 styles has 2 patterns.

### Helper functions:
- `getStyleStrumming(styleId)` — returns patterns for a style, or `[]`
- `getCustomStrumPatterns()` — loads custom patterns from `localStorage` key `'fretmaster-custom-strum-patterns'`
- `saveCustomStrumPattern(pattern)` — adds/updates custom pattern
- `deleteCustomStrumPattern(id)` — removes by id
- `nextStrumType(current)` — cycles through `STRUM_CYCLE: ['D','Ad','U','Au','mute','rest']`

---

## 9. Progression Store — progressionStore.ts

File: `src/stores/progressionStore.ts`

**Plain Zustand store (NO persist middleware)**. Session state is ephemeral.

### State shape:

```typescript
interface ProgressionState {
  // Setup
  selectedKey: NoteName;
  selectedKeySignature: KeySignature;
  useFlats: boolean;
  selectedScale: ScaleDefinition;
  selectedPreset: ProgressionPreset | null;
  customDegrees: number[];
  useCustom: boolean;
  timerPerChord: ProgressionTimerDuration;  // 0 | 2 | 4 | 8

  // Saved progressions
  savedProgressions: SavedProgression[];

  // Practice state
  isPracticing: boolean;
  progressionChords: ProgressionChordInfo[];
  currentChordIndex: number;
  isRevealed: boolean;
  loopCount: number;

  // Actions...
}
```

### Initial values:
```typescript
selectedKey: 'C',
selectedKeySignature: KEY_SIGNATURES[0],  // C major
useFlats: false,
selectedScale: SCALES[0],                 // Major Scale
selectedPreset: COMMON_PROGRESSIONS[0],   // I-IV-V-I
customDegrees: [],
useCustom: false,
timerPerChord: 4,
savedProgressions: loadSavedProgressions(),  // from localStorage
isPracticing: false,
progressionChords: [],
currentChordIndex: 0,
isRevealed: false,
loopCount: 0,
```

### ProgressionChordInfo:
```typescript
export interface ProgressionChordInfo {
  roman: string;
  chordSymbol: string;
  quality: string;
  chordData: ChordData | null;    // from library lookup
  degreeIndex: number;
}
```

### Key actions:

**setKeySignature(ks)**: Sets `selectedKey: ks.noteName`, `selectedKeySignature: ks`, `useFlats: ks.useFlats`

**setPreset(preset)**: Sets `selectedPreset: preset`, `useCustom: false`

**toggleCustomDegree(degreeIdx)**: Appends degree to `customDegrees` array, sets `useCustom: true`, `selectedPreset: null`

**getResolvedChords()**: 
1. If `!useCustom && selectedPreset?.scaleId`, use that scale override
2. Resolve scale chords via `resolveScaleChords`
3. Map degrees to `ProgressionChordInfo` with library lookup via `findChordInLibrary`

**startProgression()**:
1. `getResolvedChords()` → `progressionChords`
2. Reset: `currentChordIndex: 0, isRevealed: false, isPracticing: true, loopCount: 0`

**nextChord()**: Increment index. If past end, wrap to 0 and increment `loopCount`

**prevChord()**: Decrement index. If below 0, wrap to last chord

**revealChord()**: Set `isRevealed: true`

**saveProgression(name)**: Creates `SavedProgression` with current key, scale, degrees. Persists to localStorage.

**loadSavedProgression(prog)**: Restores key, scale, degrees from saved. Sets `useCustom: true`.

---

## 10. findChordInLibrary — Library Lookup

```typescript
export function findChordInLibrary(chordSymbol: string, quality: string): ChordData | null
```

### Lookup strategy (in order):
1. **Exact match**: Find chord where `symbol === chordSymbol` AND type matches quality
2. **Enharmonic equivalents**: Try alternate spellings (C#↔Db, D#↔Eb, F#↔Gb, G#↔Ab, A#↔Bb)
3. **Fallback**: Any chord starting with the same root note and matching type

### Quality → ChordType mapping:
```typescript
function qualityToChordType(quality: string): ChordType[] {
  'maj' → ['major'], 'min' → ['minor'], 'dim' → ['diminished'],
  'aug' → ['augmented'], 'dom7' → ['dominant7'], 'maj7' → ['major7'],
  'min7' → ['minor7'], 'halfDim7' → ['halfDim7'], 'dim7' → ['dim7'],
  'sus4' → ['suspended']
}
```

### Library construction:
1. Get custom chords from `useCustomChordStore`
2. Build replaced ID set from custom chords with `sourceChordId`
3. Filter standard CHORDS to exclude replaced and hidden
4. Merge standard + converted custom chords
5. Search merged array

---

## 11. Saved Progressions — localStorage Persistence

```typescript
export interface SavedProgression {
  id: string;              // 'sp_{timestamp}_{randomId}'
  name: string;
  key: NoteName;
  scaleId: string;
  degrees: number[];
  createdAt: number;
}
```

### localStorage key: `'fretmaster-saved-progressions'`

### Functions:
- `loadSavedProgressions()` — reads and parses from localStorage, returns `[]` on error
- `persistSavedProgressions(items)` — JSON.stringify to localStorage
- New progressions are prepended to the array (most recent first)

---

## 12. Favorites System — localStorage Persistence

### localStorage key: `'fretmaster-favorite-progressions'`

Stores an array of preset IDs (strings). Managed via local component state + helper functions:

```typescript
function getStoredFavorites(): Set<string>    // read on mount
function persistFavorites(favs: Set<string>)  // write on change
```

### Toggle behavior:
```typescript
const handleToggleFavorite = (presetId: string) => {
  setFavorites(prev => {
    const next = new Set(prev);
    if (next.has(presetId)) next.delete(presetId);
    else next.add(presetId);
    persistFavorites(next);
    return next;
  });
};
```

---

## 13. ProgressionPractice Page — Complete Component

File: `src/pages/ProgressionPractice.tsx`

### Two-phase rendering:
```typescript
if (isPracticing && currentInfo) {
  return <PracticeView />;
}
return <SetupView />;
```

### Key local state:
- `showSaveDialog: boolean` — save progression name form
- `saveName: string` — input value
- `justSaved: boolean` — brief "Saved" confirmation
- `showSavedList: boolean` — browse saved progressions
- `progressionTab: 'common' | 'favorites' | 'style' | 'custom'`
- `favorites: Set<string>` — from localStorage
- `activeStyleId: string | null` — tracks which style was selected (for strumming)
- `showCalibration: boolean` — calibration wizard
- `showDiagrams: boolean` — from `getStoredShowDiagrams()`

### Hooks used:
- `useProgressionStore()` — all progression state
- `useMetronomeStore()` — metronome state
- `useDetectionSettingsStore()` — sensitivity settings
- `useChordDetection()` — microphone chord recognition
- `useSessionStats()` — session attempt tracking
- `useReferenceTone()` — reference tone playback
- `useChordAudio()` — chord playback synthesis
- `useNavigate()`, `useLocation()` — routing

---

## 14. Setup View — Page Header

```
[Music icon badge] "Chord Progressions"
"Practice Progressions" (gradient text)
"Choose a key, scale, and chord progression..."
```

- Badge: `rounded-full border border-primary/0.3 bg-primary/0.08 px-4 py-1.5`
- Title: `text-2xl sm:text-3xl md:text-4xl font-extrabold`
- `text-gradient` class on "Progressions"

---

## 15. Setup View — Key Selector Component

Internal component `KeySelector`:

### Trigger button:
- Full width, shows: `{display} Major` + sharp/flat count + ChevronDown
- Font: `text-xl sm:text-base font-display font-bold`

### Dropdown:
- `absolute z-20 mt-1 w-full rounded-lg max-h-[70vh] sm:max-h-[360px] overflow-y-auto`
- Each row shows: key display name (bold, min-w-[36px]) + sharp/flat count + individual note names
- Active row: primary bg/text with font-medium
- Inactive: subtle text with overlay hover
- Font sizes: `text-xl sm:text-base` for key name, `text-base sm:text-xs` for details

### Container card:
- Amber accent bar at top: `bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/30`
- `KeyRound` icon in amber-tinted rounded square
- `z-20` to overlap scale card dropdown

---

## 16. Setup View — Scale Selector Component

Internal component `ScaleSelector`:

### Trigger button:
- Shows current scale name + ChevronDown
- Same sizing as KeySelector

### Dropdown:
- Lists all 6 scales
- Active: primary bg/text
- Simple flat list (no grouping)

### Container card:
- Cyan accent bar: `bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500/30`
- `Waves` icon in cyan-tinted square
- `z-10` (below key selector)

---

## 17. Setup View — Scale Chords Preview

Internal component `ScaleChordsPreview`:

Shows all 7 scale degrees as tappable buttons:

```
  I       ii      iii     IV      V       vi      vii°
  C       Dm      Em      F       G       Am      Bdim
  [🔊]   [🔊]   [🔊]   [🔊]   [🔊]   [🔊]
```

### Each button:
- Rounded card with roman numeral, chord symbol, and Volume2 icon
- Tap triggers `playChord(chordData)` via `useChordAudio`
- Active state (after tap, 600ms): primary border/bg, scale-105, glow shadow
- Disabled if chord not in library (opacity-50, cursor-not-allowed)
- Size: `px-5 py-3 min-w-[64px] sm:min-w-[72px]`

### Header: `"Chords in {key} {scaleName}"`

---

## 18. Setup View — Progression Tab System

4-tab switcher with animated indicator:

```
[Common] [❤ Favorites (n)] [By Style] [Custom]
```

### Tab bar:
- Container: `flex items-center gap-1 rounded-lg bg-[hsl(var(--bg-surface))] p-1`
- Each tab: `flex-1 rounded-md px-2 py-3 sm:py-2 text-base sm:text-xs font-display font-bold`
- Active indicator: `motion.div` with `layoutId="progression-tab-indicator"` — spring animation `stiffness: 500, damping: 35`
- Active state: primary text over primary/0.15 bg with primary/0.4 border
- Inactive: muted text with default border on hover
- Favorites tab shows Heart icon (filled red if count > 0) and count badge

### Container card:
- Violet accent bar: `bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500/30`
- `ListMusic` icon in violet-tinted square

---

## 19. Setup View — Common Progressions Tab

Internal component `ProgressionPresetSelector`:

### Grid of preset buttons:
- `grid grid-cols-1 sm:grid-cols-2 gap-2`
- Shows first 6 by default, "Show all N progressions" toggle
- Each button shows: `romanDisplay` (text-lg sm:text-base) + resolved chord symbols (text-base sm:text-sm font-bold)
- Active: primary border/bg

### Custom builder section (inline):
- Header: "Or Build Custom" with Clear button
- Scale degree buttons: each shows Plus icon, roman, chord symbol
- Clicking appends degree to `customDegrees` and sets `useCustom: true`
- Sequence preview: shows selected chords in primary color joined by dashes

---

## 20. Setup View — Favorites Tab

Internal component `FavoritesSelector`:

### Empty state:
- Heart icon (size-8, very faded) + "No favorites yet" + hint text

### Populated state:
- Flat list of favorited presets with style metadata (emoji, style name, BPM range)
- Each item: preset button (same layout as style items) + heart unfavorite button
- Clicking a preset activates it AND auto-sets BPM (via `handleStylePresetSelect`)

---

## 21. Setup View — By Style Tab

Internal component `StyleProgressionSelector`:

### Accordion-style list:
- Each style category is a collapsible section
- Trigger: emoji + style name + count badge + BPM range + ChevronDown
- Active style (has selected preset): primary bg tint
- ChevronDown rotates 180° when expanded

### Expanded content (AnimatePresence):
- `height: 0→auto, opacity: 0→1, duration: 0.2s`
- Strumming pattern preview (if style has patterns)
- List of preset buttons with:
  - Name, roman display, resolved symbols
  - Heart favorite toggle (filled red if favorited)
- Active preset: primary border/bg

### Style selection behavior:
When a style preset is selected, `handleStylePresetSelect` also:
1. Sets metronome BPM to `style.bpmRange.default`
2. Tracks `activeStyleId` for strumming pattern display during practice

---

## 22. Setup View — Custom Builder Tab

Standalone tab content (not inside `ProgressionPresetSelector`):

- Same degree buttons as the inline custom builder in Common tab
- Header: "Build Your Own" with Clear button
- Scale degree grid + sequence preview
- Identical interaction behavior

---

## 23. Setup View — My Progressions (Save/Load)

### Container card:
- Rose accent bar: `bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500/30`
- `FolderOpen` icon in rose-tinted square
- Count badge

### Save flow:
1. "Save Current" button (only if `hasChords`) → opens inline form
2. Text input (autofocus, 160px width) + Check/X buttons
3. Enter saves, Escape cancels
4. Brief "Saved" confirmation with Check icon (1200ms)

### Browse saved list:
- Toggle button: "Browse" / "Hide" with ChevronDown
- Each saved progression shows:
  - Name (bold), key + scale + chord sequence
  - "Load" button → calls `loadSavedProgression` and closes list
  - Delete button (trash icon, appears on hover `opacity-0 group-hover:opacity-100`)

### Empty state: "No saved progressions yet" text

---

## 24. Setup View — Ready to Practice Summary + Start Button

### Container card:
- Brand/primary/emphasis gradient accent bar
- `Play` icon in primary-tinted square
- "Ready to Practice" header

### Summary rows:
```
Key          C
Scale        Major Scale
Progression  C – F – G – C
Chords       4
⚠ N chords not in library (if any)
```

### Start button:
- Full width, `py-4 text-lg font-bold uppercase tracking-wide`
- Gradient background: `from-brand via-primary to-emphasis`
- Shimmer effect on hover: translating white gradient overlay
- `glow-primary` shadow
- Disabled state: surface bg, muted text, no pointer
- Play icon scales up on hover

---

## 25. Practice View — Top Bar

```
[← Back]     [Key badge]  [Loop count]  [Diagram toggle]  [Mic toggle]  [Volume]
```

### Components:
- Back button: calls `handleBack()` — if session has attempts, shows summary; otherwise stops
- Key/scale badge: `hidden sm:flex`, shows `{key} {scaleName}`
- Loop counter: `Repeat` icon + bold primary count
- `ShowDiagramsToggle` component
- Mic toggle: green when listening, muted when off, pulse indicator dot
- `VolumeControl compact`

---

## 26. Practice View — Mic Status and Sensitivity

Three mutually exclusive states:

### Permission denied:
- Red banner with MicOff icon + explanation text

### Listening:
- Green banner with animated audio bars (5 bars, staggered `height: [4,12,4]` animation)
- "Listening — play the chord" text
- `SensitivitySlider` inline

### Not listening:
- Subtle banner: "Mic off" + `SensitivitySlider`

### SensitivitySlider component:
- `SlidersHorizontal` icon + "Mic Sensitivity" label
- Range input (1–10, step 1) using `volume-slider` CSS class
- Value display + label: "Strict" (≤3, info color), "Balanced" (4-7, primary color), "Sensitive" (≥8, success color)

---

## 27. Practice View — Detection Settings and Calibration

Row with two items:
1. `AdvancedDetectionSettingsPanel` (expandable)
2. Calibration button: `Crosshair` icon + "Calibrate" (hidden text on mobile)

### CalibrationWizard:
- Opens as modal overlay
- Auto-tunes detection parameters based on ambient noise and strumming

---

## 28. Practice View — Metronome Status Indicator

Only visible when `metronome.isPlaying`:

### Content:
- Beat number indicators (up to 12): current beat highlighted, accent beats extra-prominent
- BPM display
- Sync progress: beats remaining + progress bar (when `syncEnabled`)
- Auto-reveal eye icon (when `autoRevealBeforeAdvance`)

### Beat indicator styling:
- Current + accent: emphasis color, scale-125, drop-shadow
- Current + non-accent: primary color, scale-110
- Inactive: muted/0.3

### Progress bar:
- `w-14 h-1.5 rounded-full` with emphasis color fill

---

## 29. Practice View — Beat Sync Controls and Strumming

### BeatSyncControls component:
- Metronome play/pause, BPM, sync enable, beats-per-chord, etc.
- Full details in Practice Page Reconstruction Prompt

### StrummingPatternDisplay:
- Visible when: `(activeStyleId && styleHasPatterns) || customPatternsExist`
- Shows animated, compact strumming pattern

---

## 30. Practice View — Progression Timeline

Internal component `ProgressionTimeline`:

Horizontal scrollable row of chord chips:

```
[I: C] › [IV: F] › [V: G] › [I: C]
```

### Each chip:
- Roman numeral (small text) + chord symbol (bold)
- Current: primary border/bg, `scale-110`
- Past: success border/bg (green tint)
- Future: surface bg, subtle border
- Separator: `›` character, success color if past

### Container:
```
flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 px-1 scrollbar-none
```

---

## 31. Practice View — Main Practice Area

```
flex-1 flex flex-col items-center justify-center px-3 sm:px-6 pb-[140px] sm:pb-12
```

### Content (AnimatePresence mode="wait"):
- Keyed on `${chordSymbol}-${currentChordIndex}`
- Enter: `opacity 0→1, y 20→0`
- Exit: `opacity 1→0, y 0→-20`
- Duration: 0.3s

### Layout:
1. **Detection feedback** — `DetectionFeedback` component
2. **Current chord name** — roman numeral (primary, uppercase) + symbol (3xl-6xl font) + position counter
3. **Diagrams area** — conditional rendering based on `showDiagrams` and `isRevealed`

### Diagram states:
- **showDiagrams ON**: `ProgressionDiagramRow` showing all chords with current highlighted
- **showDiagrams OFF + not revealed**: Dashed border placeholder with `EyeOff` icon + hint text
- **showDiagrams OFF + revealed**: Single chord diagram in glowing container
- **Revealed but no chord data**: Warning card "No diagram available"

---

## 32. Practice View — Progression Diagram Row

Internal component `ProgressionDiagramRow`:

Horizontal scrollable row of all chord diagrams:

### Auto-scroll behavior:
```typescript
useLayoutEffect(() => {
  // Center current chord in viewport
  const scrollLeft = currentEl.offsetLeft - containerWidth/2 + elWidth/2;
  container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
}, [currentIndex]);
```

### Each chord card:
- `motion.div` with scale/opacity animation:
  - Current: `scale: 1.05, opacity: 1`
  - Past: `scale: 1, opacity: 0.55`
  - Future: `scale: 1, opacity: 0.7`
- Transition: `duration: 0.3, ease: [0.16, 1, 0.3, 1]`

### Card content:
1. Roman numeral label
2. Chord symbol
3. ChordDiagram (or CustomChordDiagram) — size "sm"
4. Current indicator: pulsing primary dot
5. Past indicator: green dot

### Missing chord:
- Dashed border placeholder: "Not in library"

### Container:
```
flex gap-2 sm:gap-3 overflow-x-auto pb-2 px-1 scrollbar-none sm:justify-center sm:flex-wrap
```

---

## 33. Practice View — Detection Feedback

Internal component `DetectionFeedback`:

### AnimatePresence wrapper:
- Key: `result` value
- Enter: `opacity 0→1, scale 0.5→1, y 6→0`
- Exit: `opacity 1→0, scale 1→0.7, y 0→-6`
- Transition: `duration: 0.3, ease: [0.16, 1, 0.3, 1]`

### Correct:
- `bg-[hsl(142_71%_45%/0.15)] border-[hsl(142_71%_45%/0.5)]`
- Green text with green glow `textShadow`
- Text: "Correct"

### Wrong:
- `bg-[hsl(0_84%_60%/0.15)] border-[hsl(0_84%_60%/0.5)]`
- Red text with red glow `textShadow`
- Text: "Wrong"

### Sizing: `min-h-[32px] sm:min-h-[40px]`, text `text-xl sm:text-2xl font-extrabold uppercase tracking-wider`

---

## 34. Practice View — Fixed Bottom Toolbar

```
fixed bottom-0 left-0 right-0 z-40
border-t border-default
bg-elevated/0.95 backdrop-blur-md
safe-area-bottom
```

### Button layout: `flex items-stretch gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 max-w-2xl mx-auto`

### Buttons (left to right):
1. **Previous** (SkipBack): `size-11 sm:size-12`, records attempt as skipped, resets beat counter
2. **Restart** (RotateCcw): `size-11 sm:size-12`, restarts session + progression
3. **History** (BarChart3): `size-11 sm:size-12`, navigates to `/history`
4. **Reveal / Play Again** (conditional):
   - Not revealed: "Reveal" button (Eye icon, primary/0.15 bg, flex-1)
   - Revealed: "Play Again" button (Volume2, surface bg, flex-1) + Reference Tone button (Headphones, emphasis accent)
5. **Next** (SkipForward): `px-3 sm:px-5`, primary gradient bg, `glow-primary`

### Reveal action:
- Calls `revealChord()` + plays chord audio

### Play Again action:
- Pauses detection for 2000ms + plays chord

### Reference Tone action:
- Pauses detection for 3000ms + plays reference tone (sustained per-string frequencies)

---

## 35. Practice View — Session Summary Integration

### Session tracking:
- `useSessionStats()` hook manages attempt recording
- `recordAttempt(chordSymbol, chordName, result)` called on:
  - Correct detection: `result: 'correct'`
  - Skip (Next button): `result: 'skipped'`

### Session end:
- Back button calls `session.endSession()` if attempts exist → shows `SessionSummary` modal
- Summary saves to `practiceHistoryStore` on mount (mode: `'progression'`)

### Confusion matrix:
- `handleWrongDetected(detectedSymbol)` records confusion pair via `practiceHistoryStore.recordConfusion`
- Uses current chord's symbol as expected, detected symbol from `identifyBestMatch`

---

## 36. Chord Detection Integration

### Hook usage:
```typescript
const { isListening, result, permissionDenied, toggleListening, stopListening, pauseDetection } =
  useChordDetection({
    onCorrect: handleDetectionCorrect,
    onWrongDetected: handleWrongDetected,
    targetChord: currentInfo?.chordData ?? undefined,
    sensitivity,
    autoStart: true,
    advancedSettings,
  });
```

### `handleDetectionCorrect`:
1. Record attempt as correct in session stats
2. If not revealed, reveal chord
3. Reset beat counter (`resetBeatCounter()`)
4. Advance to next chord (`nextChord()`)

### Target chord updates:
- When `currentChordIndex` changes, `getCurrentChord().chordData` updates
- `useChordDetection` resets result and cooldown on `targetChord` change

---

## 37. Metronome Beat-Sync Integration

### Two subscription effects:

**Chord advance** (`onChordAdvance`):
- When metronome sync fires, if practicing:
  1. Reveal if not revealed
  2. Advance to next chord

**Auto-reveal** (`onAutoReveal`):
- When auto-reveal fires (before advance), if practicing and not revealed:
  1. Reveal chord
  2. Play chord audio

### Beat counter reset:
- `resetBeatCounter()` called when chord advances (detection correct, manual next/prev, restart)

---

## 38. Style-to-BPM Auto-Set

When a style preset is selected (from either Style tab or Favorites tab):

```typescript
const handleStylePresetSelect = (preset) => {
  setPreset(preset);
  for (const style of STYLE_PROGRESSIONS) {
    if (style.progressions.some(p => p.id === preset.id)) {
      metronome.setBpm(style.bpmRange.default);
      setActiveStyleId(style.id);
      break;
    }
  }
};
```

This ensures:
1. Metronome BPM matches the genre's suggested tempo
2. `activeStyleId` is tracked for strumming pattern display during practice

---

## 39. CSS Design System

Same as Chord Library — all HSL custom properties. Key additions:

### Accent bar gradient per section:
- Key: `from-amber-500 via-amber-400 to-amber-500/30`
- Scale: `from-cyan-500 via-cyan-400 to-cyan-500/30`
- Progression: `from-violet-500 via-violet-400 to-violet-500/30`
- My Progressions: `from-rose-500 via-rose-400 to-rose-500/30`
- Start: `from-brand via-primary to-emphasis/0.3`

### Accent icon backgrounds:
- `bg-amber-500/15`, `bg-cyan-500/15`, `bg-violet-500/15`, `bg-rose-500/15`

### Tab indicator:
- `bg-primary/0.15 border-primary/0.4`

---

## 40. Animation Specifications

### Tab indicator:
- `layoutId="progression-tab-indicator"` — Framer Motion shared layout animation
- Spring: `stiffness: 500, damping: 35`

### Style accordion:
- `initial={{ height: 0, opacity: 0 }}`
- `animate={{ height: 'auto', opacity: 1 }}`
- Duration: 0.2s, ease: easeInOut

### Chord transition (practice view):
- `AnimatePresence mode="wait"`
- Enter: `opacity 0→1, y 20→0, duration: 0.3`
- Exit: `opacity 1→0, y 0→-20, duration: 0.3`

### Diagram reveal:
- Scale 0.7→1, opacity 0→1, ease: [0.16, 1, 0.3, 1], duration: 0.4

### Diagram row cards:
- `animate={{ scale, opacity }}`, transition: 0.3s with custom ease

### Detection feedback:
- Scale bounce: 0.5→1, y shift, duration: 0.3

### Listening audio bars:
- 5 bars, `height: [4, 12, 4]` animation, `duration: 0.8, repeat: Infinity, delay: i * 0.12`

---

## 41. Responsive Behavior

### Mobile (< 640px):
- Setup: single column, full-width cards
- Key/Scale selectors: `text-xl` font, `py-4` padding, `max-h-[70vh]` dropdowns
- Tabs: `text-base`, `py-3`
- Practice: smaller toolbar buttons (`size-11`), diagram row scrolls horizontally
- Metronome beats capped at 12 indicators
- Text "Reveal" shortened, "Play Again" hidden labels

### Desktop (≥ 640px):
- Setup: `grid grid-cols-1 lg:grid-cols-12` — left column 5 cols (key/scale), right 7 cols (progression/save/start)
- Dropdowns: `text-base`, `py-3`, `max-h-[360px]`
- Practice: larger toolbar (`size-12`), diagram row can wrap (`sm:flex-wrap sm:justify-center`)

### Toolbar:
- `max-w-2xl mx-auto` for centered content
- `gap-1.5 sm:gap-2`

---

## 42. localStorage Persistence Schema Summary

| Key | Type | Data Shape |
|-----|------|------------|
| `fretmaster-saved-progressions` | Manual | `SavedProgression[]` |
| `fretmaster-favorite-progressions` | Manual | `string[]` (preset IDs) |
| `fretmaster-custom-strum-patterns` | Manual | `StrummingPattern[]` |
| `fretmaster-detection-settings` | Zustand persist | `{ sensitivity, advancedEnabled, advancedValues }` |
| `fretmaster-metronome` | Zustand persist | `{ bpm, beatsPerMeasure, ... }` |
| `fretmaster-practice-history` | Zustand persist | `{ sessions, confusionMatrix }` |
| `fretmaster-show-diagrams` | Manual | `boolean` |

Note: The progression store itself is NOT persisted — setup state resets on page reload.

---

## 43. Integration Points with Other Pages

### Practice Landing (`/practice-landing`):
- Navigation to `/progression-practice` from the landing page

### Practice History (`/history`):
- BarChart3 button in toolbar navigates to history page
- Session data saved with `mode: 'progression'`

### Chord Editor (`/editor`):
- Not directly used but custom chords appear in library lookup

### Metronome Store:
- Shared across Practice and ProgressionPractice pages
- BPM auto-set from style progressions affects metronome globally

### Audio Stores:
- `audioStore` for volume (used by VolumeControl)
- `detectionSettingsStore` for sensitivity

---

## 44. Edge Cases and Error Handling

1. **Missing chords**: Chords not in library show "Not in library" placeholder in diagram row and warning card when revealed
2. **Scale override**: Some presets force a different scale via `scaleId` — `getResolvedChords` handles this transparently
3. **Custom degree sequence**: Can have duplicate degrees (same chord appears multiple times)
4. **Empty progression**: Start button disabled when `hasChords` is false
5. **Page navigation during practice**: Detects `location.key` change and stops listening + stops progression
6. **AudioContext suspended**: Resumes on startListening; skips analysis frames if not running
7. **Auto-start mic**: 400ms delay on mount to avoid race conditions
8. **Cleanup on unmount**: stopListening called, animation timers cleared
9. **Enharmonic chord lookup**: Tries C#↔Db etc. when exact match fails
10. **Looping**: After last chord, wraps to index 0 and increments `loopCount`
11. **Beat counter sync**: Reset on every chord change (detection, manual, metronome)
12. **Session end on back**: Only shows summary if there are recorded attempts

---

## 45. Verification Checklist

- [ ] Key selector shows all 15 key signatures in circle-of-fifths order
- [ ] Sharp keys display # symbols; flat keys display ♭ symbols
- [ ] Scale selector shows all 6 scales
- [ ] Scale chords preview resolves correctly for every key + scale combination
- [ ] Tapping a scale chord plays the correct audio
- [ ] Tab switcher animates with shared layout indicator
- [ ] Common progressions grid shows first 6 with "show all" toggle
- [ ] Selecting a preset highlights it and deselects custom
- [ ] Style progressions expand/collapse with animation
- [ ] Style presets auto-set metronome BPM
- [ ] Strumming pattern preview appears for styles with patterns
- [ ] Favorites persist to localStorage and restore on reload
- [ ] Heart toggle adds/removes from favorites
- [ ] Custom builder allows adding scale degrees to sequence
- [ ] Custom sequence shows chord symbols in preview row
- [ ] Save dialog creates named progression in localStorage
- [ ] Load restores key, scale, and custom degrees
- [ ] Delete removes saved progression
- [ ] Start button resolves all chords and enters practice mode
- [ ] Missing chords show warning count in summary
- [ ] Practice view shows correct progression timeline
- [ ] Current chord highlighted, past chords green-tinted
- [ ] Diagram row auto-scrolls to current chord on mobile
- [ ] Detection feedback shows "Correct" / "Wrong" with animations
- [ ] Correct detection advances to next chord
- [ ] Confusion matrix records wrong detections
- [ ] Reveal shows chord diagram (or warning if not in library)
- [ ] Play Again triggers chord audio with detection pause
- [ ] Reference tone plays sustained tones with detection pause
- [ ] Next/Prev advance/retreat with beat counter reset
- [ ] Restart resets progression to beginning
- [ ] Loop count increments when wrapping
- [ ] Metronome beat-sync advances chords when enabled
- [ ] Auto-reveal fires before metronome advance
- [ ] Session summary appears on back button
- [ ] Session data persists to practice history store
- [ ] Show/hide diagrams toggle works in practice view
- [ ] Sensitivity slider adjusts detection parameters
- [ ] Calibration wizard opens and applies settings
- [ ] Bottom toolbar is fixed with safe-area padding

---

## 46. Assumptions

1. **React Router**: App uses `BrowserRouter`. Routes `/progression-practice` and `/history` exist.
2. **Framer Motion**: Version 10+ with `AnimatePresence`, `motion`, and `layoutId`.
3. **Zustand**: Version 4+. Progression store uses plain Zustand (no persist).
4. **lucide-react**: All icons imported individually.
5. **sonner**: Toast library (used minimally in this page).
6. **Tailwind CSS**: v3.x with custom theme extending font-display (Sora) and font-body (DM Sans).
7. **CSS custom properties**: HSL triplets without `hsl()` wrapper, used as `hsl(var(--token))`.
8. **Mobile tab bar**: 56px fixed bottom. Practice toolbar sits above it.
9. **The CHORDS array, chord detection hook, metronome store, session stats hook, and all shared components** must be implemented per their respective reconstruction prompts.
10. **No backend**: All data stored in localStorage. No API calls.
11. **The `findChordInLibrary` function is critical** — it bridges scale theory (note names + quality) with the actual chord diagram library (symbol + type). Enharmonic fallback is essential for flat keys.
12. **Scale override in presets**: The `scaleId` field on `ProgressionPreset` forces chord resolution against a specific scale. This is used by style presets like "Minor Blues" which need natural minor degrees regardless of the user's selected scale.
13. **Auto-start microphone**: Detection starts automatically 400ms after entering practice mode with `autoStart: true`.
14. **Style BPM auto-set is immediate**: Selecting a style preset calls `metronome.setBpm(default)` synchronously.
