# FretMaster Chord Detection System — Full Reconstruction Prompt

> **Purpose:** This prompt provides every detail needed to reconstruct the FretMaster chord detection system **exactly** as it exists in the original web application. This covers the `useChordDetection` hook, all six voice rejection layers, barre chord adaptation, chroma extraction, confusion matrix tracking, session statistics, calibration integration, and the Practice page integration. Follow every specification precisely — do not simplify, optimize, refactor, or rename anything unless explicitly told to.

---

## TABLE OF CONTENTS

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Technology Stack & Dependencies](#2-technology-stack--dependencies)
3. [File Structure](#3-file-structure)
4. [Type Definitions](#4-type-definitions)
5. [Chord Library Data Model](#5-chord-library-data-model)
6. [State Management (Zustand Stores)](#6-state-management)
7. [Audio Pipeline — Microphone Input & Filter Chain](#7-audio-pipeline)
8. [NSDF Pitch Detection Algorithm](#8-nsdf-pitch-detection)
9. [Chroma Extraction](#9-chroma-extraction)
10. [Six-Layer Voice Rejection Pipeline](#10-six-layer-voice-rejection)
11. [Barre Chord Adaptive Detection](#11-barre-chord-adaptive-detection)
12. [Chord Matching Algorithm](#12-chord-matching-algorithm)
13. [Confusion Matrix & Best-Match Identification](#13-confusion-matrix)
14. [Consecutive Frame Debouncing & Cooldown](#14-consecutive-frame-debouncing)
15. [useChordDetection Hook — Complete API](#15-usechorddetection-hook)
16. [Session Statistics (useSessionStats)](#16-session-statistics)
17. [Session Summary UI Component](#17-session-summary-ui)
18. [Confusion Matrix UI Component](#18-confusion-matrix-ui)
19. [Advanced Detection Settings Panel](#19-advanced-detection-settings)
20. [Reference Tone Generator](#20-reference-tone-generator)
21. [Calibration Integration](#21-calibration-integration)
22. [Practice Page Integration](#22-practice-page-integration)
23. [Design System (Colors, Typography, Tokens)](#23-design-system)
24. [Edge Cases & Behavioral Details](#24-edge-cases)
25. [Verification Checklist](#25-verification-checklist)

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

The chord detection system is the core audio intelligence of FretMaster. It:

- Listens to the microphone in real-time via Web Audio API
- Applies a 5-stage audio filter chain to isolate guitar frequencies
- Extracts a 12-bin chromagram (pitch class profile) from FFT frequency data
- Uses NSDF pitch detection as a supplementary signal to boost the chromagram
- Runs **six** independent voice rejection gates to prevent false positives from speech, claps, plosives, and ambient noise
- Dynamically adapts all thresholds for **barre chords** (which produce muffled harmonics)
- Matches the chromagram against the expected chord's pitch classes using a triple-metric system (binary match, weighted match, cosine similarity)
- Requires **consecutive frame confirmation** (3 correct frames ≈ 210ms) to prevent transient false positives
- Tracks wrong detections via **confusion matrix** — when a wrong chord is detected, it identifies the best-matching chord from the entire library
- Integrates with a **Calibration Wizard** that auto-tunes noise gate, harmonic sensitivity, and spectral flux tolerance
- Reports results (correct/wrong/null) to the Practice page for UI feedback and session statistics

### Architecture Pattern

- **State:** Zustand stores with localStorage persistence (detection settings, practice history, confusion matrix)
- **Hooks:** Custom React hooks (`useChordDetection`, `useSessionStats`, `useReferenceTone`)
- **Analysis Loop:** `setInterval` at 70ms (≈14 Hz) — not `requestAnimationFrame` — for consistent timing regardless of render frequency
- **Audio:** Raw Web Audio API (no external audio libraries)
- **UI Framework:** React 18 + TypeScript + Tailwind CSS + Framer Motion

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
├── hooks/
│   ├── useChordDetection.ts       # Core detection hook — audio pipeline, chroma, matching, voice rejection
│   ├── useSessionStats.ts         # Session attempt tracking (correct/skipped, timing)
│   └── useReferenceTone.ts        # Synthesized chord reference playback
├── stores/
│   ├── detectionSettingsStore.ts   # Global sensitivity, advanced per-parameter overrides
│   ├── practiceHistoryStore.ts     # Session history, calibration profiles, confusion matrix data
│   └── practiceStore.ts            # Practice state (current chord, filters, navigation)
├── constants/
│   └── chords.ts                   # Complete chord library (CHORDS array of ChordData)
├── types/
│   └── chord.ts                    # ChordData interface, ChordType, ChordCategory types
├── components/
│   └── features/
│       ├── AdvancedDetectionSettings.tsx  # UI panel for per-parameter override sliders
│       ├── ConfusionMatrix.tsx            # Ranked confusion pair display
│       ├── SessionSummary.tsx             # End-of-session stats overlay
│       └── CalibrationWizard.tsx          # 4-step calibration modal
└── pages/
    ├── Practice.tsx                # Single chord practice page (uses useChordDetection)
    ├── ProgressionPractice.tsx     # Chord progression practice (also uses useChordDetection)
    └── PracticeHistory.tsx         # Analytics page with confusion matrix display
```

---

## 4. TYPE DEFINITIONS

### chord.ts

```typescript
export type ChordCategory = 'open' | 'barre' | 'movable' | 'custom';
export type BarreRoot = 6 | 5 | 4;

export type ChordType =
  | 'major' | 'minor' | 'augmented' | 'slash' | 'diminished' | 'suspended'
  | 'major7' | 'dominant7' | 'minor7' | 'aug7' | 'halfDim7' | 'dim7'
  | '9th' | '11th' | '13th';

export interface ChordData {
  id: string;
  name: string;           // e.g. "C Major", "F Minor"
  symbol: string;         // e.g. "C", "Fm", "Bb7"
  category: ChordCategory;
  type: ChordType;
  frets: number[];        // 6-element array: [low E, A, D, G, B, high E]. -1 = muted
  fingers: number[];      // 6-element array: finger assignment per string (0 = open/unused)
  baseFret: number;       // Starting fret position for the diagram
  barres?: number[];      // Fret numbers where barres occur (e.g. [1] for F major)
  rootString?: BarreRoot; // Which string the root is on (6, 5, or 4)
  rootNoteString: number; // 0-indexed string of root (0 = low E, 5 = high E)
}
```

### Detection types (in useChordDetection.ts)

```typescript
export type DetectionResult = 'correct' | 'wrong' | null;

export interface AdvancedDetectionSettings {
  noiseGate: number;       // 0-100
  harmonicBoost: number;   // 0-100
  fluxTolerance: number;   // 0-100
}
```

---

## 5. CHORD LIBRARY DATA MODEL

The chord library is a flat array `CHORDS: ChordData[]` stored in `src/constants/chords.ts`.

### Pitch Class Derivation

Every chord's **expected pitch classes** (0–11, where 0=C) are computed from its `frets` array:

```typescript
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64]; // E2, A2, D3, G3, B3, E4

function getChordPitchClasses(chord: ChordData): Set<number> {
  const pc = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue; // muted string
    const midi = OPEN_STRING_MIDI[i] + fret;
    pc.add(((midi % 12) + 12) % 12);
  }
  return pc;
}
```

**Example:** C Major (frets: [-1, 3, 2, 0, 1, 0]) produces pitch classes {0, 4, 7} (C, E, G).

### Library Size

The library contains **95+ chords** across categories:
- **Open:** Major, Minor, Dom7, Maj7, Min7, Sus2/4, Aug, Dim, Slash, 9th, Aug7, HalfDim7, FullDim7
- **Barre:** Major, Minor, Dom7, Maj7, Min7, Sus, Aug, Dim, Slash, 9th, Aug7, HalfDim7, FullDim7
- **Movable:** Major, Minor, Dom7, Maj7, Min7, Sus, Aug, Dim, Slash, 9th, 11th, 13th, Aug7, HalfDim7, FullDim7

### Pre-computed Templates (for confusion identification)

At module load time, ALL unique chord symbols get pre-computed chroma templates:

```typescript
const ALL_CHORD_TEMPLATES: { chord: ChordData; pitchClasses: Set<number>; chromaTemplate: Float64Array }[] = (() => {
  const templates = [];
  const seenSymbols = new Set<string>();
  for (const chord of CHORDS) {
    if (seenSymbols.has(chord.symbol)) continue;
    seenSymbols.add(chord.symbol);
    const pc = getChordPitchClasses(chord);
    const template = new Float64Array(12);
    for (const p of pc) template[p] = 1.0;
    templates.push({ chord, pitchClasses: pc, chromaTemplate: template });
  }
  return templates;
})();
```

This de-duplicates chords with the same symbol (e.g., open C vs movable C).

---

## 6. STATE MANAGEMENT

### 6.1 detectionSettingsStore.ts

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
  sensitivity: number;                    // 1-10 (main slider)
  advancedEnabled: boolean;               // When true, advanced overrides main slider
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
    { name: 'fretmaster-detection-settings', version: 1 }
  )
);
```

- `sensitivity` (1–10): Main slider. 6 = Balanced. Maps to `t = (sensitivity - 1) / 9` (0..1).
- When `advancedEnabled` is true, each parameter overrides the corresponding `t` value:
  - `noiseGate / 100` replaces `t` for RMS threshold, spectral flatness, crest factor, formant detection
  - `harmonicBoost / 100` replaces `t` for chroma extraction thresholds (via `1 + (harmonicBoost/100) * 9` → effective sensitivity 1–10)
  - `fluxTolerance / 100` replaces `t` for spectral flux gate

### 6.2 practiceHistoryStore.ts (Confusion Matrix portion)

```typescript
export interface ConfusionEntry {
  expected: string;   // chord symbol the user was supposed to play
  detected: string;   // chord symbol the system detected instead
  count: number;      // how many times this confusion occurred
}

// In the store:
confusionMatrix: ConfusionEntry[],
recordConfusion: (expected: string, detected: string) => void,
clearConfusionMatrix: () => void,
```

`recordConfusion` increments the count for an existing (expected, detected) pair or creates a new entry.

Persisted to localStorage under `fretmaster-practice-history` (version 2, with merge logic for backwards compatibility).

---

## 7. AUDIO PIPELINE — MICROPHONE INPUT & FILTER CHAIN

### 7.1 getUserMedia Configuration

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
  },
});
```

All browser audio processing is **disabled** to preserve raw guitar signal.

### 7.2 AudioContext

```typescript
const ctx = new AudioContext({ sampleRate: 48000 });
```

Explicit 48kHz sample rate for consistent FFT resolution across devices.

### 7.3 Filter Chain

```
MediaStreamSource
  → High-pass (type: 'highpass', freq: 70Hz, Q: 0.71)
  → Notch #1 (type: 'notch', freq: 50Hz, Q: 10)     — mains hum (EU)
  → Notch #2 (type: 'notch', freq: 60Hz, Q: 10)     — mains hum (US)
  → Peaking EQ #1 (type: 'peaking', freq: 200Hz, Q: 0.5, gain: +5dB)   — guitar fundamentals
  → Peaking EQ #2 (type: 'peaking', freq: 500Hz, Q: 0.7, gain: +3dB)   — 2nd/3rd harmonics
  → Low-pass (type: 'lowpass', freq: 3000Hz, Q: 0.5)   — remove noise above guitar range
  → AnalyserNode (fftSize: 16384, smoothingTimeConstant: 0.65)
```

**Key differences from tuner pipeline:**
- Higher `fftSize` (16384 vs 8192) — more frequency resolution for polyphonic chord analysis
- Higher `smoothingTimeConstant` (0.65 vs 0) — smoother FFT for harmonic clarity
- Extra peaking EQ at 500Hz for 2nd/3rd harmonic boost
- Low-pass at 3000Hz (vs 4000Hz in tuner) — tighter guitar range

### 7.4 Analysis Interval

```typescript
intervalRef.current = window.setInterval(() => { /* analysis */ }, 70);
```

70ms interval ≈ 14 Hz analysis rate. Uses `setInterval` (not `requestAnimationFrame`) for timing consistency.

---

## 8. NSDF PITCH DETECTION ALGORITHM

The `autoCorrelateNSDF` function extracts a single dominant pitch from the time-domain signal. For chord detection, this serves as a **supplementary signal** — not a primary gate — because polyphonic chords often don't produce a clean single pitch.

### 8.1 Function Signature

```typescript
function autoCorrelateNSDF(buffer: Float32Array, sampleRate: number, rmsThreshold: number): number
// Returns: frequency in Hz, or -1 if no pitch detected
```

### 8.2 Algorithm Steps

1. **Sub-window:** Use `min(buffer.length, 4096)` centered samples from the buffer
2. **RMS gate:** Compute RMS. If below `rmsThreshold`, return -1
3. **Hanning window:** Apply `w[i] = 0.5 * (1 - cos(2πi/(N-1)))`
4. **NSDF computation:** For lag τ from `floor(sampleRate/1500)` to `ceil(sampleRate/60)`:
   ```
   nsdf[τ] = 2 * Σ(windowed[i] * windowed[i+τ]) / Σ(windowed[i]² + windowed[i+τ]²)
   ```
5. **Peak picking:**
   - Find first zero crossing after minLag
   - Collect positive-region peaks ≥ 0.2
   - Select first peak above threshold 0.42 (fundamental)
   - Fallback: strongest peak
   - Reject if best value < 0.3
6. **Parabolic interpolation:** Sub-sample precision refinement
7. **Frequency:** `sampleRate / refinedTau`. Reject if outside 60–1400 Hz

### 8.3 Role in Chord Detection

The NSDF pitch is **not used as a gate** (polyphonic chords often fail single-pitch detection). Instead, it's used to **boost the chromagram** at the detected pitch class and its harmonics (see Section 9).

---

## 9. CHROMA EXTRACTION

### 9.1 `extractChroma` Function

```typescript
function extractChroma(
  freqData: Float32Array,      // FFT dB frequency bins from AnalyserNode
  analyser: AnalyserNode,
  sensitivity: number,         // 1-10
  nsdfPitch: number            // Hz, or -1 if none detected
): Float64Array | null          // 12-bin chromagram [C, C#, D, ..., B], or null if energy too low
```

### 9.2 Algorithm Steps

1. **Sensitivity-derived thresholds:**
   ```
   t = (sensitivity - 1) / 9    // 0..1
   dbFloor = lerp(-40, -72, t)  // Min dB to consider (strict → lenient)
   noiseGateEnergy = lerp(18, 4, t)  // Min total energy (strict → lenient)
   ```

2. **Spectral whitening:**
   Compute average energy per octave band (70, 140, 280, 560, 1120, 2500 Hz boundaries).
   Each bin's magnitude is divided by its octave band average to normalize across the spectrum, preventing bass-heavy guitar signals from overwhelming high harmonics.
   Normalization factor is capped at 5.0 to prevent extreme amplification of quiet bands.

3. **Frequency weighting:**
   ```
   weight = max(0.3, min(2.5, exp(-0.0012 * (freq - 100))))
   ```
   Smooth exponential decay — fundamentals (near 100Hz) get weight ≈2.5, higher harmonics get progressively less.

4. **Gaussian chroma interpolation:**
   For each FFT bin above `dbFloor`:
   - Convert bin frequency to fractional MIDI → fractional pitch class (0–11.99)
   - Distribute energy to all 12 pitch class bins via Gaussian kernel:
     ```
     sigma = 0.35 semitones
     gaussWeight = exp(-(dist²) / (2 * sigma²))
     ```
   - Only apply if `gaussWeight > 0.01` (skip negligible contributions)
   - Distance wraps around the circle (e.g., B→C = 1, not 11)

   This prevents energy loss when notes fall between integer pitch classes.

5. **Noise gate:**
   If `totalEnergy < noiseGateEnergy`, return null (signal too weak for reliable analysis).

6. **Harmonic series reinforcement:**
   For each pitch class with energy > 0.01:
   - Check if 3rd harmonic (+7 semitones, perfect 5th) has energy
   - Check if 5th harmonic (+4 semitones, major 3rd) has energy
   - Boost the fundamental by `(h3strength + h5strength) * 0.15`
   
   This confirms real played notes (which always produce harmonics) vs noise.

7. **NSDF pitch boost:**
   If `nsdfPitch > 0`:
   - Boost the detected pitch class by `maxChroma * 0.30`
   - Mildly boost its 3rd harmonic by `maxChroma * 0.10`
   - Mildly boost its 5th harmonic by `maxChroma * 0.08`

8. **Normalize:** Scale all chroma bins to [0, 1] range (divide by max).

---

## 10. SIX-LAYER VOICE REJECTION PIPELINE

Each layer runs independently. If **any** layer triggers, the frame is marked as `gateBlocked = true` and is excluded from both correct AND wrong detection (it doesn't count as a miss).

### Layer 1: RMS Silence Gate

**Purpose:** Reject silence / ambient noise before any spectral analysis.

```
rmsThreshold = lerp(0.018, 0.005, tNoise)
```
- Computed over `min(buffer.length, 4096)` time-domain samples
- If RMS < threshold: skip frame entirely, reset `consecutiveMatches` and `activeSignalFrames`, increment `silenceFrames`
- Only reset `consecutiveMisses` after sustained silence (`silenceFrames >= SILENCE_RESET_FRAMES = 8` ≈ 560ms)

### Layer 2: Spectral Flatness Gate

**Purpose:** Reject broadband noise (plosive consonants like "ha", "ka", claps, breath).

```typescript
function computeSpectralFlatness(freqData, analyser): number {
  // Analyze 70–2500 Hz range
  // For each bin above -80 dB:
  //   linMag = 10^(dB/20)
  //   logSum += log(linMag + 1e-12)
  //   linSum += linMag
  // geometricMean = exp(logSum / count)
  // arithmeticMean = linSum / count
  // return geometricMean / arithmeticMean
}
```

- **Broadband noise** → flatness close to 1.0 (energy evenly distributed)
- **Guitar harmonics** → flatness close to 0.0 (energy concentrated at peaks)
- **Gate threshold:** `maxFlatness = lerp(0.20, 0.40, tNoise) + barreFlat`
  - `barreFlat = 0.08` for barre chords, `0` for open chords
- Reject if `spectralFlatness > maxFlatness`

### Layer 3: Spectral Crest Factor Gate

**Purpose:** Reject voice (broad formants) vs guitar (sharp harmonic peaks).

```typescript
function computeSpectralCrest(freqData, analyser): number {
  // Analyze 70–2500 Hz range
  // For each bin above -80 dB:
  //   linMag = 10^(dB/20)
  //   track max and sum
  // return maxLin / meanLin (peak-to-average ratio)
}
```

- **Guitar** → high crest (sharp harmonics dominate) → typically 4–12+
- **Voice** → low crest (broad formants, no sharp peaks) → typically 1.5–3
- **Gate threshold:** `minCrest = lerp(3.0, 1.5, tNoise) - barreCrestReduction`
  - `barreCrestReduction = 0.6` for barre chords, `0` for open chords
- Reject if `crestFactor < minCrest`

### Layer 4: Formant Detection Gate

**Purpose:** Specifically identify human voice spectral envelope (F1/F2 two-hump pattern).

```typescript
function computeFormantScore(freqData, analyser): number {
  // Analyze 200–3000 Hz
  // Convert dB → linear magnitude
  // Heavy moving-average smoothing (~100 Hz window) to blur individual harmonics
  //   but preserve broad formant peaks
  // Find peak in F1 range (300–900 Hz)
  // Find peak in F2 range (900–2500 Hz)
  // Find valley minimum between the two peaks
  // Compute prominence: peak / valley ratio
  // Measure bandwidth at 70% of peak height (Hz)
  // Voice requires:
  //   F1 prominence > 1.4
  //   F2 prominence > 1.3
  //   F1 bandwidth >= 60 Hz
  //   F2 bandwidth >= 40 Hz
  //   Peak separation > 300 Hz
  // Score = prominence contribution + bandwidth contribution
  // Return 0..1 (higher = more voice-like)
}
```

- **Gate threshold:** `maxFormant = lerp(0.25, 0.55, tNoise)`
- Reject if `formantScore > maxFormant`

### Layer 5: Spectral Flux Gate

**Purpose:** Reject signals with rapidly changing spectral content (voice formant shifts, mouth sounds).

```
Spectral flux = average positive dB change per bin between current and previous frame
  (half-wave rectified: only counts increases, ignoring decreases)
  Range: 70–2500 Hz
```

- **Voice** → high flux (shifting formants, varying articulation)
- **Guitar chord** → low flux after initial attack (stable harmonics)
- **Gate threshold:** `maxFlux = lerp(1.5, 3.5, tFlux)` (avg dB/bin)
- Reject if `spectralFlux > maxFlux`
- On the first frame (no previous data), this gate is skipped (`spectralFlux = -1`)

### Layer 6: Consecutive Match Thresholding

**Purpose:** Prevent transient bursts (claps, plosive syllables) from triggering false positives.

- A signal must be present for `MIN_ACTIVE_FRAMES = 3` (~210ms) before matches count
- Then `MATCH_THRESHOLD = 3` consecutive matching frames (~210ms more) to confirm
- Brief plosive sounds (< 100ms) physically cannot sustain 3 consecutive matching frames

This is detailed further in Section 14.

---

## 11. BARRE CHORD ADAPTIVE DETECTION

Barre chords produce fundamentally different spectral characteristics than open chords because the index finger presses uniformly across all strings, causing:
- **Muffled harmonics** — weaker upper partials
- **Lower spectral crest** — less peak prominence
- **Higher spectral flatness** — more uniform energy distribution
- **Weaker note presence** — some notes partially muted

### 11.1 Barre Chord Detection

```typescript
function isBarreChord(chord: ChordData): boolean {
  // 1. Explicit: chord.barres array has entries
  if (chord.barres && chord.barres.length > 0) return true;
  // 2. Category: chord.category === 'barre'
  if (chord.category === 'barre') return true;
  // 3. Heuristic: 4+ fretted strings with 3+ at the same minimum fret (>= 1)
  const fretted = chord.frets.filter(f => f > 0);
  if (fretted.length >= 4) {
    const minFret = Math.min(...fretted);
    const sameMinCount = fretted.filter(f => f === minFret).length;
    if (sameMinCount >= 3 && minFret >= 1) return true;
  }
  return false;
}
```

### 11.2 Threshold Relaxation

When `isBarre = true`, the following adjustments are applied:

| Gate | Open Chord Threshold | Barre Chord Adjustment |
|------|---------------------|----------------------|
| Spectral Flatness | `lerp(0.20, 0.40, tNoise)` | `+ 0.08` |
| Spectral Crest | `lerp(3.0, 1.5, tNoise)` | `- 0.6` |
| Chroma Threshold | `lerp(0.25, 0.08, t) - sizeBonus` | `- 0.04` |
| Match Ratio Minimum | `lerp(0.70, 0.38, t)` | `- 0.06` |
| Max Extra Notes | `lerp(2, 5, t)` | `+ 1.5` |

---

## 12. CHORD MATCHING ALGORITHM

### 12.1 `matchChroma` Function

```typescript
function matchChroma(
  chroma: Float64Array,        // 12-bin normalized chromagram
  expected: Set<number>,       // Expected pitch classes (0-11)
  sensitivity: number,         // 1-10
  isBarre: boolean = false     // Adapt thresholds for barre chords
): boolean
```

### 12.2 Triple-Metric Matching

Three independent similarity metrics are computed, and the **best** is used:

#### Metric 1: Binary Match Ratio
```
For each expected pitch class: is it present (above threshold) in the chromagram?
binaryRatio = matchingPitchClasses / expectedPitchClasses
```

#### Metric 2: Weighted Match Ratio
```
For each expected pitch class: partial credit based on chroma strength
If strength >= chromaThreshold * 0.6:
  credit = min(strength / chromaThreshold, 1.5)
weightedRatio = totalCredit / expectedPitchClasses
```

#### Metric 3: Cosine Similarity
```
template[i] = expected.has(i) ? 1.0 : 0
cosineSim = dot(chroma, template) / (norm(chroma) * norm(template))
// Scaled up by 1.15 since cosine is naturally lower
effectiveCosineSim = cosineSim * 1.15
```

#### Final Decision
```
effectiveRatio = max(weightedRatio, binaryRatio, effectiveCosineSim)
extraPenalty = extras > maxExtras ? (extras - maxExtras) * lerp(0.08, 0.02, t) : 0
MATCH if (effectiveRatio - extraPenalty) >= matchRatioMin AND binaryMatches >= min(2, expected.size)
```

### 12.3 Sensitivity-Derived Parameters

| Parameter | Strict (sens=1, t=0) | Balanced (sens=6, t=0.56) | Lenient (sens=10, t=1) |
|-----------|---------------------|--------------------------|----------------------|
| chromaThreshold | 0.25 | ~0.15 | 0.08 |
| matchRatioMin | 0.70 | ~0.52 | 0.38 |
| maxExtrasBase | 2 | ~3.7 | 5 |
| extraPenalty per note | 0.08 | ~0.045 | 0.02 |

---

## 13. CONFUSION MATRIX & BEST-MATCH IDENTIFICATION

### 13.1 `identifyBestMatch` Function

When the user plays the wrong chord, the system identifies what chord they likely played:

```typescript
function identifyBestMatch(chroma: Float64Array, excludeSymbol?: string): string | null {
  // For each chord template in ALL_CHORD_TEMPLATES (excluding the expected chord):
  //   Compute cosine similarity between detected chroma and template
  // Return the symbol with highest similarity, if >= 0.35
  // Return null if no match above threshold
}
```

### 13.2 Integration Flow

1. User plays wrong chord → `consecutiveMisses >= MISS_THRESHOLD`
2. `setResult('wrong')` → UI shows "Wrong" feedback
3. Retrieve `lastDetectedChromaRef.current` (most recent chroma before the wrong verdict)
4. Call `identifyBestMatch(lastChroma, chord.symbol)` to find what was actually played
5. If a match is found, call `onWrongDetected(detectedSymbol)` callback
6. In Practice page, this triggers `recordConfusion(expectedSymbol, detectedSymbol)` on the store

### 13.3 Data Persistence

Confusion entries are accumulated over time in `practiceHistoryStore.confusionMatrix[]`. Each entry has `{ expected, detected, count }`. The count increments each time the same pair occurs across any session.

---

## 14. CONSECUTIVE FRAME DEBOUNCING & COOLDOWN

### 14.1 Frame Counters

```typescript
let consecutiveMatches = 0;     // Sequential frames where chroma matches expected chord
let consecutiveMisses = 0;      // Sequential frames where chroma doesn't match (non-gate-blocked)
let activeSignalFrames = 0;     // Frames with signal above noise floor
let silenceFrames = 0;          // Frames of continuous silence

const MATCH_THRESHOLD = 3;      // ~210ms to confirm correct
const MISS_THRESHOLD = 2;       // ~140ms to confirm wrong
const MIN_ACTIVE_FRAMES = 3;    // ~210ms of signal before matches count
const SILENCE_RESET_FRAMES = 8; // ~560ms of silence to reset miss counter
```

### 14.2 State Transitions

```
Signal present + gate passes + chroma matches expected:
  → If activeSignalFrames >= MIN_ACTIVE_FRAMES: consecutiveMatches++
  → consecutiveMisses = 0
  → silenceFrames = 0

Signal present + gate passes + chroma doesn't match:
  → If activeSignalFrames >= MIN_ACTIVE_FRAMES: consecutiveMisses++
  → consecutiveMatches = 0
  → silenceFrames = 0

Signal present + gate blocked (voice/noise):
  → consecutiveMatches = 0
  → Do NOT increment consecutiveMisses (rejected signals shouldn't count as wrong chord)
  → silenceFrames = 0

Signal below RMS threshold (silence):
  → consecutiveMatches = 0
  → activeSignalFrames = 0
  → silenceFrames++
  → If silenceFrames >= SILENCE_RESET_FRAMES: consecutiveMisses = 0

Chroma extraction returns null (weak signal):
  → consecutiveMatches = 0
  → Do NOT reset consecutiveMisses
```

### 14.3 Cooldown

On correct: `1500ms` cooldown before next detection cycle begins
On wrong: `1800ms` cooldown before next detection cycle begins

During cooldown, `cooldownRef.current = true` and the analysis loop early-returns.

### 14.4 Silence Gap Handling

The silence gap logic is critical for accurate wrong detection:
- **Brief gaps** (< 560ms) between strums should NOT reset the miss counter, because the user may be re-attempting the same wrong chord
- **Extended silence** (≥ 560ms ≈ 8 frames) indicates the user stopped playing → reset miss counter
- Without this, "wrong" feedback would never trigger because brief gaps between strum attempts would reset accumulated misses to 0

---

## 15. `useChordDetection` HOOK — COMPLETE API

### 15.1 Options Interface

```typescript
interface UseChordDetectionOptions {
  onCorrect?: () => void;                           // Called when chord is correctly detected
  onWrongDetected?: (detectedSymbol: string) => void; // Called with the chord symbol that was actually played
  targetChord?: ChordData | null;                    // The chord the user should be playing
  sensitivity?: number;                              // 1-10, default 6
  autoStart?: boolean;                               // Auto-start mic on mount, default false
  advancedSettings?: AdvancedDetectionSettings | null; // Per-parameter overrides
}
```

### 15.2 Return Value

```typescript
{
  isListening: boolean;          // Whether mic is active
  result: DetectionResult;       // 'correct' | 'wrong' | null
  permissionDenied: boolean;     // Whether mic permission was denied
  toggleListening: () => void;   // Start/stop mic
  stopListening: () => void;     // Force stop
  pauseDetection: (ms: number) => void;  // Temporarily pause (e.g., during audio playback)
}
```

### 15.3 Lifecycle

- **Mount with `autoStart=true`:** Starts mic after 400ms delay
- **Target chord changes:** Resets `result` to null, clears cooldown
- **Sensitivity changes:** Immediately affects thresholds (via ref, no restart needed)
- **Unmount:** Stops mic, closes AudioContext, clears all intervals and refs

### 15.4 Ref Strategy

All callback refs (`onCorrectRef`, `onWrongDetectedRef`, `targetChordRef`, `sensitivityRef`, `advancedSettingsRef`) use `useRef` + `useEffect` sync to avoid recreating the analysis closure when callbacks change.

---

## 16. SESSION STATISTICS (useSessionStats)

### 16.1 Hook API

```typescript
export function useSessionStats() {
  return {
    attempts: SessionAttempt[];     // All attempts this session
    showSummary: boolean;           // Whether summary modal is shown
    startSession: () => void;       // Reset all counters
    recordAttempt: (chordSymbol: string, chordName: string, result: 'correct' | 'skipped') => void;
    resetChordTimer: () => void;    // Reset per-chord timer
    endSession: () => void;         // Trigger summary display
    dismissSummary: () => void;     // Close summary
    getSummary: () => SessionSummary;  // Compute stats
  };
}
```

### 16.2 Attempt Interface

```typescript
export interface SessionAttempt {
  chordSymbol: string;
  chordName: string;
  result: 'correct' | 'skipped';
  timeMs: number;      // Time from chord presentation to result
  timestamp: number;   // Date.now()
}
```

### 16.3 Summary Interface

```typescript
export interface SessionSummary {
  attempts: SessionAttempt[];
  totalCorrect: number;
  totalSkipped: number;
  accuracyRate: number;        // 0-100 (correct / (correct + skipped))
  avgResponseTimeMs: number;   // Average of correct attempts only
  fastestTimeMs: number;
  slowestTimeMs: number;
  totalDurationMs: number;     // Session wall-clock time
}
```

### 16.4 Timer Logic

- `chordStartTimeRef` resets when a new chord is presented
- `sessionStartTimeRef` resets on `startSession()`
- `recordAttempt` captures `Date.now() - chordStartTimeRef.current`

---

## 17. SESSION SUMMARY UI COMPONENT

### 17.1 Layout

Full-screen overlay modal with:
- **Header:** Trophy icon, "Session Summary", total duration
- **Stats Grid (2×2):**
  - Accuracy (green, Target icon)
  - Avg Time (amber, Clock icon)
  - Fastest (emphasis gold, Zap icon)
  - Attempts (correct count / skipped count, TrendingUp icon)
- **Attempt Log:** Scrollable list of all attempts with:
  - Rank number
  - CheckCircle (correct) or SkipForward (skipped) icon
  - Chord symbol
  - Response time
- **"Done" button** (full-width primary CTA)

### 17.2 History Persistence

On mount (if attempts exist), the session is automatically saved to `practiceHistoryStore.addSession()` with a `savedRef` guard preventing double-saves.

---

## 18. CONFUSION MATRIX UI COMPONENT

### 18.1 Data Processing

The raw `ConfusionEntry[]` (directional pairs) is combined into **bidirectional pairs**:
- Key: sorted pair `[A, B].sort().join('↔')`
- Each pair tracks `count` (A→B) and `reverseCount` (B→A)
- Sorted by `total = count + reverseCount` descending

### 18.2 Display

- Top 8 pairs shown by default; "Show all X pairs" expander
- Each row has:
  - **Background bar:** Width proportional to count / max (visual ranking)
  - **Rank number**
  - **Chord pair:** "A ↔ B" with GitCompareArrows icon
  - **Direction breakdown:** "A→B: 5 | B→A: 3"
  - **Total badge:** "8×"

### 18.3 Severity Coloring

| Total Count | Severity | Background | Border | Text |
|-------------|----------|-----------|--------|------|
| ≥ 10 | High | `semantic-error/0.1` | `semantic-error/0.25` | `semantic-error` |
| ≥ 5 | Medium | `color-emphasis/0.08` | `color-emphasis/0.2` | `color-emphasis` |
| < 5 | Low | `bg-surface/0.5` | `border-subtle` | `text-subtle` |

### 18.4 Clear Functionality

Two-step confirmation: "Clear" → "Clear all? [Yes] [No]"

---

## 19. ADVANCED DETECTION SETTINGS PANEL

### 19.1 UI Structure

Collapsible panel with three sliders:

1. **Noise Gate** (Shield icon, amber color)
   - "Lower = stricter silence detection. Higher = more sensitive to quiet playing."
   - Range: 0–100

2. **Harmonic Sensitivity** (Waves icon, cyan color)
   - "Lower = requires stronger note presence. Higher = detects subtle harmonics."
   - Range: 0–100

3. **Flux Tolerance** (Zap icon, violet color)
   - "Lower = rejects changing sounds (voice). Higher = accepts more spectral variation."
   - Range: 0–100

### 19.2 Toggle

When Advanced is enabled: "Overrides main sensitivity slider"
When disabled: "Using main sensitivity slider"

"Reset" button restores defaults (50, 50, 50).

---

## 20. REFERENCE TONE GENERATOR

### 20.1 `useReferenceTone` Hook

Plays a synthesized chord through the speaker so the user can hear the target chord.

```typescript
export function useReferenceTone() {
  return {
    playChordTone: (chord: ChordData, duration?: number) => void;
    stopTone: () => void;
    isPlaying: MutableRefObject<boolean>;
  };
}
```

### 20.2 Synthesis

For each non-muted string (fret ≥ 0):
- Compute MIDI: `OPEN_STRING_MIDI[stringIdx] + fret`
- Convert to frequency: `440 * 2^((midi - 69) / 12)`
- Create two oscillators per string:
  - **Primary:** triangle wave at fundamental frequency
  - **2nd harmonic:** sine wave at 2× frequency, 15% amplitude
- **Stagger start times** by 15ms per string (simulates strum, low→high)
- Per-string gain balanced: `min(0.9, 1.2 / activeStringCount)`
- Slight detuning per string: `(stringIdx - 2.5) * 1.2 cents` for realism
- Duration: 2.5 seconds default
- Envelope: fast attack (40ms), sustain at 60% after 40% of duration, fade to silence

---

## 21. CALIBRATION INTEGRATION

The Calibration Wizard (detailed in the Tuner reconstruction prompt) produces three values:
- `noiseGate` (0–100)
- `harmonicBoost` (0–100)
- `fluxTolerance` (0–100)

When applied via `detectionSettingsStore.applyCalibrationProfile()`:
1. `advancedEnabled` is set to `true`
2. `advancedValues` is set to the calibration result
3. All pages that use `useChordDetection` automatically read these values

**The calibration is global** — it applies to:
- Practice page (single chord mode)
- Progression practice page
- Tuner (mic sensitivity syncs with noiseGate)

---

## 22. PRACTICE PAGE INTEGRATION

### 22.1 Hook Wiring

```typescript
const { sensitivity, advancedEnabled, advancedValues } = useDetectionSettingsStore();
const advancedSettings = advancedEnabled ? advancedValues : null;

const handleDetectionCorrect = useCallback(() => {
  session.recordAttempt(chord.symbol, chord.name, 'correct');
  if (!isRevealed) revealChord();
  resetBeatCounter();
  nextChord();
}, [...]);

const handleWrongDetected = useCallback((detectedSymbol: string) => {
  recordConfusion(chord.symbol, detectedSymbol);
}, [...]);

const { isListening, result, permissionDenied, toggleListening, stopListening, pauseDetection } =
  useChordDetection({
    onCorrect: handleDetectionCorrect,
    onWrongDetected: handleWrongDetected,
    targetChord: chord,
    sensitivity,
    autoStart: true,
    advancedSettings,
  });
```

### 22.2 DetectionFeedback UI

Animated pill shown above the chord name:
- **Correct:** Green background, "CORRECT" text with green glow
- **Wrong:** Red background, "WRONG" text with red glow
- Uses Framer Motion `AnimatePresence` for enter/exit

### 22.3 Sensitivity Slider

Inline slider in the listening status bar:
- Range: 1–10
- Labels: 1–3 = "Strict" (blue), 4–7 = "Balanced" (amber), 8–10 = "Sensitive" (green)

### 22.4 Pause Detection

`pauseDetection(ms)` is called before playing chord audio or reference tones to prevent the speaker output from being picked up by the mic:
- Play chord audio: pause 2000ms
- Play reference tone: pause 3000ms

### 22.5 Session Flow

1. User enters Practice page → mic auto-starts
2. Chord presented → user plays → detection runs
3. **Correct:** `onCorrect` fires → records attempt → reveals chord → advances to next
4. **Wrong:** Result shows "Wrong" → confusion recorded → 1800ms cooldown → resets
5. **Skip:** User clicks "Next" → records as "skipped" → advances
6. **Back/Exit:** If attempts > 0, shows SessionSummary → saves to history → navigates back

---

## 23. DESIGN SYSTEM

### 23.1 Color Tokens

```css
:root {
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
}
```

### 23.2 Typography

- `font-display` = Sora (headings, labels, buttons)
- `font-body` = DM Sans (body text, descriptions)

### 23.3 Detection Feedback Colors

- Correct: `hsl(142 71% 45%)` with `0.15` bg opacity, `0.5` border opacity
- Wrong: `hsl(0 84% 60%)` with `0.15` bg opacity, `0.5` border opacity
- Both have text-shadow glow effects

---

## 24. EDGE CASES & BEHAVIORAL DETAILS

1. **Double-start prevention:** `isListeningRef.current` checked before `startListening()` to prevent multiple mic streams.

2. **AudioContext suspension:** If `ctx.state === 'suspended'`, `await ctx.resume()` is called before analysis starts. Also checked each frame (`ctx.state !== 'running'` → skip).

3. **Target chord change:** Resets `result` to null and clears cooldown immediately, allowing fresh detection of the new chord.

4. **Null chroma handling:** When chroma extraction returns null (weak signal), `consecutiveMatches` resets to 0 but `consecutiveMisses` is NOT reset — this is critical for wrong detection accumulation.

5. **Gate-blocked frames:** When voice rejection triggers, the frame is silently discarded. It does NOT increment `consecutiveMisses` (voice shouldn't count as a wrong guitar chord).

6. **Cleanup:** On unmount, `stopListening()` is called: stops MediaStream tracks, closes AudioContext, clears intervals, nulls all refs.

7. **Auto-start delay:** When `autoStart = true`, a 400ms timeout before `startListening()` gives the component time to mount and render.

8. **Polyphonic handling:** NSDF pitch detection often fails on chords (multiple simultaneous pitches). This is intentional — NSDF is supplementary, not primary. The chroma-based approach inherently handles polyphony because it analyzes frequency bins independently.

9. **Octave aliasing:** Gaussian chroma interpolation wraps around the pitch class circle, so B (11) and C (0) are treated as 1 semitone apart, not 11.

10. **Sensitivity persistence:** The `detectionSettingsStore` is persisted to localStorage, so sensitivity and advanced settings survive page reloads.

---

## 25. VERIFICATION CHECKLIST

After building, verify:

### Audio Pipeline
- [ ] Mic opens with echo/noise cancellation disabled
- [ ] 5-stage filter chain processes signal before analysis
- [ ] AnalyserNode uses fftSize=16384, smoothing=0.65
- [ ] Analysis runs at 70ms intervals (~14 Hz)

### Chroma Extraction
- [ ] 12-bin chromagram correctly maps FFT bins to pitch classes
- [ ] Spectral whitening normalizes across octave bands
- [ ] Gaussian interpolation prevents energy loss between integer pitch classes
- [ ] Harmonic reinforcement boosts confirmed fundamentals
- [ ] NSDF pitch boosts detected pitch class in chromagram
- [ ] Noise gate rejects low-energy frames

### Voice Rejection
- [ ] RMS silence gate rejects ambient noise
- [ ] Spectral flatness rejects broadband noise (plosives, claps)
- [ ] Spectral crest factor rejects voice (broad formants)
- [ ] Formant detection rejects vowel sounds (F1/F2 two-hump pattern)
- [ ] Spectral flux rejects rapidly changing signals (speech)
- [ ] Consecutive frame threshold prevents transient false positives
- [ ] Speaking "ha", "ka", or other plosives does NOT trigger "correct"
- [ ] Clapping does NOT trigger "correct"

### Barre Chord Adaptation
- [ ] Barre chords detected via barres array, category, or fret pattern heuristic
- [ ] Spectral flatness threshold relaxed by +0.08 for barre chords
- [ ] Spectral crest threshold relaxed by -0.6 for barre chords
- [ ] Chroma threshold relaxed by -0.04 for barre chords
- [ ] Match ratio minimum relaxed by -0.06 for barre chords
- [ ] F barre major is detectable when played correctly
- [ ] Open C major still detected accurately (no false loosening)

### Chord Matching
- [ ] Triple metric system: binary, weighted, cosine similarity
- [ ] Correct chord triggers "Correct" after ~210ms sustained match
- [ ] Wrong chord triggers "Wrong" after ~140ms sustained mismatch
- [ ] Sensitivity slider (1–10) adjusts all thresholds smoothly
- [ ] Advanced settings override main slider when enabled

### Confusion Tracking
- [ ] Wrong detection identifies the best-matching chord via cosine similarity
- [ ] Confusion pairs accumulate across sessions in localStorage
- [ ] ConfusionMatrix UI shows ranked pairs with severity coloring
- [ ] Directional breakdown (A→B vs B→A) is displayed
- [ ] Clear function requires two-step confirmation

### Session Statistics
- [ ] Each correct detection records attempt with timing
- [ ] Skipped chords record as "skipped"
- [ ] Session summary shows accuracy %, avg time, fastest, attempt count
- [ ] Attempt log lists all attempts with icons and timing
- [ ] Session saved to practice history on summary display

### Integration
- [ ] Detection auto-starts when Practice page loads
- [ ] Detection pauses during chord/reference tone playback
- [ ] Calibration wizard values apply to detection settings
- [ ] Mic toggle button works on/off
- [ ] Permission denied state shows error message
- [ ] Listening status bar shows animated waveform + sensitivity slider

---

## ASSUMPTIONS

1. The target project uses React + TypeScript + Tailwind CSS + Zustand + Framer Motion + lucide-react.
2. A chord library (`CHORDS` array) exists with the `ChordData` interface.
3. The Web Audio API is available (web browser).
4. The Tailwind CSS custom property system (`hsl(var(--token))`) is replicated.
5. For React Native migration, replace `getUserMedia` with a native audio stream, replace `AnalyserNode` with JS-based FFT, and replace `setInterval` with the audio stream callback. All DSP algorithms (NSDF, chroma extraction, voice rejection, matching) are pure math and port without modification.
