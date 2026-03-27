# CHORD PLAYBACK SYSTEM — FULL RECONSTRUCTION PROMPT

> **Purpose**: Rebuild the FretMaster guitar chord playback system exactly as implemented.
> This covers: synthesized chord strumming via Web Audio API, reference tone generation,
> audio state management with localStorage persistence, volume control UI, and the complete
> chord data model that drives playback. Every parameter, gain curve, timing value, and
> routing topology is specified — do NOT simplify, optimize, or refactor any part.

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Type System — ChordData](#2-type-system--chorddata)
3. [Chord Library Data](#3-chord-library-data)
4. [Audio State Store — audioStore.ts](#4-audio-state-store--audiostorets)
5. [Chord Playback Hook — useChordAudio.ts](#5-chord-playback-hook--usechordaudiots)
6. [Reference Tone Hook — useReferenceTone.ts](#6-reference-tone-hook--usereferencetonets)
7. [Volume Control Component — VolumeControl.tsx](#7-volume-control-component--volumecontroltsx)
8. [Audio Routing Topology](#8-audio-routing-topology)
9. [Oscillator Synthesis Details](#9-oscillator-synthesis-details)
10. [Gain Envelope Specifications](#10-gain-envelope-specifications)
11. [Filter Specifications](#11-filter-specifications)
12. [Timing and Strum Simulation](#12-timing-and-strum-simulation)
13. [Volume Curve and Master Gain](#13-volume-curve-and-master-gain)
14. [String Frequency Model](#14-string-frequency-model)
15. [MIDI-to-Frequency Conversion](#15-midi-to-frequency-conversion)
16. [Reference Tone Per-String Balancing](#16-reference-tone-per-string-balancing)
17. [Reference Tone Lifecycle Management](#17-reference-tone-lifecycle-management)
18. [localStorage Persistence Schema](#18-localstorage-persistence-schema)
19. [Integration Points](#19-integration-points)
20. [CSS Requirements for Volume Slider](#20-css-requirements-for-volume-slider)
21. [Edge Cases and Error Handling](#21-edge-cases-and-error-handling)
22. [Verification Checklist](#22-verification-checklist)
23. [Assumptions](#23-assumptions)

---

## 1. Architecture Overview

The chord playback system consists of four modules:

```
src/
├── hooks/
│   ├── useChordAudio.ts      # Synthesized chord strum playback
│   └── useReferenceTone.ts   # Clean reference tone generator
├── stores/
│   └── audioStore.ts         # Zustand store for volume + mute state
├── components/features/
│   └── VolumeControl.tsx     # Volume slider + mute toggle UI
├── types/
│   └── chord.ts              # ChordData type definition
└── constants/
    └── chords.ts             # Full chord library (100+ chords)
```

**Technology stack**:
- React 18 + TypeScript
- Zustand (state management, NO persist middleware — manual localStorage)
- Web Audio API (all synthesis is oscillator-based, zero sample files)
- Tailwind CSS + HSL CSS variables for UI
- lucide-react for icons

**Key design decisions**:
- All audio is synthesized from oscillators — no audio file downloads for chord playback
- Two separate playback systems: `useChordAudio` (strum simulation) and `useReferenceTone` (clean sustained tones)
- Volume state is global via Zustand, shared between both playback hooks
- Muted strings (fret value `-1`) are skipped entirely — no oscillators created

---

## 2. Type System — ChordData

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
  name: string;
  symbol: string;
  category: ChordCategory;
  type: ChordType;
  frets: number[];        // length 6, index 0=low E, 5=high E. -1 = muted
  fingers: number[];      // fingering indicators
  baseFret: number;       // position on neck (1 = open position)
  barres?: number[];      // fret numbers that are barred
  rootString?: BarreRoot; // which string group the root is on
  rootNoteString: number; // 0-indexed string where root note lives (0=low E, 5=high E)
}
```

**Critical**: The `frets` array uses **absolute fret numbers** for playback frequency calculation. Index 0 = 6th string (low E), index 5 = 1st string (high E). A value of `-1` means muted (do not play).

### Supporting types and labels

```typescript
export type TimerDuration = 0 | 2 | 5 | 10;

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
  custom: 'My Chords',
};

export const BARRE_ROOT_LABELS: Record<BarreRoot | 'all', string> = {
  all: 'All Roots',
  6: 'Root 6th String',
  5: 'Root 5th String',
  4: 'Root 4th String',
};

export function getChordCategoryLabel(chord: ChordData): string {
  if (chord.category === 'custom') return 'Custom';
  if (chord.category === 'movable' && chord.rootString) return `Root ${chord.rootString} Movable`;
  if (chord.category === 'barre' && chord.rootString) return `Root ${chord.rootString} Barre`;
  return CATEGORY_LABELS[chord.category];
}
```

---

## 3. Chord Library Data

File: `src/constants/chords.ts`

The library contains **100+ chords** organized into categories. Each chord's `frets` array provides absolute fret positions. Here is the COMPLETE structure — every chord must be reproduced exactly.

### Category breakdown:

| Category | Types included | Count |
|----------|---------------|-------|
| Open | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, aug7, halfDim7, dim7 | ~50 |
| Barre | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, aug7, halfDim7, dim7 | ~30 |
| Movable | major, minor, dominant7, major7, minor7, suspended, augmented, diminished, slash, 9th, 11th, 13th, aug7, halfDim7, dim7 | ~30 |

### Sample entries for each category (reproduce ALL chords from the full library):

**Open Major:**
```typescript
{ id: 'open-c-major', name: 'C Major', symbol: 'C', category: 'open', type: 'major',
  frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1, rootNoteString: 1 },
{ id: 'open-d-major', name: 'D Major', symbol: 'D', category: 'open', type: 'major',
  frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1, rootNoteString: 2 },
{ id: 'open-e-major', name: 'E Major', symbol: 'E', category: 'open', type: 'major',
  frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1, rootNoteString: 0 },
{ id: 'open-g-major', name: 'G Major', symbol: 'G', category: 'open', type: 'major',
  frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1, rootNoteString: 0 },
{ id: 'open-a-major', name: 'A Major', symbol: 'A', category: 'open', type: 'major',
  frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 2, 1, 3, 0], baseFret: 1, rootNoteString: 1 },
```

**Open Minor:**
```typescript
{ id: 'open-am', name: 'A Minor', symbol: 'Am', category: 'open', type: 'minor',
  frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1, rootNoteString: 1 },
{ id: 'open-dm', name: 'D Minor', symbol: 'Dm', category: 'open', type: 'minor',
  frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1, rootNoteString: 2 },
{ id: 'open-em', name: 'E Minor', symbol: 'Em', category: 'open', type: 'minor',
  frets: [0, 2, 2, 0, 0, 0], fingers: [0, 1, 2, 0, 0, 0], baseFret: 1, rootNoteString: 0 },
```

**Barre Major (with barres and rootString):**
```typescript
{ id: 'barre-f-major', name: 'F Major', symbol: 'F', category: 'barre', type: 'major',
  frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [1],
  rootString: 6, rootNoteString: 0 },
{ id: 'barre-bb-major', name: 'Bb Major', symbol: 'Bb', category: 'barre', type: 'major',
  frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [1],
  rootString: 5, rootNoteString: 1 },
```

**IMPORTANT**: The full chord library must contain ALL chords from the original — approximately 100+ entries across all categories and types. Copy the complete `CHORDS` array verbatim. Each chord's `frets` array must be exactly correct as it directly controls the frequency of each synthesized note.

---

## 4. Audio State Store — audioStore.ts

File: `src/stores/audioStore.ts`

This is a **Zustand store WITHOUT the persist middleware**. Persistence is handled manually via `localStorage.getItem/setItem`.

```typescript
import { create } from 'zustand';

const STORAGE_KEY = 'fretmaster-audio';

interface AudioSettings {
  volume: number;  // 0–1
  muted: boolean;
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.7,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      };
    }
  } catch {
    // ignore
  }
  return { volume: 0.7, muted: false };
}

function persist(settings: AudioSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface AudioStore extends AudioSettings {
  setVolume: (v: number) => void;
  toggleMute: () => void;
  getEffectiveVolume: () => number;
}

export const useAudioStore = create<AudioStore>((set, get) => {
  const initial = loadSettings();
  return {
    ...initial,

    setVolume: (volume) => {
      const clamped = Math.max(0, Math.min(1, volume));
      set({ volume: clamped, muted: clamped === 0 });
      persist({ volume: clamped, muted: clamped === 0 });
    },

    toggleMute: () => {
      const next = !get().muted;
      set({ muted: next });
      persist({ volume: get().volume, muted: next });
    },

    getEffectiveVolume: () => {
      const { volume, muted } = get();
      return muted ? 0 : volume;
    },
  };
});
```

### Key behaviors:
- **Default volume**: `0.7` (70%)
- **Default muted**: `false`
- **localStorage key**: `'fretmaster-audio'`
- **Stored as JSON**: `{ "volume": 0.7, "muted": false }`
- **Setting volume to 0 automatically sets muted to true**
- **toggleMute preserves the volume value** — only flips the muted flag
- **getEffectiveVolume**: returns `0` when muted, otherwise returns `volume`
- Clamping on load: volume clamped to `[0, 1]` range

---

## 5. Chord Playback Hook — useChordAudio.ts

File: `src/hooks/useChordAudio.ts`

This hook creates synthesized guitar chord strums using Web Audio API oscillators.

### Complete implementation:

```typescript
import { useRef, useCallback } from 'react';
import type { ChordData } from '@/types/chord';
import { useAudioStore } from '@/stores/audioStore';

// Standard guitar tuning frequencies (E2, A2, D3, G3, B3, E4)
const STRING_FREQUENCIES = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const SEMITONE_RATIO = Math.pow(2, 1 / 12);

function getNoteFrequency(stringIndex: number, fret: number): number {
  return STRING_FREQUENCIES[stringIndex] * Math.pow(SEMITONE_RATIO, fret);
}
```

**getNoteFrequency** computes the exact frequency for any fret on any string using equal temperament tuning. The base frequencies are standard guitar tuning:
- String 0 (low E): 82.41 Hz
- String 1 (A): 110.0 Hz
- String 2 (D): 146.83 Hz
- String 3 (G): 196.0 Hz
- String 4 (B): 246.94 Hz
- String 5 (high E): 329.63 Hz

Each fret raises pitch by one semitone: `freq * 2^(1/12)`.

### createPluck function — Single String Synthesis

Each string is synthesized using **three oscillators** routed through a **low-pass filter**:

```typescript
function createPluck(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  outputNode: AudioNode,
) {
  // Oscillator 1: Main tone — triangle wave for warm guitar-like timbre
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(frequency, startTime);

  // Oscillator 2: Harmonic layer — quiet sine at octave above for brightness
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(frequency * 2, startTime);

  // Oscillator 3: Sub harmonic — sine at half frequency for body
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(frequency * 0.5, startTime);

  // Main gain envelope (pluck shape)
  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(0, startTime);
  mainGain.gain.linearRampToValueAtTime(volume * 0.45, startTime + 0.008);       // 8ms attack
  mainGain.gain.exponentialRampToValueAtTime(volume * 0.18, startTime + 0.12);    // 120ms decay
  mainGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);        // fade to silence

  // Harmonic gain envelope (shorter)
  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0, startTime);
  harmonicGain.gain.linearRampToValueAtTime(volume * 0.08, startTime + 0.005);   // 5ms attack
  harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.5); // dies at half duration

  // Sub gain envelope
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, startTime);
  subGain.gain.linearRampToValueAtTime(volume * 0.12, startTime + 0.01);         // 10ms attack
  subGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);   // dies at 70% duration

  // Low-pass filter — softens tone, sweeps down over time
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(frequency * 6, 5000), startTime);
  filter.frequency.exponentialRampToValueAtTime(
    Math.min(frequency * 2, 2000),
    startTime + duration * 0.4
  );
  filter.Q.setValueAtTime(1.2, startTime);

  // Routing: all oscillators → individual gains → shared filter → output
  osc1.connect(mainGain);
  osc2.connect(harmonicGain);
  osc3.connect(subGain);

  mainGain.connect(filter);
  harmonicGain.connect(filter);
  subGain.connect(filter);

  filter.connect(outputNode);

  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);
  osc1.stop(startTime + duration + 0.05);
  osc2.stop(startTime + duration + 0.05);
  osc3.stop(startTime + duration + 0.05);

  return [osc1, osc2, osc3];
}
```

### playChord function — Full Chord Strum

```typescript
export function useChordAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const activeOscillators = useRef<OscillatorNode[]>([]);
  const getEffectiveVolume = useAudioStore((s) => s.getEffectiveVolume);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const stopCurrent = useCallback(() => {
    activeOscillators.current.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    activeOscillators.current = [];
  }, []);

  const playChord = useCallback((chord: ChordData) => {
    const masterVol = getEffectiveVolume();
    if (masterVol === 0) return;   // muted — skip playback entirely

    stopCurrent();
    const ctx = getContext();

    // Master gain: applies volume with boost curve
    // Formula: v^1.2 * 8
    const masterGain = ctx.createGain();
    const gain = Math.pow(masterVol, 1.2) * 8;
    masterGain.gain.value = gain;
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime + 0.05;     // 50ms lookahead
    const strumDelay = 0.035;                // 35ms between strings
    const noteDuration = 2.5;                // 2.5 second ring-out
    const allOscs: OscillatorNode[] = [];

    // Strum low E to high E (index 0 → 5)
    let strumIndex = 0;
    for (let i = 0; i < 6; i++) {
      const fret = chord.frets[i];
      if (fret === -1) continue;             // muted string — skip

      const freq = getNoteFrequency(i, fret);
      // Bass strings slightly louder: 0.3 - (stringIndex * 0.015)
      const vol = 0.3 - i * 0.015;
      const startTime = now + strumIndex * strumDelay;
      const oscs = createPluck(ctx, freq, startTime, noteDuration, vol, masterGain);
      allOscs.push(...oscs);
      strumIndex++;
    }

    activeOscillators.current = allOscs;
  }, [getContext, stopCurrent, getEffectiveVolume]);

  return { playChord, stopCurrent };
}
```

### Critical timing details:
- **Lookahead**: 50ms (`ctx.currentTime + 0.05`)
- **Strum delay**: 35ms per string (not per string index — per *active* string)
- **Note duration**: 2.5 seconds total ring-out
- **String volume gradient**: String 0 = 0.300, String 1 = 0.285, String 2 = 0.270, String 3 = 0.255, String 4 = 0.240, String 5 = 0.225

---

## 6. Reference Tone Hook — useReferenceTone.ts

File: `src/hooks/useReferenceTone.ts`

A separate playback system that generates clean, sustained reference tones for a chord (so users can hear what the chord *should* sound like).

### MIDI note mapping for open strings:
```typescript
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
// E2=40, A2=45, D3=50, G3=55, B3=59, E4=64

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
```

### Complete implementation:

```typescript
export function useReferenceTone() {
  const contextRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<{ oscs: OscillatorNode[]; master: GainNode } | null>(null);
  const isPlayingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTone = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const nodes = activeNodesRef.current;
    const ctx = contextRef.current;
    if (!nodes || !ctx) { isPlayingRef.current = false; return; }

    const now = ctx.currentTime;
    try {
      nodes.master.gain.cancelScheduledValues(now);
      nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
      nodes.master.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    } catch {}

    setTimeout(() => {
      nodes.oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
      try { nodes.master.disconnect(); } catch {}
      activeNodesRef.current = null;
      isPlayingRef.current = false;
    }, 300);
  }, []);

  const playChordTone = useCallback((chord: ChordData, duration = 2.5) => {
    if (isPlayingRef.current) stopTone();

    const ctx = contextRef.current ?? new AudioContext();
    contextRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);

    const oscs: OscillatorNode[] = [];
    const now = ctx.currentTime;

    // Collect active strings
    const activeStrings: { midi: number; stringIdx: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const fret = chord.frets[i];
      if (fret < 0) continue;
      activeStrings.push({ midi: OPEN_STRING_MIDI[i] + fret, stringIdx: i });
    }

    if (activeStrings.length === 0) return;

    // Volume balancing: louder per string when fewer strings active
    const perStringGain = Math.min(0.9, 1.2 / activeStrings.length);

    activeStrings.forEach(({ midi, stringIdx }, idx) => {
      const freq = midiToFreq(midi);

      // Stagger: 15ms per active string (strum simulation)
      const strumDelay = idx * 0.015;
      const startTime = now + strumDelay;

      // Primary oscillator: triangle wave
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      // Natural detuning per string for realism
      osc.detune.value = (stringIdx - 2.5) * 1.2;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, startTime);
      env.gain.exponentialRampToValueAtTime(perStringGain, startTime + 0.04);      // 40ms attack
      env.gain.setValueAtTime(perStringGain, startTime + 0.04);
      env.gain.exponentialRampToValueAtTime(perStringGain * 0.6, startTime + duration * 0.4);  // sustain decay
      env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);          // release

      osc.connect(env);
      env.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);

      oscs.push(osc);

      // 2nd harmonic: quiet sine at octave above for warmth
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      osc2.detune.value = (stringIdx - 2.5) * 0.8;

      const env2 = ctx.createGain();
      env2.gain.setValueAtTime(0.001, startTime);
      env2.gain.exponentialRampToValueAtTime(perStringGain * 0.15, startTime + 0.04);  // 15% of main volume
      env2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);       // dies at 70% duration

      osc2.connect(env2);
      env2.connect(masterGain);
      osc2.start(startTime);
      osc2.stop(startTime + duration + 0.1);

      oscs.push(osc2);
    });

    activeNodesRef.current = { oscs, master: masterGain };
    isPlayingRef.current = true;

    // Auto-cleanup timer
    timeoutRef.current = setTimeout(() => {
      activeNodesRef.current = null;
      isPlayingRef.current = false;
      timeoutRef.current = null;
    }, (duration + 0.3) * 1000);
  }, [stopTone]);

  return { playChordTone, stopTone, isPlaying: isPlayingRef };
}
```

### Key differences from useChordAudio:
| Property | useChordAudio | useReferenceTone |
|----------|--------------|------------------|
| Oscillators per string | 3 (triangle + sine octave + sine sub) | 2 (triangle + sine octave) |
| Filter | Low-pass filter with sweep | No filter |
| Strum delay | 35ms per string | 15ms per string |
| Master volume | User-controlled via audioStore | Fixed at 0.18 |
| Attack time | 8ms (main), 5ms (harmonic) | 40ms |
| Envelope shape | Fast pluck, quick decay | Sustained with gradual decay |
| Detune | None | Per-string: `(stringIdx - 2.5) * 1.2` cents |
| Sub harmonic | Yes (0.5× freq) | No |
| Duration | Fixed 2.5s | Configurable (default 2.5s) |
| Auto-cleanup | No (manual via stopCurrent) | Yes (setTimeout after duration) |
| Volume balancing | Bass strings louder: `0.3 - i*0.015` | Inversely proportional to string count: `min(0.9, 1.2/count)` |

---

## 7. Volume Control Component — VolumeControl.tsx

File: `src/components/features/VolumeControl.tsx`

```typescript
import { useAudioStore } from '@/stores/audioStore';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  compact?: boolean;
}

export default function VolumeControl({ compact = false }: VolumeControlProps) {
  const { volume, muted, setVolume, toggleMute } = useAudioStore();

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <button
        onClick={toggleMute}
        className={`
          flex items-center justify-center rounded-md transition-colors
          ${compact ? 'size-8' : 'size-9'}
          ${muted
            ? 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)]'
            : 'text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)]'
          }
        `}
        title={muted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className={compact ? 'size-4' : 'size-[18px]'} />
      </button>

      <div className="relative flex items-center group">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className={`volume-slider ${compact ? 'w-28 sm:w-24' : 'w-28'}`}
          aria-label="Volume"
        />
      </div>

      {!compact && (
        <span className="min-w-[32px] text-right text-xs font-body text-[hsl(var(--text-muted))] tabular-nums">
          {muted ? '0' : Math.round(volume * 100)}%
        </span>
      )}
    </div>
  );
}
```

### Icon logic:
- `VolumeX`: when `muted === true` OR `volume === 0`
- `Volume1`: when `volume < 0.5`
- `Volume2`: when `volume >= 0.5`

### Compact mode differences:
- Button size: `size-8` (compact) vs `size-9` (normal)
- Icon size: `size-4` (compact) vs `size-[18px]` (normal)
- Slider width: `w-28 sm:w-24` (compact) vs `w-28` (normal)
- Gap: `gap-2` (compact) vs `gap-3` (normal)
- Percentage label: hidden in compact mode

### Range input behavior:
- When muted, the slider shows `0` but the stored volume is preserved
- Moving the slider from 0 unmutes automatically (via `setVolume` logic)

---

## 8. Audio Routing Topology

### useChordAudio routing (per string):
```
osc1 (triangle @ freq)     → mainGain    ─┐
osc2 (sine @ freq × 2)     → harmonicGain ─┤→ lowpass filter → masterGain → destination
osc3 (sine @ freq × 0.5)   → subGain      ─┘
```

### useReferenceTone routing (per string):
```
osc1 (triangle @ freq)     → env1  ─┐
                                     ├→ masterGain → destination
osc2 (sine @ freq × 2)     → env2  ─┘
```

### Master gain calculation:
- **useChordAudio**: `Math.pow(effectiveVolume, 1.2) * 8`
- **useReferenceTone**: Fixed `0.18` (not user-controllable)

---

## 9. Oscillator Synthesis Details

### useChordAudio — per string (3 oscillators):

| Oscillator | Waveform | Frequency | Purpose |
|-----------|----------|-----------|---------|
| osc1 | `triangle` | `freq` | Main warm tone |
| osc2 | `sine` | `freq × 2` | Octave brightness |
| osc3 | `sine` | `freq × 0.5` | Sub-harmonic body |

### useReferenceTone — per string (2 oscillators):

| Oscillator | Waveform | Frequency | Detune |
|-----------|----------|-----------|--------|
| osc1 | `triangle` | `midiToFreq(midi)` | `(stringIdx - 2.5) * 1.2` cents |
| osc2 | `sine` | `freq × 2` | `(stringIdx - 2.5) * 0.8` cents |

Detune values per string (reference tone only):
- String 0: -3.0 cents (primary), -2.0 cents (harmonic)
- String 1: -1.8, -1.2
- String 2: -0.6, -0.4
- String 3: +0.6, +0.4
- String 4: +1.8, +1.2
- String 5: +3.0, +2.0

---

## 10. Gain Envelope Specifications

### useChordAudio envelopes:

**Main gain (osc1)**:
```
t=0          → 0.000 (setValueAtTime)
t=0 + 8ms   → volume × 0.45 (linearRamp)
t=0 + 120ms → volume × 0.18 (exponentialRamp)
t=0 + 2.5s  → 0.001 (exponentialRamp)
```

**Harmonic gain (osc2)**:
```
t=0          → 0.000
t=0 + 5ms   → volume × 0.08 (linearRamp)
t=0 + 1.25s → 0.001 (exponentialRamp)  // duration * 0.5
```

**Sub gain (osc3)**:
```
t=0          → 0.000
t=0 + 10ms  → volume × 0.12 (linearRamp)
t=0 + 1.75s → 0.001 (exponentialRamp)  // duration * 0.7
```

### useReferenceTone envelopes:

**Primary (osc1)**:
```
t=0          → 0.001 (setValueAtTime)
t=0 + 40ms  → perStringGain (exponentialRamp)
t=0 + 40ms  → perStringGain (setValueAtTime — hold)
t=0 + 1.0s  → perStringGain × 0.6 (exponentialRamp)  // duration * 0.4
t=0 + 2.5s  → 0.001 (exponentialRamp)
```

**Harmonic (osc2)**:
```
t=0          → 0.001 (setValueAtTime)
t=0 + 40ms  → perStringGain × 0.15 (exponentialRamp)
t=0 + 1.75s → 0.001 (exponentialRamp)  // duration * 0.7
```

---

## 11. Filter Specifications

Only `useChordAudio` uses filters.

### Low-pass filter per string:
- **Type**: `'lowpass'`
- **Initial frequency**: `Math.min(frequency × 6, 5000)` Hz
- **Sweeps to**: `Math.min(frequency × 2, 2000)` Hz over `duration × 0.4` seconds
- **Q factor**: `1.2` (constant)
- **Purpose**: Simulates the natural brightness decay of a plucked string

Example for A2 (110 Hz):
- Initial cutoff: 660 Hz (110 × 6)
- Final cutoff: 220 Hz (110 × 2)
- Sweep time: 1.0 seconds (2.5 × 0.4)

Example for E4 (329.63 Hz):
- Initial cutoff: 1977.8 Hz (329.63 × 6, capped at 5000)
- Final cutoff: 659.3 Hz (329.63 × 2, capped at 2000)
- Sweep time: 1.0 seconds

---

## 12. Timing and Strum Simulation

### useChordAudio strum:
- Direction: Low E (string 0) → High E (string 5)
- Delay: **35ms per active string** (muted strings don't contribute to delay)
- Example for G Major (frets [3, 2, 0, 0, 3, 3], all 6 strings active):
  - String 0: t = now + 0ms
  - String 1: t = now + 35ms
  - String 2: t = now + 70ms
  - String 3: t = now + 105ms
  - String 4: t = now + 140ms
  - String 5: t = now + 175ms
- Example for C Major (frets [-1, 3, 2, 0, 1, 0], string 0 muted):
  - String 1: t = now + 0ms (strumIndex 0)
  - String 2: t = now + 35ms (strumIndex 1)
  - String 3: t = now + 70ms
  - String 4: t = now + 105ms
  - String 5: t = now + 140ms

### useReferenceTone strum:
- Direction: Same (low to high)
- Delay: **15ms per active string**
- Example for G Major: 0, 15, 30, 45, 60, 75ms

### Lookahead:
- useChordAudio: `ctx.currentTime + 0.05` (50ms)
- useReferenceTone: `ctx.currentTime` (immediate)

---

## 13. Volume Curve and Master Gain

### useChordAudio master gain formula:
```
masterGain.value = Math.pow(effectiveVolume, 1.2) * 8
```

| Volume Slider | Effective Volume | Master Gain |
|--------------|-----------------|-------------|
| 0% | 0.00 | 0.000 (skipped) |
| 25% | 0.25 | 1.590 |
| 50% | 0.50 | 3.482 |
| 70% (default) | 0.70 | 5.183 |
| 75% | 0.75 | 5.623 |
| 100% | 1.00 | 8.000 |

The exponent `1.2` provides a slight upward curve for perceived loudness linearity. The multiplier `8` provides adequate loudness on mobile devices.

### useReferenceTone master gain:
- Fixed: `0.18`
- Not affected by user volume setting
- Rationale: reference tones should play at a consistent, moderate volume regardless of practice volume

---

## 14. String Frequency Model

### useChordAudio frequency calculation:
```
frequency = STRING_FREQUENCIES[stringIndex] * Math.pow(2, fret / 12)
```

Where `STRING_FREQUENCIES = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]`

### useReferenceTone frequency calculation:
```
midi = OPEN_STRING_MIDI[stringIndex] + fret
frequency = 440 * Math.pow(2, (midi - 69) / 12)
```

Where `OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64]`

Both formulas produce mathematically equivalent results (equal temperament tuning), just computed differently. The MIDI approach in the reference tone hook is used because it's more standard for music theory calculations.

---

## 15. MIDI-to-Frequency Conversion

```
A4 = 440 Hz = MIDI note 69
frequency = 440 * 2^((midi - 69) / 12)
```

| String (open) | MIDI | Frequency |
|--------------|------|-----------|
| 6th (low E) | 40 | 82.41 Hz |
| 5th (A) | 45 | 110.00 Hz |
| 4th (D) | 50 | 146.83 Hz |
| 3rd (G) | 55 | 196.00 Hz |
| 2nd (B) | 59 | 246.94 Hz |
| 1st (high E) | 64 | 329.63 Hz |

Each fret adds 1 to the MIDI number (1 semitone = 1 MIDI step).

---

## 16. Reference Tone Per-String Balancing

```
perStringGain = Math.min(0.9, 1.2 / activeStrings.length)
```

| Active Strings | perStringGain |
|---------------|--------------|
| 1 | 0.90 (capped) |
| 2 | 0.60 |
| 3 | 0.40 |
| 4 | 0.30 |
| 5 | 0.24 |
| 6 | 0.20 |

This prevents clipping when all 6 strings play simultaneously while keeping solo strings audible.

---

## 17. Reference Tone Lifecycle Management

### stopTone() behavior:
1. Clear any pending auto-cleanup timeout
2. Cancel all scheduled gain values on master gain
3. Set current master gain value explicitly (to avoid glitches)
4. Exponential ramp master gain to 0.001 over 250ms (fade out)
5. After 300ms delay: stop and disconnect all oscillators, disconnect master gain
6. Set `isPlayingRef` to false, clear `activeNodesRef`

### playChordTone() behavior:
1. If already playing, call `stopTone()` first
2. Create or reuse AudioContext
3. Resume if suspended
4. Create master gain at 0.18
5. For each active string: create oscillator pair, apply envelopes
6. Set auto-cleanup timeout at `(duration + 0.3) * 1000` ms

### AudioContext reuse:
- `useChordAudio`: Creates new context if closed, reuses if open
- `useReferenceTone`: Creates new context on first call, reuses thereafter

---

## 18. localStorage Persistence Schema

**Key**: `fretmaster-audio`

**Value** (JSON):
```json
{
  "volume": 0.7,
  "muted": false
}
```

**Load behavior**:
- If key missing: defaults to `{ volume: 0.7, muted: false }`
- If JSON parse fails: defaults to `{ volume: 0.7, muted: false }`
- Volume clamped to `[0, 1]` range on load
- Muted must be boolean, defaults to `false`

**Save behavior**:
- Written on every `setVolume()` and `toggleMute()` call
- `setVolume(0)` saves `{ volume: 0, muted: true }`

---

## 19. Integration Points

### Where playChord is used:
- **Practice page**: Play button in the bottom toolbar plays the current chord
- **Chord Library**: Tapping a chord card plays it
- **Chord Detail Modal**: Play button on chord detail view

### Where playChordTone is used:
- **Practice page**: Reference tone button in the toolbar
- Plays at a fixed moderate volume (0.18) regardless of user volume

### Where VolumeControl is used:
- **Practice page bottom toolbar**: `compact={true}`
- **Header/settings areas**: `compact={false}`

### Where audioStore is consumed:
- `useChordAudio.ts`: reads `getEffectiveVolume` for playback volume
- `VolumeControl.tsx`: reads/writes `volume`, `muted`, `setVolume`, `toggleMute`

---

## 20. CSS Requirements for Volume Slider

The volume slider uses a custom CSS class `volume-slider`. Add these styles to your global CSS:

```css
/* Volume slider styling */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: hsl(var(--border-default));
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: hsl(var(--color-primary));
  cursor: pointer;
  transition: transform 0.15s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: hsl(var(--color-primary));
  border: none;
  cursor: pointer;
}

