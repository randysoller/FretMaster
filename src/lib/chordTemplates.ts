/**
 * Adaptive weighted harmonic chord templates.
 *
 * Instead of flat binary pitch-class sets (where every note in a chord has
 * equal weight), these templates assign weights based on:
 *   - Root note prominence (strongest — always 1.0)
 *   - Fifth (strong harmonic reinforcement — 0.8–0.9)
 *   - Third / quality-defining interval (0.7–0.85)
 *   - Extensions (7ths, 9ths, 11ths, 13ths — 0.4–0.65)
 *   - Barre chord damping factors (reduced high-string weight)
 *
 * This dramatically improves cosine similarity matching because the template
 * shape now mirrors real guitar spectral energy distribution.
 */

import type { ChordData, ChordType } from '@/types/chord';

// Standard guitar tuning MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

/** Note names → pitch class index (0 = C, 1 = C#, …, 11 = B) */
const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, 'E#': 5, Fb: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
  B: 11, 'B#': 0, Cb: 11,
};

/** Interval weights per chord quality — defines the "ideal" spectral shape. */
interface IntervalWeights {
  root: number;
  third: number;    // major or minor 3rd
  fifth: number;    // perfect, augmented, or diminished 5th
  seventh?: number;
  ninth?: number;
  eleventh?: number;
  thirteenth?: number;
}

const QUALITY_WEIGHTS: Record<ChordType, IntervalWeights> = {
  major:      { root: 1.0, third: 0.75, fifth: 0.85 },
  minor:      { root: 1.0, third: 0.80, fifth: 0.85 },
  augmented:  { root: 1.0, third: 0.75, fifth: 0.80 },
  diminished: { root: 1.0, third: 0.80, fifth: 0.80 },
  suspended:  { root: 1.0, third: 0.70, fifth: 0.85 },  // "third" = sus2/sus4 tone
  major7:     { root: 1.0, third: 0.70, fifth: 0.80, seventh: 0.55 },
  dominant7:  { root: 1.0, third: 0.70, fifth: 0.78, seventh: 0.60 },
  minor7:     { root: 1.0, third: 0.75, fifth: 0.80, seventh: 0.55 },
  aug7:       { root: 1.0, third: 0.70, fifth: 0.75, seventh: 0.55 },
  halfDim7:   { root: 1.0, third: 0.75, fifth: 0.78, seventh: 0.55 },
  dim7:       { root: 1.0, third: 0.78, fifth: 0.78, seventh: 0.55 },
  slash:      { root: 1.0, third: 0.75, fifth: 0.85 },
  '9th':      { root: 1.0, third: 0.65, fifth: 0.75, seventh: 0.50, ninth: 0.45 },
  '11th':     { root: 1.0, third: 0.60, fifth: 0.70, seventh: 0.45, ninth: 0.40, eleventh: 0.40 },
  '13th':     { root: 1.0, third: 0.60, fifth: 0.68, seventh: 0.45, ninth: 0.38, eleventh: 0.35, thirteenth: 0.42 },
};

/**
 * Build a 12-bin weighted template from a chord's actual frets.
 * Each pitch class gets a weight based on:
 *   1. Its role in the chord (root > 5th > 3rd > extensions)
 *   2. How many strings produce it (doubled notes get accumulated weight)
 *   3. String register (lower strings carry more fundamental energy)
 */
export function buildWeightedTemplate(chord: ChordData): Float64Array {
  const template = new Float64Array(12);

  // Determine the root pitch class from the chord definition
  const rootPc = getRootPitchClass(chord);
  const qualityWeights = QUALITY_WEIGHTS[chord.type] ?? QUALITY_WEIGHTS.major;

  // Collect all pitch classes with string-position weights
  const pcOccurrences = new Map<number, number>();

  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue; // muted string
    const midi = OPEN_STRING_MIDI[i] + fret;
    const pc = ((midi % 12) + 12) % 12;

    // Lower strings (0=low E, 1=A) carry more fundamental weight
    const stringWeight = 1.0 - (i * 0.08); // 1.0, 0.92, 0.84, 0.76, 0.68, 0.60

    const existing = pcOccurrences.get(pc) ?? 0;
    pcOccurrences.set(pc, existing + stringWeight);
  }

  // Assign role-based weights to each pitch class
  for (const [pc, stringAccum] of pcOccurrences) {
    const role = classifyRole(pc, rootPc, chord.type);
    const roleWeight = getRoleWeight(role, qualityWeights);

    // Combine role importance with string accumulation (capped)
    template[pc] = roleWeight * Math.min(stringAccum, 2.5);
  }

  // Normalize to peak = 1.0
  const maxVal = Math.max(...template);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      template[i] /= maxVal;
    }
  }

  return template;
}

/**
 * Compute weighted cosine similarity between a detected chroma and
 * a weighted template. This replaces the old flat binary matching.
 */
