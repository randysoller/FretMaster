import { useRef, useCallback } from 'react';
import type { ChordData } from '@/types/chord';
import { useAudioStore } from '@/stores/audioStore';

// Standard guitar tuning frequencies (E2, A2, D3, G3, B3, E4)
const STRING_FREQUENCIES = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const SEMITONE_RATIO = Math.pow(2, 1 / 12);

function getNoteFrequency(stringIndex: number, fret: number): number {
  return STRING_FREQUENCIES[stringIndex] * Math.pow(SEMITONE_RATIO, fret);
}

function createPluck(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  outputNode: AudioNode,
) {
  // Main tone — triangle gives a warm, muted guitar-like timbre
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(frequency, startTime);

  // Harmonic layer — very quiet sine an octave up for brightness
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(frequency * 2, startTime);

  // Sub harmonic for body
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(frequency * 0.5, startTime);

  // Gain envelopes — guitar pluck: fast attack, quick decay, gentle sustain
  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(0, startTime);
  mainGain.gain.linearRampToValueAtTime(volume * 0.45, startTime + 0.008);
  mainGain.gain.exponentialRampToValueAtTime(volume * 0.18, startTime + 0.12);
  mainGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0, startTime);
  harmonicGain.gain.linearRampToValueAtTime(volume * 0.08, startTime + 0.005);
  harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.5);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, startTime);
  subGain.gain.linearRampToValueAtTime(volume * 0.12, startTime + 0.01);
  subGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

  // Low-pass filter to soften the tone
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(frequency * 6, 5000), startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.min(frequency * 2, 2000), startTime + duration * 0.4);
  filter.Q.setValueAtTime(1.2, startTime);

  // Routing — through filter to the provided output node (master gain)
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
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    });
    activeOscillators.current = [];
  }, []);

  const playChord = useCallback(
    (chord: ChordData) => {
      const masterVol = getEffectiveVolume();
      if (masterVol === 0) return; // muted — skip playback entirely

      stopCurrent();
      const ctx = getContext();

      // Master gain node: applies user volume with a boost curve for adequate
      // loudness on mobile. v^1.2 * 6 gives ~4.1 at 75% and 6 at max.
      const masterGain = ctx.createGain();
      const gain = Math.pow(masterVol, 1.2) * 5;
      masterGain.gain.value = gain;
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime + 0.05;
      const strumDelay = 0.035; // 35ms between strings — natural strum speed
      const noteDuration = 2.5; // ring out for 2.5 seconds
      const allOscs: OscillatorNode[] = [];

      // Strum from low E to high E (index 0→5)
      let strumIndex = 0;
      for (let i = 0; i < 6; i++) {
        const fret = chord.frets[i];
        if (fret === -1) continue; // muted string — skip

        const freq = getNoteFrequency(i, fret);
        // Slight volume variation: bass strings a tad louder
        const vol = 0.3 - i * 0.015;
        const startTime = now + strumIndex * strumDelay;
        const oscs = createPluck(ctx, freq, startTime, noteDuration, vol, masterGain);
        allOscs.push(...oscs);
        strumIndex++;
      }

      activeOscillators.current = allOscs;
    },
    [getContext, stopCurrent, getEffectiveVolume],
  );

  return { playChord, stopCurrent };
}
