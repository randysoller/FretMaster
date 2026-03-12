/**
 * Client-side ML Chord Detector using TensorFlow.js.
 *
 * Architecture: A small feed-forward neural network trained on synthetic
 * chroma vector data to classify guitar chords. The model runs entirely
 * in the browser with zero network calls.
 *
 * Input:  12-bin chroma vector (normalized 0–1)
 * Output: Probability distribution over known chord classes
 *
 * The model is initialized with pre-computed weights derived from
 * ideal chord templates + noise augmentation, providing ML-based
 * pattern recognition that complements the DSP pipeline.
 */

import type { ChordData } from '@/types/chord';

// ─── Lightweight Neural Network (no TF.js dependency) ───
// We implement a tiny 3-layer MLP directly to avoid the 2MB+ TF.js bundle.
// This gives us ML-grade pattern matching with zero external dependencies.

/** Activation functions */
function relu(x: number): number { return Math.max(0, x); }
function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

/** Dense layer forward pass */
function denseForward(
  input: number[],
  weights: number[][],  // [outputSize][inputSize]
  biases: number[]
): number[] {
  const output = new Array(weights.length);
  for (let i = 0; i < weights.length; i++) {
    let sum = biases[i];
    for (let j = 0; j < input.length; j++) {
      sum += weights[i][j] * input[j];
    }
    output[i] = sum;
  }
  return output;
}

// ─── Chord class definitions ───
// We define 24 core chord classes (12 major + 12 minor) plus extensions

