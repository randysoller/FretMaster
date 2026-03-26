# FretMaster Guitar Tuner — Full Reconstruction Prompt

> **Purpose:** This prompt provides every detail needed to reconstruct the FretMaster chromatic guitar tuner **exactly** as it exists in the original web application. Follow every specification precisely — do not simplify, optimize, refactor, or rename anything unless explicitly told to.

---

## TABLE OF CONTENTS

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Technology Stack & Dependencies](#2-technology-stack--dependencies)
3. [Design System (Colors, Typography, Tokens)](#3-design-system)
4. [File Structure](#4-file-structure)
5. [State Management (Zustand Stores)](#5-state-management)
6. [Audio Pipeline & Pitch Detection Algorithm](#6-audio-pipeline--pitch-detection)
7. [Tuner UI Component — Full Specification](#7-tuner-ui-component)
8. [Calibration Wizard — Full Specification](#8-calibration-wizard)
9. [Layout Integration (AppLayout, MobileTabBar, Header)](#9-layout-integration)
10. [CSS & Tailwind Configuration](#10-css--tailwind-configuration)
11. [Edge Cases & Behavioral Details](#11-edge-cases--behavioral-details)
12. [Verification Checklist](#12-verification-checklist)

---

## 1. PROJECT OVERVIEW & ARCHITECTURE

**FretMaster** is a guitar practice application. The **Tuner** is a full-screen overlay panel (not a routed page) that opens from the bottom tab bar and covers the entire viewport. It provides:

- Real-time chromatic pitch detection via microphone using NSDF (Normalized Square Difference Function)
- Median-filter outlier rejection for stable readings
- Confidence-weighted frequency smoothing
- 7 guitar tuning presets (Standard, Half-Step Down, Drop D, Open G, Open D, Open E, DADGAD)
- Per-string selection with auto-detect mode
- Reference tone playback (synthesized guitar-like sound via Web Audio API oscillators + noise + filters)
- Segmented 41-bar cents meter with color-coded flat/in-tune/sharp display
- "In Tune" confirmation with cowbell chime sound after 500ms sustained accuracy (±5 cents)
- Mic sensitivity slider synced with global calibration settings
- Integration with a Calibration Wizard that auto-tunes detection parameters
- Mobile-first responsive design with a fixed bottom tab bar (56px)

### Architecture Pattern

- **State:** Zustand stores (no Redux, no Context for state)
- **Routing:** React Router DOM v6, but the Tuner is NOT a route — it renders via `AnimatePresence` inside `AppLayout` based on `useTunerStore().isOpen`
- **Styling:** Tailwind CSS v3.4 with HSL CSS custom properties. All colors use `hsl(var(--token))` syntax
- **Animations:** Framer Motion (`motion`, `AnimatePresence`)
- **Icons:** lucide-react
- **Audio:** Raw Web Audio API (no libraries)

---

## 2. TECHNOLOGY STACK & DEPENDENCIES

```
React 18.3.1
TypeScript 5.5.3
Vite 5.4.1
Tailwind CSS 3.4.11
Framer Motion (latest compatible with React 18)
Zustand (latest v4/v5)
React Router DOM 6.x
lucide-react (latest)
sonner (toast notifications)
tailwindcss-animate plugin
Google Fonts: Sora (display) + DM Sans (body)
```

---

## 3. DESIGN SYSTEM

### 3.1 CSS Custom Properties (HSL format, defined in `:root`)

```css
:root {
  /* Brand */
  --color-primary: 38 75% 52%;       /* Amber gold — primary CTAs, active states */
  --color-brand: 30 62% 44%;         /* Darker amber — hover states */
  --color-emphasis: 43 83% 65%;      /* Light gold — highlights, calibration accent */

  /* Text */
  --text-default: 36 33% 93%;        /* Near-white warm */
  --text-subtle: 33 14% 72%;         /* Medium gray warm */
  --text-muted: 30 7% 47%;           /* Dim gray warm */

  /* Backgrounds */
  --bg-base: 30 25% 4%;              /* Near-black warm */
  --bg-elevated: 28 20% 8%;          /* Cards, panels */
  --bg-overlay: 28 17% 11%;          /* Hover states */
  --bg-surface: 28 14% 15%;          /* Input fields, chips */

  /* Borders */
  --border-default: 28 12% 21%;
  --border-subtle: 28 10% 16%;

  /* Semantic */
  --semantic-success: 142 71% 45%;   /* Green — in tune */
  --semantic-warning: 43 96% 56%;    /* Yellow-amber */
  --semantic-error: 0 84% 60%;       /* Red */
  --semantic-info: 217 91% 60%;      /* Blue */
}
```

### 3.2 Typography

- **Display font:** `Sora` — headings, labels, buttons. Weights: 300–800.
- **Body font:** `DM Sans` — body text, descriptions, values. Weights: 300–700.
- Tailwind classes: `font-display` = Sora, `font-body` = DM Sans.

### 3.3 Usage Pattern

All component colors reference tokens via `hsl(var(--token))` syntax in Tailwind arbitrary values:
```
text-[hsl(var(--text-default))]
bg-[hsl(var(--bg-elevated)/0.6)]
border-[hsl(var(--color-primary)/0.3)]
```

### 3.4 Utility Classes (defined in `@layer utilities`)

```css
.text-gradient {
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(135deg, hsl(var(--color-emphasis)), hsl(var(--color-primary)), hsl(var(--color-brand)));
}

.stage-gradient {
  background: radial-gradient(ellipse at 50% 0%, hsl(var(--color-primary) / 0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 50%, hsl(var(--color-brand) / 0.05) 0%, transparent 50%),
              hsl(var(--bg-base));
}
```

---

## 4. FILE STRUCTURE

```
src/
├── pages/
│   └── Tuner.tsx                    # Full tuner panel component (default export: TunerPanel)
├── stores/
│   ├── tunerStore.ts                # Zustand store: { isOpen, open, close, toggle }
│   ├── detectionSettingsStore.ts    # Global detection settings (sensitivity, advanced calibration values)
│   ├── practiceHistoryStore.ts      # Calibration profiles persistence (CalibrationProfile type)
│   └── audioStore.ts                # Volume/mute settings (not directly used by tuner but part of ecosystem)
├── components/
│   ├── features/
│   │   └── CalibrationWizard.tsx    # Modal wizard: silence → strum → results → save
│   └── layout/
│       ├── AppLayout.tsx            # Renders <AnimatePresence>{tunerOpen && <TunerPanel />}</AnimatePresence>
│       └── MobileTabBar.tsx         # Bottom tab bar with tuner toggle button (tuning fork SVG icon)
├── hooks/
│   └── useChordDetection.ts         # Chord detection hook (NOT used by tuner directly, but shares NSDF algorithm pattern)
└── index.css                        # Global styles with CSS custom properties
```

---

## 5. STATE MANAGEMENT

### 5.1 tunerStore.ts

```typescript
import { create } from 'zustand';

interface TunerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useTunerStore = create<TunerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
```

- No persistence. Tuner starts closed on every page load.
- `toggle()` is called from MobileTabBar's tuner button.

### 5.2 detectionSettingsStore.ts

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdvancedDetectionValues {
  noiseGate: number;       // 0-100
  harmonicBoost: number;   // 0-100
  fluxTolerance: number;   // 0-100
}

const DEFAULTS: AdvancedDetectionValues = {
  noiseGate: 50,
  harmonicBoost: 50,
  fluxTolerance: 50,
};

interface DetectionSettingsState {
  sensitivity: number;
  advancedEnabled: boolean;
  advancedValues: AdvancedDetectionValues;
  setSensitivity: (v: number) => void;
  setAdvancedEnabled: (v: boolean) => void;
  setAdvancedValues: (v: AdvancedDetectionValues) => void;
  updateAdvancedValue: (key: keyof AdvancedDetectionValues, val: number) => void;
  resetAdvanced: () => void;
  applyCalibrationProfile: (profile: AdvancedDetectionValues) => void;
}

export const useDetectionSettingsStore = create<DetectionSettingsState>()(
  persist(
    (set) => ({
      sensitivity: 6,
      advancedEnabled: false,
      advancedValues: DEFAULTS,
      setSensitivity: (v) => set({ sensitivity: v }),
      setAdvancedEnabled: (v) => set({ advancedEnabled: v }),
      setAdvancedValues: (v) => set({ advancedValues: v }),
      updateAdvancedValue: (key, val) =>
        set((state) => ({
          advancedValues: { ...state.advancedValues, [key]: val },
        })),
      resetAdvanced: () => set({ advancedValues: DEFAULTS }),
      applyCalibrationProfile: (profile) =>
        set({ advancedValues: profile, advancedEnabled: true }),
    }),
    {
      name: 'fretmaster-detection-settings',
      version: 1,
    }
  )
);
```

- Persisted to localStorage under key `fretmaster-detection-settings`.
- `applyCalibrationProfile` sets `advancedEnabled: true` and stores calibration values.
- The tuner reads `advancedEnabled` and `advancedValues.noiseGate` to sync its mic sensitivity slider.

### 5.3 practiceHistoryStore.ts (Calibration Profiles portion)

The store also manages `calibrationProfiles: CalibrationProfile[]` with these actions:
- `addCalibrationProfile(profile)` — adds with auto-generated ID
- `deleteCalibrationProfile(id)` — removes by ID

```typescript
export interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: number;
  noiseGate: number;
  harmonicBoost: number;
  fluxTolerance: number;
  noiseFloorRms: number;
  signalRms: number;
}
```

Persisted under localStorage key `fretmaster-practice-history` with version 2.

---

## 6. AUDIO PIPELINE & PITCH DETECTION

### 6.1 Microphone Audio Chain

When the tuner starts listening, it creates this exact audio processing chain:

```
getUserMedia({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 } })
  → MediaStreamSource
  → High-pass filter (type: 'highpass', freq: 50Hz, Q: 0.71)
  → Notch filter #1 (type: 'notch', freq: 50Hz, Q: 12)  — removes 50Hz mains hum
  → Notch filter #2 (type: 'notch', freq: 60Hz, Q: 12)  — removes 60Hz mains hum
  → Peaking EQ (type: 'peaking', freq: 200Hz, Q: 0.5, gain: +3dB)  — boosts guitar fundamental range
  → Low-pass filter (type: 'lowpass', freq: 4000Hz, Q: 0.5)  — reduces high-frequency noise
  → AnalyserNode (fftSize: 8192, smoothingTimeConstant: 0)
```

### 6.2 NSDF Pitch Detection Algorithm (`autoCorrelate` function)

The algorithm is called every animation frame via `requestAnimationFrame`.

**Input:** Float32Array time-domain buffer from analyser, sample rate
**Output:** `{ frequency: number, confidence: number }` or `null`

**Steps:**

1. **Sub-window:** Use `min(buffer.length, 4096)` centered samples
2. **RMS gate:** Compute RMS over the sub-window. If below threshold, return null. Threshold is calculated as:
   ```
   rmsThreshold = 0.05 * Math.pow(0.02, sensitivity / 100)
   ```
   where `sensitivity` is the slider value (0–100). This is stored on `globalThis.__tunerRmsThreshold`.
3. **Hanning window:** Apply `w[i] = 0.5 * (1 - cos(2πi/(N-1)))` to the sub-window
4. **NSDF computation:** For lag τ from `floor(sampleRate/1500)` to `ceil(sampleRate/55)`:
   ```
   nsdf[τ] = 2 * Σ(windowed[i] * windowed[i+τ]) / Σ(windowed[i]² + windowed[i+τ]²)
   ```
5. **Peak picking:**
   - Find first zero crossing after minLag
   - Collect all positive-region peaks with value ≥ 0.2
   - Select first peak above threshold 0.42 (fundamental, not harmonic)
   - Fallback: strongest peak overall if none above threshold
   - Reject if best value < 0.25
6. **Parabolic interpolation:** Refine τ with:
   ```
   refinedτ = τ + (nsdf[τ-1] - nsdf[τ+1]) / (2 * (2*nsdf[τ] - nsdf[τ-1] - nsdf[τ+1]))
   ```
7. **Frequency:** `sampleRate / refinedτ`. Reject if outside 55–1400 Hz range.

### 6.3 Outlier Rejection (Median Filter)

Maintains a rolling buffer of the last 5 frequency readings (`FREQ_HISTORY_SIZE = 5`).

Before adding a new reading:
1. If history has ≥ 3 entries, compute median
2. Compute `ratio = newFreq / median`
3. **Reject** (skip the frame entirely) if:
   - `ratio > 1.28 OR ratio < 0.78` AND `confidence < 0.7` (more than ~4 semitones off)
   - `ratio ≈ 2.0 (1.9–2.1) OR ratio ≈ 0.5 (0.48–0.52)` AND `confidence < 0.75` (likely octave error)

### 6.4 Confidence-Weighted Smoothing

After passing outlier rejection, the raw frequency is smoothed against the previous smoothed value:

- **Very close** (ratio 0.96–1.04): `alpha = 0.15 + 0.15 * confidence` → heavy smoothing
- **Moderate change** (ratio 0.92–1.08): `alpha = 0.3 + 0.2 * confidence` → medium smoothing
- **Large change** (new note):
  - If `confidence > 0.55`: snap directly to new frequency, reset history
  - Else: `alpha = 0.6` (weighted toward new)

Formula: `smoothed = prev * (1 - alpha) + raw * alpha`

### 6.5 Note Detection

```typescript
function frequencyToNoteInfo(freq: number): { note: string; octave: number; cents: number; noteIndex: number } {
  const semitoneOffset = 12 * Math.log2(freq / 440);
  const roundedSemitone = Math.round(semitoneOffset);
  const cents = Math.round((semitoneOffset - roundedSemitone) * 100);
  const rawIndex = roundedSemitone + 9;
  const noteIndex = ((rawIndex % 12) + 12) % 12;
  const octave = Math.floor((roundedSemitone + 9) / 12) + 4;
  return { note: NOTE_STRINGS[noteIndex], octave, cents, noteIndex };
}
```

`NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']`

### 6.6 Closest String Detection

```typescript
function findClosestString(freq: number, strings: GuitarString[]): GuitarString | null {
  // Find string with minimum cent distance
  // Returns null if closest is > 400 cents away
  // Uses: 1200 * Math.log2(freq / string.freq)
}
```

### 6.7 Display Hold Timer

When pitch detection returns null (silence), the displayed note/frequency/closest-string is NOT immediately cleared. A `holdTimer` of **400ms** keeps the last reading visible. This prevents flickering during brief silences between playing.

When the hold timer fires:
- Clear `displayNote`, `displayFreq`, `displayClosest`
- Reset `smoothedFreq` to null
- Clear frequency and confidence history buffers

### 6.8 In-Tune Confirmation

When `|centsFromTarget| ≤ 5`:
- Start a timer (`inTuneStartRef`)
- After **500ms** sustained in-tune: play cowbell chime, set `inTuneConfirmed = true`

When `|centsFromTarget| > 12`:
- Reset the timer and chime-played flag

---

## 7. TUNER UI COMPONENT (TunerPanel)

### 7.1 Component Structure

```
<CalibrationWizard />  (modal, rendered outside main panel)
<motion.div>  (full-screen overlay, fixed positioning)
  └── Scrollable content area (.stage-gradient background)
      ├── Header section
      │   ├── Close button (top-left, X icon)
      │   ├── "Guitar Tuner" pill badge
      │   ├── "Tune Your Guitar" heading (with .text-gradient on "Guitar")
      │   ├── Tuning preset dropdown
      │   └── Instruction text
      ├── Main tuner card
      │   ├── Detected note display (huge text, color-coded)
      │   ├── Frequency readout (Hz)
      │   ├── Target string info
      │   ├── 41-segment cents meter
      │   ├── Cents value with flat/sharp labels
      │   ├── Status text ("In Tune ✓" / "Tune up ↑" / "Tune down ↓")
      │   ├── Mic sensitivity slider
      │   └── Calibration shortcut button
      └── String selector card
          ├── "Auto-Detect" button
          └── 6 string buttons (each shows: string gauge, string number, note, cents offset)
```

### 7.2 Animation

The panel uses Framer Motion:
```typescript
initial={{ opacity: 0, y: 80 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: 80 }}
transition={{ type: 'spring', stiffness: 400, damping: 30 }}
```

### 7.3 Positioning

```css
.fixed .inset-x-0 .top-0 .bottom-[56px] (mobile: leaves room for tab bar)
sm:bottom-0 (desktop: full height)
z-40
```

### 7.4 Tuning Presets

7 presets defined as `TuningPreset[]`:

| Name | Label | Strings (low→high) |
|------|-------|---------------------|
| standard | Standard | E2(82.41) A2(110) D3(146.83) G3(196) B3(246.94) E4(329.63) |
| half-step-down | ½ Step Down | Eb2(77.78) Ab2(103.83) Db3(138.59) Gb3(185) Bb3(233.08) Eb4(311.13) |
| drop-d | Drop D | D2(73.42) A2(110) D3(146.83) G3(196) B3(246.94) E4(329.63) |
| open-g | Open G | D2(73.42) G2(98) D3(146.83) G3(196) B3(246.94) D4(293.66) |
| open-d | Open D | D2(73.42) A2(110) D3(146.83) F#3(185) A3(220) D4(293.66) |
| open-e | Open E | E2(82.41) B2(123.47) E3(164.81) G#3(207.65) B3(246.94) E4(329.63) |
| dadgad | DADGAD | D2(73.42) A2(110) D3(146.83) G3(196) A3(220) D4(293.66) |

### 7.5 Cents Meter

41 vertical bars, each representing 2.5 cents. Index 20 is center (0 cents).

```
segCents = (i - 20) * 2.5
```

**Color rules** (by absolute cents from center):
- ≤ 5 cents: green `142 71% 45%`
- ≤ 15 cents: yellow `45 93% 47%`
- > 15 cents: red `0 72% 51%`

**Lit/unlit logic:**
- Center bar lights if `|currentCents| < 2.5` OR `|currentCents| ≤ 5`
- Positive segments light if `currentCents > 0` AND `segCents > 0` AND `segCents ≤ currentCents + 1.25`
- Negative segments light if `currentCents < 0` AND `segCents < 0` AND `segCents ≥ currentCents - 1.25`

**Bar dimensions:**
- Center bar: width 6px, height 84px
- ≤ 5 cents: width 4px, height 68px
- ≤ 15 cents: width 4px, height 60px
- > 15 cents: width 4px, height 52px

**Lit bars** get a glow shadow: `0 0 8px hsl(color / 0.5), 0 0 2px hsl(color / 0.3)`

### 7.6 Note Display Colors

Based on cents from target:
- No signal: `text-[hsl(var(--text-muted)/0.25)]`, shows "—"
- In tune (≤ 5c): `text-[hsl(142_71%_45%)]` (green)
- Close (≤ 15c): `text-[hsl(45_93%_47%)]` (yellow)
- Far (> 15c): `text-[rgb(220,38,38)]` (red)

An animated green ring (`border-[3px] border-[hsl(142_71%_45%)]`, 140×140px) appears when `|centsFromTarget| ≤ 2`.

### 7.7 String Selector Buttons

6 buttons in a flex row. Each shows:

1. **String gauge line** — a horizontal div representing physical string thickness:
   - Heights: `[0, 2, 2.5, 3, 5, 6, 7][string]` (index by string number)
   - Wound strings (≥ 4): `repeating-linear-gradient(90deg, ...)` simulating wound texture
   - Plain strings (< 4): smooth `linear-gradient(180deg, ...)`
   - Active/in-tune: green gradient with glow
   - Selected: amber gradient

2. **"String N"** label (12px mobile, 18px desktop)
3. **Note name** (22px mobile, 28px desktop) — color-coded by tuning accuracy
4. **Cents offset** (12px mobile, 18px desktop) — shows "✓" when in tune, "+Nc" or "-Nc" otherwise

**States:**
- Active (selected) + in-tune: green background + border + shadow glow
- Active (selected): amber background + border
- Detected (auto-detect matched): lighter amber background
- Default: surface background, transparent border

Clicking a string: selects it (or deselects if already selected) AND plays the reference tone.

### 7.8 Reference Tone Synthesis

Each reference tone creates a fresh `AudioContext` and synthesizes a guitar-like sound with:

**Audio graph:**
```
10 harmonic oscillators → bodyLow EQ → bodyMid EQ → bodyHigh EQ → lowPass → masterGain → compressor → destination
Pluck noise burst → bandpass → pluckGain → masterGain
Thump oscillator → thumpGain → masterGain
Buzz noise → highpass → buzzGain → masterGain
```

**Harmonics (10 partials):**
```
h=1: amp=1.00, decay=0.38, type='triangle'
h=2: amp=0.72, decay=0.32, type='triangle'
h=3: amp=0.50, decay=0.26, type='triangle'
h=4: amp=0.38, decay=0.22, type='sine'
h=5: amp=0.25, decay=0.18, type='sine'
h=6: amp=0.18, decay=0.14, type='sine'
h=7: amp=0.10, decay=0.11, type='sine'
h=8: amp=0.06, decay=0.09, type='sine'
h=9: amp=0.03, decay=0.07, type='sine'
h=10: amp=0.015, decay=0.06, type='sine'
```

- Each partial has slight inharmonicity: `partialFreq * (1 + 0.00005 * h * h)`
- Attack: 0→amp in 1ms, then decay to 50% at 2ms, then exponential decay
- Skip partials above 10kHz
- Duration: 3.0 seconds
- Total signal: plays for 2.2s visual indicator, AudioContext closes at 3.5s

**Pluck transient:**
- 35ms noise buffer with envelope `(1 - i/len)²`
- Bandpass at `min(freq * 4, 5000)Hz`, Q=1.8
- Gain: 0.55 → 0.001 in 60ms

**Body thump:**
- Sine oscillator: starts at `freq * 0.5`, sweeps down to `freq * 0.25` over 80ms
- Gain: 0.25 → 0.001 in 100ms

**Fret buzz:**
- 8ms noise buffer
- Highpass at 3000Hz
- Gain: 0.2 → 0.001 in 20ms

**Compressor settings:** threshold=-12, knee=6, ratio=4, attack=0.002, release=0.15

**EQ chain:**
- bodyLow: peaking, 120Hz, Q=2.5, gain=+6dB
- bodyMid: peaking, 400Hz, Q=1.2, gain=+3dB
- bodyHigh: peaking, 2800Hz, Q=1.0, gain=-4dB
- airRoll: lowpass, 6000Hz, Q=0.7

### 7.9 Cowbell "In-Tune" Chime

Triggered after 500ms sustained in-tune (±5 cents). Uses a separate persistent AudioContext (`chimeCtxRef`).

**Audio graph:**
```
4 sine oscillators → highpass(800Hz) → highshelf(3000Hz, +4dB) → masterGain → destination
Noise transient → bandpass(4000Hz) → transientGain → highpass chain
```

**Partials:**
```
1568Hz: amp=0.40, decay=0.45
2350Hz: amp=0.25, decay=0.32
3136Hz: amp=0.15, decay=0.22
4700Hz: amp=0.06, decay=0.14
```

**Master gain:** 0.5, decay over 1.4s. Noise transient: 6ms at 0.12 amplitude.

### 7.10 Mic Sensitivity Slider

- Range: 0–100, step 1
- Persisted to `localStorage` key `tuner-mic-sensitivity`, default 60
- If global `advancedEnabled` is true, initializes from and syncs with `globalSettings.advancedValues.noiseGate`
- RMS threshold formula: `0.05 * Math.pow(0.02, sensitivity / 100)`
- When calibrated, shows a "⚡ Calibrated" badge

### 7.11 Auto-Start Behavior

- When `isOpen` transitions to true, auto-starts microphone listening
- When `isOpen` transitions to false, stops listening and cleans up all audio resources
- Uses a `startedRef` to prevent double-starts

---

## 8. CALIBRATION WIZARD

### 8.1 Overview

A modal dialog with 4 steps: Intro → Silence Measurement → Strum Measurement → Results/Save.

### 8.2 Steps

**Step 1: Intro**
- Explains the process (3 numbered steps)
- Shows saved calibration profiles (if any) with Load/Delete buttons
- "Start Calibration" button advances to step 2

**Step 2: Silence Measurement (3 seconds)**
- Opens mic with: `echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: { ideal: 48000 }`
- Audio chain: `source → highpass(70Hz, Q=0.71) → AnalyserNode(fftSize=8192, smoothing=0.6)`
- Measures RMS every 80ms for 3 seconds
- Shows countdown and animated bars
- Computes average noise floor RMS, stores it

**Step 3: Strum Measurement (5 seconds)**
- Same mic setup
- Measures RMS, spectral crest factor, and spectral flux every 80ms for 5 seconds
- Crest factor: peak/mean ratio of linear magnitudes in 70–2500Hz range
- Flux: average positive dB change per bin between frames, in 70–2500Hz range

**Step 4: Results**
- Computes optimized settings from measurements:
  ```
  SNR = signalRms / noiseFloorRms
  noiseGate: clamp(15-90, SNR>20→75, SNR>10→60, SNR>5→45, else→30)
  harmonicBoost: clamp(20-85, crest>6→40, crest>4→55, crest>3→65, else→75)
  fluxTolerance: clamp(20-80, flux>3→65, flux>2→50, flux>1→40, else→30)
  ```
- Shows noise floor and signal level in mRMS
- Shows three settings with color-coded rows (amber/cyan/violet)
- Two buttons: "Apply Now" (applies without saving) or "Save Profile" (prompts for name, then saves + applies)

### 8.3 Profile Persistence

Profiles are stored in `practiceHistoryStore.calibrationProfiles` array, persisted to localStorage.

### 8.4 Global Application

`applyCalibrationProfile()` on `detectionSettingsStore` sets `advancedEnabled: true` and stores the values. This affects:
- The tuner's mic sensitivity slider (syncs to `noiseGate` value)
- All chord practice pages (via `useChordDetection` hook which reads global settings)

---

## 9. LAYOUT INTEGRATION

### 9.1 AppLayout.tsx

The tuner panel is rendered inside `AppLayout` as a sibling to the main content area:

```tsx
<div className="flex min-h-screen flex-col bg-[hsl(var(--bg-base))]">
  <Header />
  <main className="flex-1 pb-[56px] sm:pb-0">
    <Outlet />
  </main>
  <MobileTabBar />
  <AnimatePresence>
    {tunerOpen && <TunerPanel />}
  </AnimatePresence>
</div>
```

### 9.2 MobileTabBar.tsx

5-column grid, 56px height. The tuner is the 4th column:

```
[Practice] [Metronome] [Lessons] [Tuner] [Library]
```

The tuner button uses a custom SVG tuning fork icon:
```svg
<svg viewBox="0 0 24 24">
  <path d="M9 2v8a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2" />
  <line x1="12" y1="13" x2="12" y2="22" />
</svg>
```

When tuner is open: amber text color + active indicator bar at top. Clicking other tabs closes the tuner.

---

## 10. CSS & TAILWIND CONFIGURATION

### 10.1 Tailwind Config Additions

```typescript
// tailwind.config.ts extend
fontFamily: {
  display: ['Sora', 'sans-serif'],
  body: ['DM Sans', 'sans-serif'],
},
colors: {
  'warm': { 50-950 HSL scale },
  'amber-gold': {
    DEFAULT: 'hsl(38, 75%, 52%)',
    light: 'hsl(43, 83%, 65%)',
    dark: 'hsl(30, 62%, 44%)',
  },
  // Plus all shadcn color mappings
},
animation: {
  'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
  'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
},
plugins: [require("tailwindcss-animate")]
```

### 10.2 Google Fonts Import

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
```

---

## 11. EDGE CASES & BEHAVIORAL DETAILS

1. **AudioContext warm-up:** A chime AudioContext is warmed up on first user interaction (click/touchstart) to avoid iOS/Safari autoplay restrictions.

2. **Display hold:** When pitch detection returns null (silence between notes), the last valid reading is held for 400ms before clearing. This prevents visual flickering.

3. **Sensitivity ↔ calibration sync:** If global calibration is enabled, the tuner's sensitivity slider initializes from and syncs with `globalSettings.advancedValues.noiseGate`. Manual slider changes update local state only (they do NOT write back to the global store).

4. **In-tune chime lockout:** The cowbell chime plays only once per sustained in-tune period. It resets when cents go above 12 (not 5), creating hysteresis to prevent repeated triggering near the threshold.

5. **Tuning dropdown closes on outside click** via `mousedown` listener on `document`.

6. **String selection + reference tone:** Clicking a string button both selects it AND plays the reference tone. Clicking the already-selected string deselects it (returns to auto-detect) AND still plays the tone.

7. **Auto-detect mode:** When no string is selected, `targetString` falls back to `closestString` (nearest in cents from all tuning strings).

8. **Cents calculation from target:**
   ```
   centsFromTarget = 1200 * Math.log2(frequency / targetString.freq)
   ```

9. **The tuner panel blocks body scroll** — no explicit `overflow: hidden` on body is set by the tuner itself; the fixed positioning handles it.

10. **Cleanup:** On unmount or panel close, all resources are cleaned up: MediaStream tracks stopped, AudioContext closed, requestAnimationFrame cancelled, all refs nulled.

---

## 12. VERIFICATION CHECKLIST

After building, verify:

- [ ] Panel opens from tab bar button with spring animation from bottom
- [ ] Microphone auto-starts when panel opens
- [ ] Note detection shows correct note name with octave number
- [ ] Frequency display updates smoothly (no jitter) due to median filter + smoothing
- [ ] 41-segment cents meter lights up correctly in green/yellow/red zones
- [ ] "In Tune ✓" text appears when within ±5 cents
- [ ] Cowbell chime plays after 500ms sustained in-tune
- [ ] Chime does NOT replay until cents exceed ±12 and return to ±5
- [ ] String buttons show gauge thickness visualization
- [ ] Clicking a string plays reference tone AND selects it
- [ ] "Auto-Detect" button deselects any selected string
- [ ] Tuning preset dropdown works and updates string buttons
- [ ] Sensitivity slider adjusts detection threshold
- [ ] "Calibrated" badge appears when global calibration is active
- [ ] Calibration Wizard completes all 4 steps correctly
- [ ] Calibration results apply to tuner sensitivity
- [ ] Display holds last reading for 400ms during brief silence
- [ ] Closing panel stops microphone and cleans up audio resources
- [ ] Panel is responsive: full-width on mobile, reasonable max-width on desktop
- [ ] Bottom of panel stops at 56px above bottom on mobile (tab bar space)
- [ ] All colors match the HSL design tokens exactly
- [ ] Fonts are Sora (display) and DM Sans (body)

---

## ASSUMPTIONS

1. The target project uses React + TypeScript + Tailwind CSS + Zustand + Framer Motion + lucide-react (same stack).
2. If building for React Native instead of web, the Web Audio API portions will need to be replaced with a native audio library (e.g., `react-native-audio-api` or `expo-av` with pitch detection). The algorithm logic (NSDF, smoothing, outlier rejection) remains identical — only the audio input/output APIs change.
3. The `getUserMedia` API is available (web browser or WebView environment).
4. The Tailwind CSS custom property system (`hsl(var(--token))`) is replicated in the target project's CSS.
5. If the target project does not have the CalibrationWizard, the tuner still works independently — calibration integration is optional but recommended.