.volume-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: hsl(var(--border-default));
}
```

---

## 21. Edge Cases and Error Handling

1. **Muted playback**: When `getEffectiveVolume()` returns 0, `playChord` exits immediately without creating any AudioContext or oscillators
2. **All strings muted**: If a chord has all `-1` frets, no oscillators are created (graceful no-op). In reference tone, the function returns early if `activeStrings.length === 0`
3. **Rapid successive plays**: `stopCurrent()` is called before each new chord play, stopping all active oscillators
4. **AudioContext suspension**: Both hooks check for suspended state and call `ctx.resume()` (required for browsers that suspend audio until user gesture)
5. **AudioContext closure**: `useChordAudio` creates a new context if the existing one is closed
6. **stopTone safety**: All stop/disconnect calls are wrapped in try-catch to handle already-stopped oscillators
7. **Reference tone overlap**: If `playChordTone` is called while already playing, `stopTone()` is called first to prevent overlapping tones

---

## 22. Verification Checklist

- [ ] `useChordAudio.playChord(chord)` produces audible strummed chord with 35ms per-string delay
- [ ] Muted strings (fret `-1`) produce no sound and do not affect strum timing of other strings
- [ ] Bass strings are slightly louder than treble strings
- [ ] Each string has 3 oscillators (triangle + sine octave + sine sub-harmonic)
- [ ] Low-pass filter sweeps from high to low cutoff over first 40% of duration
- [ ] `useReferenceTone.playChordTone(chord)` produces sustained clean tone with 15ms strum delay
- [ ] Reference tone has slight per-string detuning for realism
- [ ] Reference tone volume is fixed at 0.18 regardless of user volume setting
- [ ] Volume slider persists to localStorage under key `fretmaster-audio`
- [ ] Moving volume to 0 auto-mutes; moving from 0 auto-unmutes
- [ ] Mute toggle preserves volume value
- [ ] Volume icon changes between VolumeX, Volume1, Volume2 at correct thresholds
- [ ] Compact mode hides percentage label and uses smaller sizes
- [ ] Calling `playChord` while another chord is playing stops the previous one cleanly
- [ ] Calling `playChordTone` while reference tone is playing fades out previous tone in 250ms
- [ ] Reference tone auto-cleans up after `(duration + 0.3)` seconds
- [ ] All chord frequencies match equal temperament tuning for standard guitar tuning
- [ ] Master gain for chord playback follows `Math.pow(vol, 1.2) * 8` curve

---

## 23. Assumptions

1. **Browser environment**: Web Audio API is available (modern browsers). No polyfill needed.
2. **User gesture**: AudioContext creation/resume is triggered by user interaction (button click), satisfying autoplay policies.
3. **Standard tuning only**: The system assumes E-A-D-G-B-E tuning. No alternate tuning support.
4. **Equal temperament**: All frequency calculations use 12-TET (12 equal divisions of the octave).
5. **No sample files**: All audio is synthesized from oscillators. No WAV/MP3/FLAC files are loaded for chord playback.
6. **The `frets` array in ChordData stores absolute fret numbers** — the `baseFret` field is used only for visual diagram rendering, NOT for frequency calculation.
7. **Zustand version**: Compatible with Zustand v4+ (uses `create<T>()` pattern without persist middleware for audioStore).
8. **CSS variables**: The component uses HSL-based CSS custom properties (e.g., `--color-primary`, `--text-muted`, `--border-default`) defined in the app's design system.
9. **lucide-react**: Volume icons (`Volume2`, `Volume1`, `VolumeX`) are imported from the lucide-react icon library.
10. **The reference tone does NOT use the audioStore volume** — this is intentional so users can hear the reference at a consistent level regardless of their practice volume setting.