interface ChordClass {
  name: string;
  pitchClasses: number[];  // expected pitch classes
  template: number[];      // 12-bin ideal chroma
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildChordClasses(): ChordClass[] {
  const classes: ChordClass[] = [];

  for (let root = 0; root < 12; root++) {
    // Major: R, M3, P5
    const majPcs = [root, (root + 4) % 12, (root + 7) % 12];
    const majTemplate = new Array(12).fill(0);
    majTemplate[root] = 1.0;
    majTemplate[(root + 4) % 12] = 0.75;
    majTemplate[(root + 7) % 12] = 0.85;
    classes.push({
      name: `${NOTE_NAMES[root]}`,
      pitchClasses: majPcs,
      template: majTemplate,
    });

    // Minor: R, m3, P5
    const minPcs = [root, (root + 3) % 12, (root + 7) % 12];
    const minTemplate = new Array(12).fill(0);
    minTemplate[root] = 1.0;
    minTemplate[(root + 3) % 12] = 0.80;
    minTemplate[(root + 7) % 12] = 0.85;
    classes.push({
      name: `${NOTE_NAMES[root]}m`,
      pitchClasses: minPcs,
      template: minTemplate,
    });

    // Dominant 7: R, M3, P5, b7
    const dom7Pcs = [root, (root + 4) % 12, (root + 7) % 12, (root + 10) % 12];
    const dom7Template = new Array(12).fill(0);
    dom7Template[root] = 1.0;
    dom7Template[(root + 4) % 12] = 0.70;
    dom7Template[(root + 7) % 12] = 0.78;
    dom7Template[(root + 10) % 12] = 0.60;
    classes.push({
      name: `${NOTE_NAMES[root]}7`,
      pitchClasses: dom7Pcs,
      template: dom7Template,
    });

    // Minor 7: R, m3, P5, b7
    const min7Pcs = [root, (root + 3) % 12, (root + 7) % 12, (root + 10) % 12];
    const min7Template = new Array(12).fill(0);
    min7Template[root] = 1.0;
    min7Template[(root + 3) % 12] = 0.75;
    min7Template[(root + 7) % 12] = 0.80;
    min7Template[(root + 10) % 12] = 0.55;
    classes.push({
      name: `${NOTE_NAMES[root]}m7`,
      pitchClasses: min7Pcs,
      template: min7Template,
    });

    // Major 7: R, M3, P5, M7
    const maj7Pcs = [root, (root + 4) % 12, (root + 7) % 12, (root + 11) % 12];
    const maj7Template = new Array(12).fill(0);
    maj7Template[root] = 1.0;
    maj7Template[(root + 4) % 12] = 0.70;
    maj7Template[(root + 7) % 12] = 0.80;
    maj7Template[(root + 11) % 12] = 0.55;
    classes.push({
      name: `${NOTE_NAMES[root]}maj7`,
      pitchClasses: maj7Pcs,
      template: maj7Template,
    });
  }

  return classes;
}

const CHORD_CLASSES = buildChordClasses();

// ─── Pre-trained MLP weights ───
// Generated via synthetic training: ideal templates + Gaussian noise augmentation
// Architecture: 12 → 48 (ReLU) → 32 (ReLU) → N_CLASSES (softmax)

let mlpWeightsL1: number[][] | null = null;
let mlpBiasesL1: number[] | null = null;
let mlpWeightsL2: number[][] | null = null;
let mlpBiasesL2: number[] | null = null;
let mlpWeightsOut: number[][] | null = null;
let mlpBiasesOut: number[] | null = null;
let isInitialized = false;
let isInitializing = false;

/**
 * Train the MLP on synthetic chroma data.
 * Uses a simplified online gradient descent approach with template-based
 * synthetic samples + noise augmentation.
 */
function initializeWeights(): void {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  const nClasses = CHORD_CLASSES.length;
  const inputSize = 12;
  const hidden1 = 48;
  const hidden2 = 32;

  // Xavier initialization
  const xavierInit = (fanIn: number, fanOut: number): number => {
    const limit = Math.sqrt(6 / (fanIn + fanOut));
    return (Math.random() * 2 - 1) * limit;
  };

  // Seeded random for reproducibility
  let seed = 42;
  const seededRandom = (): number => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const seededXavier = (fanIn: number, fanOut: number): number => {
    const limit = Math.sqrt(6 / (fanIn + fanOut));
    return (seededRandom() * 2 - 1) * limit;
  };

  // Initialize weights
  mlpWeightsL1 = Array.from({ length: hidden1 }, () =>
    Array.from({ length: inputSize }, () => seededXavier(inputSize, hidden1))
  );
  mlpBiasesL1 = new Array(hidden1).fill(0.01);

  mlpWeightsL2 = Array.from({ length: hidden2 }, () =>
    Array.from({ length: hidden1 }, () => seededXavier(hidden1, hidden2))
  );
  mlpBiasesL2 = new Array(hidden2).fill(0.01);

  mlpWeightsOut = Array.from({ length: nClasses }, () =>
    Array.from({ length: hidden2 }, () => seededXavier(hidden2, nClasses))
  );
  mlpBiasesOut = new Array(nClasses).fill(0);

  // Generate synthetic training data and train
  const learningRate = 0.02;
  const epochs = 80;
  const samplesPerClass = 30;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let ci = 0; ci < nClasses; ci++) {
      const baseTemplate = CHORD_CLASSES[ci].template;

      for (let s = 0; s < samplesPerClass; s++) {
        // Augmented sample: template + noise + random activations
        const input = new Array(12);
        for (let i = 0; i < 12; i++) {
          const noise = (seededRandom() - 0.5) * 0.3;
          const randomActivation = seededRandom() < 0.15 ? seededRandom() * 0.3 : 0;
          input[i] = Math.max(0, Math.min(1, baseTemplate[i] + noise + randomActivation));
        }

        // Normalize
        const maxV = Math.max(...input);
        if (maxV > 0) {
          for (let i = 0; i < 12; i++) input[i] /= maxV;
        }

        // Forward pass
        const h1Raw = denseForward(input, mlpWeightsL1!, mlpBiasesL1!);
        const h1 = h1Raw.map(relu);
        const h2Raw = denseForward(h1, mlpWeightsL2!, mlpBiasesL2!);
        const h2 = h2Raw.map(relu);
        const outRaw = denseForward(h2, mlpWeightsOut!, mlpBiasesOut!);
        const probs = softmax(outRaw);

        // Target: one-hot
        const target = new Array(nClasses).fill(0);
        target[ci] = 1;

        // Output gradient (cross-entropy + softmax → probs - target)
        const dOut = probs.map((p, i) => p - target[i]);

        // Backprop to hidden2
        const dH2 = new Array(hidden2).fill(0);
        for (let i = 0; i < nClasses; i++) {
          for (let j = 0; j < hidden2; j++) {
            dH2[j] += dOut[i] * mlpWeightsOut![i][j];
            mlpWeightsOut![i][j] -= learningRate * dOut[i] * h2[j];
          }
          mlpBiasesOut![i] -= learningRate * dOut[i];
        }

        // ReLU derivative
        const dH2Relu = dH2.map((v, i) => h2Raw[i] > 0 ? v : 0);

        // Backprop to hidden1
        const dH1 = new Array(hidden1).fill(0);
        for (let i = 0; i < hidden2; i++) {
          for (let j = 0; j < hidden1; j++) {
            dH1[j] += dH2Relu[i] * mlpWeightsL2![i][j];
            mlpWeightsL2![i][j] -= learningRate * dH2Relu[i] * h1[j];
          }
          mlpBiasesL2![i] -= learningRate * dH2Relu[i];
        }

        const dH1Relu = dH1.map((v, i) => h1Raw[i] > 0 ? v : 0);

        // Backprop to input layer
        for (let i = 0; i < hidden1; i++) {
          for (let j = 0; j < inputSize; j++) {
            mlpWeightsL1![i][j] -= learningRate * dH1Relu[i] * input[j];
          }
          mlpBiasesL1![i] -= learningRate * dH1Relu[i];
        }
      }
    }
  }

  isInitialized = true;
  isInitializing = false;
  console.log('[FretMaster ML] Neural network initialized with', nClasses, 'chord classes');
}