export function weightedCosineSimilarity(
  chroma: Float64Array,
  template: Float64Array
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 12; i++) {
    dot += chroma[i] * template[i];
    normA += chroma[i] * chroma[i];
    normB += template[i] * template[i];
  }

  return (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

/**
 * Compute Euclidean distance between normalized chroma and template.
 * Lower = better match.
 */
export function chromaDistance(
  chroma: Float64Array,
  template: Float64Array
): number {
  let sumSq = 0;
  for (let i = 0; i < 12; i++) {
    const diff = chroma[i] - template[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Enhanced match function using weighted templates.
 * Combines weighted cosine similarity with binary hit ratio and
 * penalizes unexpected pitch classes.
 */
export function matchWithWeightedTemplate(
  chroma: Float64Array,
  chord: ChordData,
  sensitivity: number
): { isMatch: boolean; confidence: number } {
  const t = (sensitivity - 1) / 9; // 0..1
  const template = buildWeightedTemplate(chord);

  // 1. Weighted cosine similarity
  const wCosine = weightedCosineSimilarity(chroma, template);

  // 2. Binary pitch class coverage
  const chromaThreshold = lerp(0.25, 0.08, t);
  const expectedPcs = getChordPitchClasses(chord);
  let hits = 0;
  for (const pc of expectedPcs) {
    if (chroma[pc] >= chromaThreshold * 0.6) hits++;
  }
  const coverage = expectedPcs.size > 0 ? hits / expectedPcs.size : 0;

  // 3. Extra note penalty (pitch classes active but not in chord)
  const detected = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= chromaThreshold) detected.add(i);
  }
  const extras = [...detected].filter(pc => !expectedPcs.has(pc)).length;
  const maxExtras = Math.floor(lerp(2, 5, t)) + expectedPcs.size;
  const extraPenalty = extras > maxExtras ? (extras - maxExtras) * lerp(0.08, 0.02, t) : 0;

  // 4. Combined score — weighted cosine is the primary signal
  const combined = (wCosine * 0.55) + (coverage * 0.45) - extraPenalty;

  // Adaptive threshold
  const matchThreshold = lerp(0.62, 0.32, t);

  // Minimum detected notes requirement
  const minDetected = Math.min(2, expectedPcs.size);
  if (hits < minDetected) {
    return { isMatch: false, confidence: combined };
  }

  return {
    isMatch: combined >= matchThreshold,
    confidence: Math.min(1.0, combined),
  };
}

// ─── Helpers ───

function getRootPitchClass(chord: ChordData): number {
  // Try to extract root from symbol (first 1-2 chars)
  const sym = chord.symbol.replace(/\(.+\)/, '');
  let rootName = '';

  if (sym.length >= 2 && (sym[1] === '#' || sym[1] === 'b')) {
    rootName = sym.substring(0, 2);
  } else if (sym.length >= 1) {
    rootName = sym[0];
  }

  // Handle slash chords — root is before the slash
  if (sym.includes('/')) {
    const parts = sym.split('/');
    rootName = parts[0];
    if (rootName.length >= 2 && (rootName[1] === '#' || rootName[1] === 'b')) {
      rootName = rootName.substring(0, 2);
    } else {
      rootName = rootName[0];
    }
  }

  return NOTE_TO_PC[rootName] ?? 0;
}

function getChordPitchClasses(chord: ChordData): Set<number> {
  const pc = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue;
    const midi = OPEN_STRING_MIDI[i] + fret;
    pc.add(((midi % 12) + 12) % 12);
  }
  return pc;
}

type NoteRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ninth' | 'eleventh' | 'thirteenth' | 'other';

/** Classify a pitch class's role relative to the root and chord type. */
function classifyRole(pc: number, rootPc: number, _type: ChordType): NoteRole {
  const interval = ((pc - rootPc) + 12) % 12;

  switch (interval) {
    case 0: return 'root';
    case 1: return 'ninth';       // b9
    case 2: return 'ninth';       // 9
    case 3: return 'third';       // minor 3rd
    case 4: return 'third';       // major 3rd
    case 5: return 'eleventh';    // 11 / sus4
    case 6: return 'fifth';       // dim5 / #11
    case 7: return 'fifth';       // perfect 5th
    case 8: return 'fifth';       // aug5 / b13
    case 9: return 'thirteenth';  // 13 / 6th
    case 10: return 'seventh';    // b7
    case 11: return 'seventh';    // maj7
    default: return 'other';
  }
}

function getRoleWeight(role: NoteRole, weights: IntervalWeights): number {
  switch (role) {
    case 'root':       return weights.root;
    case 'third':      return weights.third;
    case 'fifth':      return weights.fifth;
    case 'seventh':    return weights.seventh ?? 0.45;
    case 'ninth':      return weights.ninth ?? 0.40;
    case 'eleventh':   return weights.eleventh ?? 0.35;
    case 'thirteenth': return weights.thirteenth ?? 0.40;
    case 'other':      return 0.30;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
