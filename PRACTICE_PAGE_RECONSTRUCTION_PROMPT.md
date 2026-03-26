# FretMaster Practice Page UI — Full Reconstruction Prompt

> **Purpose:** This prompt provides every detail needed to reconstruct the FretMaster Practice page UI **exactly** as it exists in the original web application. This covers the Practice Landing page, the single-chord Practice page (layout, detection feedback, sensitivity slider, metronome beat-sync controls, strumming pattern display, chord diagrams, tablature, volume control, show/hide diagrams toggle, calibration wizard, advanced detection settings, session summary, count-in overlay, and the fixed bottom toolbar), as well as all supporting hooks, stores, and components. Follow every specification precisely — do not simplify, optimize, refactor, or rename anything unless explicitly told to.

---

## TABLE OF CONTENTS

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Technology Stack & Dependencies](#2-technology-stack--dependencies)
3. [File Structure](#3-file-structure)
4. [Practice Landing Page](#4-practice-landing-page)
5. [Practice Store (Zustand)](#5-practice-store)
6. [Metronome Store (Zustand)](#6-metronome-store)
7. [Audio Store (Zustand)](#7-audio-store)
8. [Practice History Store](#8-practice-history-store)
9. [Detection Settings Store](#9-detection-settings-store)
10. [Chord Audio Playback (useChordAudio)](#10-chord-audio-playback)
11. [Reference Tone Generator (useReferenceTone)](#11-reference-tone-generator)
12. [Metronome Audio Engine (useMetronome)](#12-metronome-audio-engine)
13. [Countdown Timer (useCountdown)](#13-countdown-timer)
14. [Session Statistics (useSessionStats)](#14-session-statistics)
15. [Chord Diagram (SVG)](#15-chord-diagram)
16. [Chord Tablature](#16-chord-tablature)
17. [Custom Chord Diagram](#17-custom-chord-diagram)
18. [Detection Feedback Pill](#18-detection-feedback-pill)
19. [Sensitivity Slider](#19-sensitivity-slider)
20. [Show Diagrams Toggle](#20-show-diagrams-toggle)
21. [Volume Control](#21-volume-control)
22. [Advanced Detection Settings Panel](#22-advanced-detection-settings-panel)
23. [Beat Sync Controls](#23-beat-sync-controls)
24. [Count-In Visual Overlay](#24-count-in-visual-overlay)
25. [Strumming Pattern Display](#25-strumming-pattern-display)
26. [Countdown Ring](#26-countdown-ring)
27. [Timer Selector](#27-timer-selector)
28. [Calibration Wizard](#28-calibration-wizard)
29. [Session Summary Modal](#29-session-summary-modal)
30. [Confusion Matrix Component](#30-confusion-matrix-component)
31. [Practice Page — Complete Layout & Wiring](#31-practice-page-complete-layout)
32. [Fixed Bottom Toolbar](#32-fixed-bottom-toolbar)
33. [Strumming Pattern Data Model](#33-strumming-pattern-data-model)
34. [Design System (Colors, Typography, Tokens)](#34-design-system)
35. [Edge Cases & Behavioral Details](#35-edge-cases)
36. [Verification Checklist](#36-verification-checklist)

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

The Practice page is the primary interactive UI for FretMaster's chord study workflow. It:

- Presents randomized chords from a filtered library (by category, type, key, barre root, or preset)
- Displays SVG chord diagrams and tablature (toggleable show/hide)
- Integrates real-time microphone chord detection with animated feedback
- Provides a full metronome with beat-sync auto-advance, count-in, and strumming pattern visualization
- Offers chord audio playback (pluck synthesis) and reference tone playback
- Tracks session statistics (accuracy, timing) and confusion matrix data
- Supports a calibration wizard for auto-tuning detection parameters
- Has a fixed bottom toolbar with navigation, reveal, play, reference tone, and next chord buttons

### Architecture Pattern

- **State:** Zustand stores with localStorage persistence (practice filters, metronome settings, audio volume, detection settings, practice history)
- **Hooks:** Custom React hooks (`useChordDetection`, `useSessionStats`, `useChordAudio`, `useReferenceTone`, `useCountdown`, `useMetronome`)
- **Audio:** Raw Web Audio API for all synthesis (chord pluck, reference tone, metronome clicks/samples)
- **UI Framework:** React 18 + TypeScript + Tailwind CSS + Framer Motion + lucide-react
- **Routing:** React Router DOM 6.x (`/chord-practice` → landing, `/practice` → active practice)

---

## 2. TECHNOLOGY STACK & DEPENDENCIES

```
React 18.3.1
TypeScript 5.5.3
Vite 5.4.1
Tailwind CSS 3.4.11
Framer Motion (latest compatible with React 18)
Zustand (latest v4/v5 with persist middleware)
React Router DOM 6.x
lucide-react (latest)
sonner (toast notifications)
Google Fonts: Sora (display) + DM Sans (body)
```

---

## 3. FILE STRUCTURE

```
src/
├── pages/
│   ├── PracticeLanding.tsx        # Mode selection page (Chords vs Progressions)
│   ├── Practice.tsx               # Single chord practice page (main focus of this prompt)
│   └── PracticeHistory.tsx        # Analytics page
├── hooks/
│   ├── useChordDetection.ts       # Core mic detection (covered in Chord Detection prompt)
│   ├── useChordAudio.ts           # Synthesized chord pluck playback
│   ├── useReferenceTone.ts        # Synthesized reference tone
│   ├── useMetronome.ts            # Metronome audio engine (standalone hook version)
│   ├── useSessionStats.ts         # Session attempt tracking
│   ├── useCountdown.ts            # Timer countdown logic
│   └── useSwipeDown.ts            # Gesture hook (unused on Practice page)
├── stores/
│   ├── practiceStore.ts           # Practice state (filters, current chord, navigation)
│   ├── metronomeStore.ts          # Metronome Zustand store (beat-sync, count-in, samples)
│   ├── audioStore.ts              # Global volume/mute state
│   ├── detectionSettingsStore.ts  # Sensitivity and advanced detection overrides
│   ├── practiceHistoryStore.ts    # Session history, calibration profiles, confusion matrix
│   ├── presetStore.ts             # Filter presets (drag-and-drop)
│   └── customChordStore.ts        # Custom chord definitions
├── components/features/
│   ├── ChordDiagram.tsx           # SVG chord diagram renderer
│   ├── ChordTablature.tsx         # Text-based tablature display
│   ├── CustomChordDiagram.tsx     # SVG diagram for custom chords
│   ├── ShowDiagramsToggle.tsx     # Toggle button with pill indicator
│   ├── VolumeControl.tsx          # Volume slider + mute button
│   ├── BeatSyncControls.tsx       # Beat sync panel with count-in and Start/Stop
│   ├── StrummingPatternDisplay.tsx # Animated strumming pattern with editor
│   ├── CountdownRing.tsx          # Circular countdown SVG ring
│   ├── TimerSelector.tsx          # Timer duration selector (0/2/5/10s)
│   ├── CalibrationWizard.tsx      # 4-step calibration modal
│   ├── AdvancedDetectionSettings.tsx # Collapsible per-parameter sliders
│   ├── SessionSummary.tsx         # End-of-session overlay modal
│   └── ConfusionMatrix.tsx        # Chord confusion pair display
├── constants/
│   ├── chords.ts                  # CHORDS array (95+ ChordData entries)
│   ├── strumming.ts               # Strumming patterns per style + custom storage
│   └── config.ts                  # APP_CONFIG (name, timer options)
└── types/
    ├── chord.ts                   # ChordData, ChordType, ChordCategory, etc.
    └── customChord.ts             # CustomChordData types
```

---

## 4. PRACTICE LANDING PAGE

### Route: `/chord-practice`

A mode selection page with a hero section and two spotlight cards:

1. **Hero:** Background image with gradient overlay, "Choose Your Practice Mode" pill badge, "What Do You Want to Play Today?" heading
2. **Chords Card:** Links to `/chord-practice` setup → starts practice → navigates to `/practice`. Emerald accent color. Shows a mini G chord SVG diagram icon.
3. **Chord Progressions Card:** Links to `/progressions`. Violet accent color. Shows Roman numeral I-IV-V icon.

### SpotlightCard Effect

Each card has a mouse-tracking radial gradient spotlight using Framer Motion's `useMotionValue` + `useMotionTemplate`:

```typescript
const spotlight = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, hsl(var(--color-primary) / 0.12), transparent 70%)`;
```

Applied as a `pointer-events-none` overlay that fades in on hover.

---

## 5. PRACTICE STORE

### Key State

```typescript
interface PracticeState {
  categories: Set<ChordCategory>;      // 'open' | 'barre' | 'movable' | 'custom'
  chordTypes: Set<ChordType>;          // 15 chord types
  timerDuration: TimerDuration;        // 0 | 2 | 5 | 10 seconds
  barreRoots: Set<BarreRoot>;          // 6 | 5 | 4
  keyFilter: KeySignature | null;      // Major key filter via circle of fifths
  activePresetId: string | null;       // Selected preset overrides filters
  currentIndex: number;
  isRevealed: boolean;
  isPracticing: boolean;
  practiceChords: ChordData[];         // Shuffled filtered chord array
  totalPracticed: number;
}
```

### Key Behaviors

- **startPractice():** Filters `CHORDS` by active categories/types/roots/key (or preset), shuffles, sets `isPracticing = true`
- **nextChord():** Increments index; if past end, reshuffles the entire array and resets to index 0
- **prevChord():** Decrements index (minimum 0)
- **revealChord():** Sets `isRevealed = true`
- **Persisted to localStorage** (`fretmaster-practice-filters`): categories (as array), chordTypes (as array), barreRoots, keyFilter, timerDuration, activePresetId. Sets are serialized as arrays and deserialized back to Sets via `merge` function.

### Effective Chords

Before filtering, the store merges:
1. Standard chords from `CHORDS` (excluding those replaced by custom chords)
2. Custom chords from `customChordStore` (converted to `ChordData` format)

### Key Filter Logic

When a key (e.g., C Major) is selected, only chords whose root note belongs to the major scale of that key are included. Uses `[0, 2, 4, 5, 7, 9, 11]` interval pattern.

---

## 6. METRONOME STORE

### Zustand Store (`metronomeStore.ts`)

This is the **primary** metronome implementation used on the Practice page. It's a module-scoped Zustand store with its own audio engine (not the `useMetronome` hook).

### State

```typescript
interface MetronomeStore {
  isPlaying: boolean;
  bpm: number;                    // 30–260, stored in localStorage
  beatsPerMeasure: number;        // 2, 3, 4, 6, or 12
  currentBeat: number;            // 0-indexed current beat
  soundType: MetronomeSoundType;  // 'click' | 'woodblock' | 'hihat' | 'sidestick' | 'voice'
  volume: number;                 // 0–1, exponential curve: v^1.2 * 7
  beatsPerChord: number;          // 1–32, how many beats/measures before auto-advance
  syncEnabled: boolean;           // Whether beat-sync auto-advance is active
  syncUnit: 'beats' | 'measures'; // Count beats or measures for advancing
  autoRevealBeforeAdvance: boolean; // Reveal chord 2 beats before advancing
  beatsUntilAdvance: number;      // Countdown for UI display
  isCountingIn: boolean;          // Whether in count-in phase
  countInBeat: number;            // 1-based current count-in beat
  countInTotal: number;           // Total count-in beats
  countInMeasures: number;        // 1, 2, or 4 measures of count-in
}
```

### Event System

Module-scoped callback sets for cross-component communication:

```typescript
onBeat(listener: (beat, measure) => void): () => void
onChordAdvance(listener: () => void): () => void
onAutoReveal(listener: () => void): () => void
onCountInComplete(listener: () => void): () => void
```

The Practice page subscribes to `onChordAdvance` and `onAutoReveal` via `useEffect` to auto-advance chords.

### Audio Engine

The metronome store has its **own module-scoped AudioContext** (not shared with chord detection). It uses a lookahead scheduler running at 25ms intervals with 100ms lookahead buffer.

### Sound Types

5 metronome sounds, each with accent/normal variants:

1. **Click:** Layered synthesis — sine ping (1000/1500Hz) + triangle snap (2400/3200Hz) + noise burst
2. **Wood Block:** Real samples from AVL Drum Kit (`studiorack/avl-percussions`), pitched down 2 semitones, with highpass + presence + air EQ. Falls back to synthesis.
3. **Hi-Hat:** Real samples from The Open Source Drum Kit (`crabacus/the-open-source-drumkit`), with highpass + presence + air EQ. Falls back to synthesis.
4. **Sidestick:** Real samples from same drum kit. Falls back to synthesis.
5. **Voice Count:** Real speech samples from Wikimedia Commons (Lingua Libre "Back ache" speaker), numbers 1–12. Trimmed, onset-compensated (per-word manual offsets), EQ'd (highpass + presence + de-ess), with playback rate compression for multi-syllable words and anti-click gain ramping.

### Sample Loading

All samples are loaded on first play (`start()`) and cached in module-scoped variables. A `preloadMetronomeSamples()` function can be called on first user interaction.

### Beat-Sync Logic

```
On each beat:
  beatsSinceChordChange++
  totalBeats = syncUnit === 'measures' ? beatsPerChord * beatsPerMeasure : beatsPerChord
  remaining = totalBeats - beatsSinceChordChange
  
  if autoRevealBeforeAdvance && remaining === min(2, totalBeats-1):
    notifyAutoReveal()
  
  if beatsSinceChordChange >= totalBeats:
    beatsSinceChordChange = 0
    notifyChordAdvance()
```

### Count-In Logic

When `startCountIn()` is called:
1. `syncEnabled` is set to `true` if not already
2. Total count-in beats = `countInMeasures * beatsPerMeasure`
3. Metronome starts (or resets timing if already playing)
4. Count-in beats are consumed first (they do NOT advance chords)
5. After last count-in beat, 500ms delay shows "START" overlay, then resets to normal play

### `resetBeatCounter()`

Exported function that resets `beatsSinceChordChange = 0` and updates `beatsUntilAdvance`. Called when the user manually advances (Next/Prev/Restart).

---

## 7. AUDIO STORE

```typescript
interface AudioStore {
  volume: number;        // 0–1
  muted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  getEffectiveVolume: () => number;  // Returns 0 when muted
}
```

Persisted to localStorage as `fretmaster-audio` (JSON). Default volume: 0.7.

Used by `useChordAudio` for chord playback volume.

---

## 8. PRACTICE HISTORY STORE

```typescript
interface PracticeHistoryState {
  sessions: PracticeSession[];         // Last 200 sessions
  calibrationProfiles: CalibrationProfile[];
  confusionMatrix: ConfusionEntry[];   // { expected, detected, count }
  addSession: (session) => void;
  clearHistory: () => void;
  addCalibrationProfile: (profile) => void;
  deleteCalibrationProfile: (id) => void;
  recordConfusion: (expected, detected) => void;  // Increments or creates
  clearConfusionMatrix: () => void;
}
```

Persisted to localStorage as `fretmaster-practice-history` (version 2, with merge for backwards compatibility).

---

## 9. DETECTION SETTINGS STORE

```typescript
interface DetectionSettingsState {
  sensitivity: number;                    // 1–10 (main slider)
  advancedEnabled: boolean;
  advancedValues: { noiseGate: number; harmonicBoost: number; fluxTolerance: number; }; // Each 0–100
  applyCalibrationProfile: (profile) => void;  // Sets advancedEnabled=true + values
}
```

Persisted as `fretmaster-detection-settings` (version 1).

---

## 10. CHORD AUDIO PLAYBACK (useChordAudio)

### Synthesis Architecture

For each non-muted string:
1. Compute frequency: `STRING_FREQUENCIES[i] * SEMITONE_RATIO^fret`
2. Create **3 oscillators** per string:
   - Primary: `triangle` wave at fundamental frequency
   - Harmonic: `sine` at 2× frequency (8% volume)
   - Sub: `sine` at 0.5× frequency (12% volume)
3. Envelope per string:
   - Attack: linear ramp to volume in 8ms
   - Decay: exponential to 18% in 120ms
   - Sustain-to-silence: exponential to 0.001 over 2.5s
4. Low-pass filter per string: starts at `min(freq*6, 5000)`, decays to `min(freq*2, 2000)`
5. **Strum timing:** 35ms delay between strings (low E → high E)
6. **Volume per string:** `0.3 - stringIndex * 0.015` (bass strings slightly louder)
7. **Master gain:** `volume^1.2 * 8` (exponential curve for perceived loudness)

### API

```typescript
function useChordAudio(): {
  playChord: (chord: ChordData) => void;
  stopCurrent: () => void;
}
```

---

## 11. REFERENCE TONE GENERATOR (useReferenceTone)

### Synthesis

For each non-muted string:
- Primary oscillator: `triangle` at fundamental
- 2nd harmonic: `sine` at 2× (15% amplitude)
- Stagger: 15ms per string
- Per-string gain: `min(0.9, 1.2 / activeStringCount)`
- Detuning: `(stringIndex - 2.5) * 1.2 cents`
- Envelope: fast attack (40ms), sustain at 60% after 40% of duration, fade to silence
- Default duration: 2.5 seconds
- Master gain: 0.18

### API

```typescript
function useReferenceTone(): {
  playChordTone: (chord: ChordData, duration?: number) => void;
  stopTone: () => void;
  isPlaying: MutableRefObject<boolean>;
}
```

---

## 12. METRONOME AUDIO ENGINE (useMetronome)

The `useMetronome.ts` hook is a **standalone** metronome implementation (separate from the Zustand store). It's used by the `StrummingPatternDisplay` component for pattern preview audio.

Key differences from the store version:
- Uses React `useState` instead of Zustand
- Returns `MetronomeState` interface for local component use
- Same sound synthesis code (click, woodblock, hi-hat, sidestick, voice)
- Same sample loading infrastructure
- Same lookahead scheduler pattern (25ms intervals, 100ms lookahead)

---

## 13. COUNTDOWN TIMER (useCountdown)

```typescript
function useCountdown({ duration, onComplete }): {
  timeLeft: number;       // Seconds remaining (float)
  isRunning: boolean;
  progress: number;       // 0–1 (timeLeft / duration)
  start: () => void;
  stop: () => void;
  reset: () => void;
}
```

Uses `Date.now()` elapsed time calculation (not frame-based), updating at 50ms intervals.

---

## 14. SESSION STATISTICS (useSessionStats)

Tracks per-session attempts with timing:

```typescript
interface SessionAttempt {
  chordSymbol: string;
  chordName: string;
  result: 'correct' | 'skipped';
  timeMs: number;          // Time from chord presentation to result
  timestamp: number;       // Date.now()
}
```

Summary computes: accuracy %, avg response time (correct only), fastest, slowest, total duration.

---

## 15. CHORD DIAGRAM (SVG)

### Rendering Specs

| Size | Width | Height | Dot Radius | Font Size |
|------|-------|--------|------------|-----------|
| sm | 100 | 130 | 7 | 14 |
| md | 140 | 175 | 9.5 | 18 |
| lg | 200 | 250 | 13 | 24 |

### Features

- **Nut:** Solid white bar when `baseFret === 1`, thick line otherwise
- **Fret position label:** Shows `{baseFret}fr` when baseFret > 1
- **String thickness:** Graduated `[2.6, 2.2, 1.8, 1.4, 1.0, 0.7]` (low E → high E)
- **Fret dot inlays:** At frets 3, 5, 7, 9, 15, 17, 19, 21 (single dot); 12, 24 (double dot)
- **Open strings:** Circles above the nut
- **Muted strings:** X marks above the nut
- **Finger dots:** Solid circles with finger number text
- **Root note indicator:** Diamond shape (`<polygon>`) instead of circle, with a light blue CSS class
- **Barre indicators:** Horizontal rounded rectangle connecting barre strings, with individual dots at each contact point
- **Barre rendering deduplication:** Strings rendered by barre section are tracked in a Set and skipped by the individual dot section

### CSS Classes Used

```
.chord-fret    — fret line color
.chord-dot     — finger dot fill
.chord-dot-text — finger number text on dots
.chord-open    — open string circle stroke
.chord-muted   — muted string X stroke
.chord-barre   — barre rectangle fill
.chord-root    — root diamond fill (light blue)
.chord-root-text — text on root diamonds
```

---

## 16. CHORD TABLATURE

A monospace text representation showing each string with fret numbers:

```
e --0--
B --1--
G --0--
D --2--
A --3--
E --x--
```

- Reversed display order: high e on top, low E on bottom
- Muted strings show `x` in lighter color
- Available in sm/md/lg sizes with different text/gap configurations
- White background with neutral-200 border (stands out against dark app background)

---

## 17. CUSTOM CHORD DIAGRAM

Similar to standard `ChordDiagram` but renders `CustomChordData` which has:
- `markers[]` with per-marker color, shape (`circle` | `diamond`), label, finger
- `barres[]` with fromString, toString, fret, color
- `mutedStrings` and `openStrings` as Sets
- `openDiamonds` Set for diamond-shaped open string indicators
- Variable `numFrets` (height scales proportionally)

Uses inline HSL colors (not CSS classes) since custom chords have user-defined colors.

---

## 18. DETECTION FEEDBACK PILL

Animated pill shown above the chord name:

```typescript
<AnimatePresence>
  {result && (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: -6 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="px-5 py-1.5 sm:px-7 sm:py-2 rounded-2xl backdrop-blur-md border-2 ...">
        <span className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-wider ...">
          {result === 'correct' ? 'Correct' : 'Wrong'}
        </span>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- **Correct:** Green bg (`142 71% 45% / 0.15`), green border (`0.5`), green text with green glow text-shadow
- **Wrong:** Red bg (`0 84% 60% / 0.15`), red border (`0.5`), red text with red glow text-shadow
- Container has `min-h-[32px] sm:min-h-[40px]` to prevent layout shift when empty
- `pointer-events-none` so it doesn't block interaction

---

## 19. SENSITIVITY SLIDER

Inline component in the listening status bar:

- Range input: 1–10, step 1
- Label: 1–3 = "Strict" (blue/info color), 4–7 = "Balanced" (amber/primary), 8–10 = "Sensitive" (green/success)
- Current value badge with matching color
- Uses `volume-slider` CSS class for styled range input
- Max width: `max-w-[120px]` on the slider itself

---

## 20. SHOW DIAGRAMS TOGGLE

Button with toggle pill indicator:

- **Enabled:** Green border/bg, Eye icon, "Chord Diagram On" text, green pill slider (right position)
- **Disabled:** Default border, EyeOff icon, "Chord Diagram Off" text, muted pill slider (left position)
- Persisted to localStorage key `fretmaster-show-diagrams`
- Active scale animation: `active:scale-95`
- Pill dimensions: `w-8 h-[18px]` with `w-[14px] h-[14px]` inner circle

---

## 21. VOLUME CONTROL

Compact mode (used on Practice page) shows:
- Mute/unmute button (VolumeX/Volume1/Volume2 icons)
- Range slider `0–1` with step 0.01
- No percentage label in compact mode

Uses `useAudioStore` for global volume state.

---

## 22. ADVANCED DETECTION SETTINGS PANEL

Collapsible panel with three parameter sliders:

1. **Noise Gate** (Shield icon, amber-400) — 0–100
2. **Harmonic Sensitivity** (Waves icon, cyan-400) — 0–100
3. **Flux Tolerance** (Zap icon, violet-400) — 0–100

Features:
- Enable/disable toggle (overrides main sensitivity slider when enabled)
- Reset button restores defaults (50, 50, 50)
- "Active" badge when enabled
- Animated expand/collapse via Framer Motion

---

## 23. BEAT SYNC CONTROLS

A comprehensive panel with:

### Header Row
- Link2/Link2Off icon + "Beat Sync" label + summary badge ("Every 4 beats")
- **Start/Stop button** (always visible): Play/Square icon, toggles count-in or stops

### Expanded Controls
- **Sync unit toggle:** Beats vs Measures (toggle buttons)
- **Count control:** "Advance every N beats/measures" with +/- buttons (range 1–32)
- **Auto-reveal toggle:** "Auto-reveal before advancing" with toggle switch
- **Count-in length:** 1 bar / 2 bars / 4 bars (toggle buttons)
- **Summary text:** Human-readable description of current settings

### Count-In Visual Overlay

When count-in is active, a fullscreen overlay shows:
- Beat numbers (1, 2, 3, 4) in **gigantic red text** (10rem/14rem) with red glow text-shadow
- "START" in **gigantic green text** (8xl/9xl) with green glow on the last beat
- `AnimatePresence mode="wait"` for smooth transitions between numbers
- Dimmed backdrop: `bg-[hsl(var(--bg-base)/0.4)]`
- `pointer-events-none` so user can still interact beneath

---

## 24. COUNT-IN VISUAL OVERLAY

(Integrated into BeatSyncControls — see Section 23)

---

## 25. STRUMMING PATTERN DISPLAY

### Pattern Data Model

```typescript
type StrumType = 'D' | 'U' | 'Ad' | 'Au' | 'rest' | 'mute';

interface StrummingPattern {
  id: string;
  name: string;
  description: string;
  subdivisions: number;  // 2=8ths, 3=triplets, 4=16ths
  beats: number;         // Pattern length in beats
  pattern: StrumType[];  // Length = beats × subdivisions
}
```

### 13 Pre-built Patterns

Organized by style: blues (2), jazz (2), pop (2), rock (2), country (2), reggae (2), hip-hop (2), R&B (2), latin (2), funk (2), neo-soul (2), bluegrass (2), folk (2).

### Custom Pattern Editor

Users can create custom patterns with:
- Name input
- Feel selector: 8ths / Triplets / 16ths
- Beats selector: 2 / 3 / 4
- Tap-to-cycle grid: D → Ad → U → Au → mute → rest (cycle)
- Preview button (plays at current BPM)
- Save/Cancel actions

Custom patterns persisted to localStorage key `fretmaster-custom-strum-patterns`.

### Visualization

Each beat shown as a column of strum arrows:
- **Down arrows:** Downward SVG arrow, accent = thicker + emphasis color
- **Up arrows:** Upward SVG arrow, accent = thicker + emphasis color
- **Mute:** ✕ symbol in muted bg
- **Rest:** · dot, very faint
- **Active beat highlight:** Ring + scale animation + glow drop-shadow
- Beat number labels above each group

### Pattern Audio Preview

Uses dedicated `AudioContext` per preview (separate from metronome). Schedules noise bursts through bandpass + peaking EQ for each non-rest action:
- Down: bandpass 280Hz, peaking 180Hz
- Up: bandpass 420Hz, peaking 250Hz
- Accent: louder (0.7 vs 0.45), wider body EQ
- Mute: bandpass 900Hz, shorter duration (18ms)

### Real-Time Sync

When metronome is playing, the display animates via `requestAnimationFrame`:
- Subscribes to `onBeat()` events for timing reference
- Interpolates sub-beat position using `performance.now()`
- Active sub-index updates at frame rate for smooth tracking

---

## 26. COUNTDOWN RING

SVG circular progress ring for the reveal timer:

```typescript
<CountdownRing progress={0-1} timeLeft={seconds} size={160} />
```

- Track circle: `countdown-track` CSS class
- Progress circle: `countdown-progress` CSS class with `strokeDasharray`/`strokeDashoffset`
- Center: Large seconds number + "seconds" label
- Drop shadow glow on the progress arc

---

## 27. TIMER SELECTOR

Timer duration picker on the practice setup page:

- "No Timer" button with TimerOff icon (full width)
- 2s / 5s / 10s buttons in a row (equal width)
- Active state: primary color border + bg + glow
- From `APP_CONFIG.timerOptions = [2, 5, 10]`

---

## 28. CALIBRATION WIZARD

4-step modal overlay:

### Step 1: Intro
- Mic icon, "Auto-Tune Detection Settings" heading
- Steps: 1. Measure silence, 2. Strum guitar, 3. Review/save
- Saved profiles list (if any) with Load/Delete buttons
- "Start Calibration" CTA

### Step 2: Silence Measurement (3 seconds)
- Countdown circle showing seconds remaining
- "Stay quiet..." instruction
- Measures: average RMS of noise floor
- Animated waveform indicator

### Step 3: Strum Measurement (5 seconds)
- Green accent (vs amber for silence)
- "Keep strumming different chords..."
- Measures: average RMS, spectral crest, spectral flux

### Step 4: Results
- Success checkmark
- Grid showing Noise Floor and Signal Level (in mRMS)
- Three colored result bars:
  - Noise Gate (amber)
  - Harmonic Sensitivity (cyan)
  - Flux Tolerance (violet)
- "Apply Now" / "Save Profile" buttons
- Save profile requires name input

### Calculation

```
SNR = signalRms / noiseFloorRms
noiseGate = map(SNR, [0,5,10,20,∞] → [30,45,60,75,90])
harmonicBoost = map(crest, [<3,3-4,4-6,>6] → [75,65,55,40])
fluxTolerance = map(flux, [<1,1-2,2-3,>3] → [30,40,50,65])
```

Results are applied globally via `detectionSettingsStore.applyCalibrationProfile()`.

---

## 29. SESSION SUMMARY MODAL

Full-screen overlay shown when the user exits practice with attempts:

### Header
- Trophy icon, "Session Summary", total duration (e.g., "2m 35s")

### Stats Grid (2×2)
1. **Accuracy** (green): `XX%` — Target icon
2. **Avg Time** (primary): `X.Xs` — Clock icon
3. **Fastest** (emphasis): `Xms` — Zap icon
4. **Attempts** (neutral): `correct / skipped` — TrendingUp icon

### Attempt Log
Scrollable list of all attempts:
- Rank number
- CheckCircle (correct, green) or SkipForward (skipped, muted) icon
- Chord symbol
- Response time

### Footer
- "Done" button (full-width primary CTA)

### Auto-save
On mount (if attempts exist), saves session to `practiceHistoryStore.addSession()` with a `savedRef` guard preventing double-saves.

---

## 30. CONFUSION MATRIX COMPONENT

Displays chord confusion pairs from `practiceHistoryStore.confusionMatrix`:

### Data Processing
- Combines directional pairs (A→B and B→A) into bidirectional pairs
- Sorts by total count descending
- Shows top 8 by default, expandable

### Severity Coloring
| Total | Level | Background | Border | Text |
|-------|-------|-----------|--------|------|
| ≥ 10 | High | error/0.1 | error/0.25 | error |
| ≥ 5 | Medium | emphasis/0.08 | emphasis/0.2 | emphasis |
| < 5 | Low | surface/0.5 | border-subtle | text-subtle |

### Each Row
- Background bar (width proportional to count)
- Rank number
- "A ↔ B" with GitCompareArrows icon
- Direction breakdown: "A→B: 5 | B→A: 3"
- Total badge: "8×"

### Clear
Two-step confirmation: "Clear" → "Clear all? [Yes] [No]"

---

## 31. PRACTICE PAGE — COMPLETE LAYOUT & WIRING

### Layout Structure (top to bottom)

1. **Top Bar:** Back button + filter labels + ShowDiagramsToggle + Mic toggle + VolumeControl
2. **Permission Denied Banner** (conditional): Red warning with MicOff icon
3. **Listening Status Bar** (conditional on mic state):
   - Listening: Green bg, animated waveform, "Listening — play the chord", SensitivitySlider
   - Not listening: Neutral bg, "Mic off", SensitivitySlider
4. **Advanced Detection Settings + Calibrate Button** (horizontal flex)
5. **Metronome Status Indicator** (conditional on metronome playing): Beat numbers with active highlight, BPM, sync countdown, progress bar
6. **Beat Sync Controls** (always shown)
7. **Main Practice Area** (flex-1 center): DetectionFeedback + Chord Symbol + Chord Name + Diagram/Tablature (or hidden state)
8. **Fixed Bottom Toolbar** (fixed, always visible)

### Hook Wiring

```typescript
// Detection
const { isListening, result, permissionDenied, toggleListening, stopListening, pauseDetection } =
  useChordDetection({
    onCorrect: handleDetectionCorrect,
    onWrongDetected: handleWrongDetected,
    targetChord: chord,
    sensitivity,
    autoStart: true,
    advancedSettings,
  });

// When correct: record attempt → reveal → reset beats → next chord
// When wrong detected: record confusion pair to practiceHistoryStore

// Metronome subscriptions
onChordAdvance(() => { reveal; next; });
onAutoReveal(() => { reveal; play chord audio; });
```

### Detection Pause

`pauseDetection(ms)` is called before playing audio to prevent speaker→mic feedback:
- Play chord audio: `pauseDetection(2000)`
- Play reference tone: `pauseDetection(3000)`

### Back/Exit Flow

1. If `session.attempts.length > 0`: show SessionSummary
2. On summary close: stop listening → stop practice → navigate to `/chord-practice`
3. If no attempts: stop listening → stop practice → navigate directly

---

## 32. FIXED BOTTOM TOOLBAR

Fixed to bottom of viewport, above mobile tab bar:

```
[Prev] [Restart] [History] [Reveal/PlayAgain] [RefTone?] [Next]
```

### Layout

```
fixed bottom-0 left-0 right-0 z-40
border-t bg-elevated/0.95 backdrop-blur-md safe-area-bottom
flex items-stretch gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 max-w-2xl mx-auto
```

### Buttons

1. **Prev** (SkipBack): `size-11 sm:size-12` square, secondary style
2. **Restart** (RotateCcw): Same size, secondary style. Resets beat counter + session + filters.
3. **History** (BarChart3): Same size, navigates to `/history`
4. **Reveal** (Eye): `flex-1`, primary-tinted. Shows when `!isRevealed`
5. **Play Again** (Volume2): `flex-1`, secondary style. Shows when `isRevealed`
6. **Reference Tone** (Headphones): `size-11 sm:size-12`, emphasis-tinted. Shows when `isRevealed`
7. **Next** (SkipForward): Primary CTA with label on desktop, icon-only on mobile

All buttons: `min-h-[44px] sm:min-h-[48px]`, `active:scale-95` or `active:scale-[0.97]`, `rounded-xl`

---

## 33. STRUMMING PATTERN DATA MODEL

### Pre-built Styles

13 music styles, each with 2 patterns:

| Style | Pattern 1 | Pattern 2 |
|-------|-----------|-----------|
| Blues | Shuffle (triplets) | Slow Blues (8ths) |
| Jazz | Comping (swing) | Charleston |
| Pop | Eighth Notes | Island Pop |
| Rock | Power (downstrokes) | Rock 8ths |
| Country | Boom-Chicka (16ths) | Train Beat |
| Reggae | Skank (offbeat) | One Drop |
| Hip-Hop | Muted Groove (16ths) | Lo-fi Strum |
| R&B | Smooth 16ths | Ballad |
| Latin | Bossa Nova (16ths) | Son Clave |
| Funk | 16th Notes | Scratch |
| Neo Soul | Groove (16ths) | Ballad |
| Bluegrass | Boom-Chuck | Flatpick Drive |
| Folk | Folk Strum | Fingerstyle |

### Custom Pattern Storage

```typescript
const CUSTOM_STRUM_KEY = 'fretmaster-custom-strum-patterns';
getCustomStrumPatterns(): StrummingPattern[]
saveCustomStrumPattern(pattern): void
deleteCustomStrumPattern(id): void
```

### Strum Type Cycle (Editor)

`D → Ad → U → Au → mute → rest → D → ...`

---

## 34. DESIGN SYSTEM

### Color Tokens (HSL, used via `hsl(var(--token))`)

```css
--color-primary: 38 75% 52%;
--color-brand: 30 62% 44%;
--color-emphasis: 43 83% 65%;
--text-default: 36 33% 93%;
--text-subtle: 33 14% 72%;
--text-muted: 30 7% 47%;
--bg-base: 30 25% 4%;
--bg-elevated: 28 20% 8%;
--bg-overlay: 28 17% 11%;
--bg-surface: 28 14% 15%;
--border-default: 28 12% 21%;
--border-subtle: 28 10% 16%;
--semantic-success: 142 71% 45%;
--semantic-warning: 43 96% 56%;
--semantic-error: 0 84% 60%;
--semantic-info: 217 91% 60%;
```

### Typography

- `font-display` = Sora (headings, labels, buttons, badges)
- `font-body` = DM Sans (body text, descriptions)

### Key Component Styles

- **Primary CTA:** `bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]` with `glow-primary` class
- **Secondary button:** `border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))]`
- **Status badges:** Semantic color + 0.08-0.15 alpha bg + matching text
- **Cards/panels:** `rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm`
- **Stage gradient:** `.stage-gradient` class on page containers

### Responsive Breakpoints

- Mobile: default (< 640px) — compact spacing, smaller text, icon-only where possible
- Tablet+: `sm:` prefix — larger padding, visible labels, wider controls

---

## 35. EDGE CASES & BEHAVIORAL DETAILS

1. **No chord available:** Practice page returns `null` if `getCurrentChord()` returns null
2. **Redirect on not practicing:** `useEffect` navigates to `/chord-practice` if `!isPracticing`
3. **Cleanup on unmount:** `stopListening()` called via `useEffect` cleanup
4. **Chord change animation:** `AnimatePresence mode="wait"` with `key={chord.id}-${currentIndex}` triggers enter/exit
5. **Diagram hidden state:** Shows dashed-border placeholder with EyeOff icon and "Diagram hidden" / "Play by ear or toggle diagrams on" text
6. **Custom vs standard chord rendering:** `(chord as any).isCustom` check switches between `ChordDiagram` and `CustomChordDiagram`
7. **Reshuffle at end:** When `currentIndex >= practiceChords.length`, the entire array is reshuffled (Fisher-Yates) and index resets to 0
8. **Beat counter reset:** `resetBeatCounter()` called on Next, Prev, and Restart to prevent desync
9. **Session save guard:** `savedRef` prevents double-saving when SessionSummary mounts
10. **Type aliasing:** `AdvancedDetectionSettings` type is imported from the hook but the component file re-exports it for convenience

---

## 36. VERIFICATION CHECKLIST

### Practice Flow
- [ ] Filter selection persists across sessions (localStorage)
- [ ] Chords shuffle on start and reshuffle when exhausted
- [ ] Reveal shows diagram + plays chord audio
- [ ] Detection auto-starts on page load
- [ ] "Correct" feedback appears after ~210ms sustained match
- [ ] "Wrong" feedback appears after ~140ms sustained mismatch
- [ ] Confusion matrix records wrong detections
- [ ] Session stats track correct/skipped with timing
- [ ] Session summary shows on exit with attempts
- [ ] Back button without attempts navigates directly

### Metronome & Beat Sync
- [ ] Start/Stop button toggles count-in → metronome
- [ ] Count-in overlay shows beat numbers then "START"
- [ ] After count-in, chord auto-advances at configured interval
- [ ] Auto-reveal fires 2 beats before advance (when enabled)
- [ ] Beat indicator shows active beat with accent styling
- [ ] Countdown bar shows progress toward next advance
- [ ] resetBeatCounter() called on manual advance
- [ ] 5 sound types work (click, woodblock, hi-hat, sidestick, voice)
- [ ] Volume slider applies exponential curve

### UI Components
- [ ] ChordDiagram renders nut, strings, dots, barres, root diamonds
- [ ] ChordTablature shows reversed string order (high e on top)
- [ ] ShowDiagramsToggle persists to localStorage
- [ ] VolumeControl compact mode shows slider without percentage
- [ ] Sensitivity slider shows 1–10 with Strict/Balanced/Sensitive labels
- [ ] Advanced settings panel collapses/expands smoothly
- [ ] Calibrate button opens wizard modal
- [ ] Calibration wizard measures silence (3s) then strum (5s)
- [ ] Calibration results can be saved as named profiles

### Strumming Patterns
- [ ] Pattern display shows beat-grouped strum arrows
- [ ] Active sub-beat highlights in real-time when metronome plays
- [ ] Pattern selector dropdown shows style + custom patterns
- [ ] Preview button plays pattern at current BPM
- [ ] Custom pattern editor allows creating/editing/deleting patterns
- [ ] Custom patterns persist to localStorage

### Fixed Bottom Toolbar
- [ ] All 7 buttons present with correct icons
- [ ] Reveal button swaps to Play Again + Reference Tone after reveal
- [ ] Next button records current chord as "skipped"
- [ ] Detection pauses during chord/reference playback
- [ ] All buttons meet 44px minimum touch target
- [ ] Toolbar stays fixed with backdrop blur

### Mobile Responsiveness
- [ ] Body text ≥ 16px
- [ ] Tap targets ≥ 44×44px
- [ ] Bottom toolbar has safe-area-bottom padding
- [ ] Filter labels hidden on mobile, visible on desktop
- [ ] Compact spacing and smaller sizes below 640px

---

## ASSUMPTIONS

1. The target project uses React + TypeScript + Tailwind CSS + Zustand + Framer Motion + lucide-react + sonner.
2. A chord library (`CHORDS` array) exists with the `ChordData` interface.
3. The `useChordDetection` hook exists (covered in the Chord Detection Reconstruction Prompt).
4. The Web Audio API is available (web browser).
5. The Tailwind CSS custom property system (`hsl(var(--token))`) is replicated with the design tokens from Section 34.
6. Routes are configured: `/chord-practice` → PracticeLanding, `/practice` → Practice, `/progressions` → ProgressionPractice, `/history` → PracticeHistory.
7. All metronome sample URLs (Wikimedia Commons, GitHub) are publicly accessible.