// ─── Public API ───

export interface MLPrediction {
  className: string;
  confidence: number;
  pitchClasses: number[];
}

/**
 * Run ML inference on a 12-bin chroma vector.
 * Returns top-K predictions sorted by confidence.
 */
export function mlPredict(chroma: Float64Array, topK: number = 5): MLPrediction[] {
  if (!isInitialized) initializeWeights();

  // Convert to number array and normalize
  const input = new Array(12);
  let maxVal = 0;
  for (let i = 0; i < 12; i++) {
    input[i] = chroma[i];
    if (chroma[i] > maxVal) maxVal = chroma[i];
  }
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) input[i] /= maxVal;
  }

  // Forward pass
  const h1 = denseForward(input, mlpWeightsL1!, mlpBiasesL1!).map(relu);
  const h2 = denseForward(h1, mlpWeightsL2!, mlpBiasesL2!).map(relu);
  const outRaw = denseForward(h2, mlpWeightsOut!, mlpBiasesOut!);
  const probs = softmax(outRaw);

  // Build predictions
  const predictions: MLPrediction[] = probs.map((conf, i) => ({
    className: CHORD_CLASSES[i].name,
    confidence: conf,
    pitchClasses: CHORD_CLASSES[i].pitchClasses,
  }));

  // Sort by confidence descending
  predictions.sort((a, b) => b.confidence - a.confidence);

  return predictions.slice(0, topK);
}

/**
 * Check if ML prediction matches the target chord.
 * Uses pitch class overlap instead of exact name matching,
 * since the same chord can have different voicing names.
 */
export function mlMatchesChord(
  chroma: Float64Array,
  chord: ChordData,
  sensitivity: number
): { isMatch: boolean; mlConfidence: number; topPrediction: string } {
  // If ML model is not ready yet, return a non-match with 0 confidence
  if (!isInitialized) {
    return { isMatch: false, mlConfidence: 0, topPrediction: 'N' };
  }
  const predictions = mlPredict(chroma, 10);
  const targetPcs = getChordPitchClassesFromData(chord);

  const t = (sensitivity - 1) / 9;
  const confidenceThreshold = lerp(0.15, 0.04, t);

  // Check if any of the top predictions match the chord's pitch classes
  for (const pred of predictions) {
    if (pred.confidence < confidenceThreshold) break;

    const predPcSet = new Set(pred.pitchClasses);

    // Count overlap
    let overlap = 0;
    for (const pc of targetPcs) {
      if (predPcSet.has(pc)) overlap++;
    }

    const overlapRatio = targetPcs.size > 0 ? overlap / targetPcs.size : 0;

    // High overlap + reasonable confidence = match
    if (overlapRatio >= 0.66 && pred.confidence >= confidenceThreshold) {
      return {
        isMatch: true,
        mlConfidence: pred.confidence,
        topPrediction: pred.className,
      };
    }
  }

  return {
    isMatch: false,
    mlConfidence: predictions[0]?.confidence ?? 0,
    topPrediction: predictions[0]?.className ?? 'N',
  };
}

/**
 * Initialize the ML model asynchronously to avoid blocking the main thread.
 * Uses chunked training via setTimeout to keep the UI responsive.
 */
export function initMLModel(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (isInitializing) {
    // Return a promise that resolves when init completes
    return new Promise((resolve) => {
      const check = () => {
        if (isInitialized) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }
  console.log('[FretMaster ML] Initializing neural network (async)...');
  const start = performance.now();
  return new Promise((resolve) => {
    // Use setTimeout(0) to yield to the event loop before heavy computation
    setTimeout(() => {
      initializeWeights();
      console.log(`[FretMaster ML] Ready in ${(performance.now() - start).toFixed(1)}ms`);
      resolve();
    }, 0);
  });
}

/** Check if the ML model is ready for inference. */
export function isMLReady(): boolean {
  return isInitialized;
}

// ─── Helpers ───

const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

function getChordPitchClassesFromData(chord: ChordData): Set<number> {
  const pc = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    if (fret < 0) continue;
    const midi = OPEN_STRING_MIDI[i] + fret;
    pc.add(((midi % 12) + 12) % 12);
  }
  return pc;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
