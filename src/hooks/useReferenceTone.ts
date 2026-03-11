import { useCallback, useRef } from 'react';
import type { ChordData } from '@/types/chord';

const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

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

    // Count active strings for volume balancing
    const activeStrings: { midi: number; stringIdx: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const fret = chord.frets[i];
      if (fret < 0) continue;
      activeStrings.push({ midi: OPEN_STRING_MIDI[i] + fret, stringIdx: i });
    }

    if (activeStrings.length === 0) return;

    const perStringGain = Math.min(0.9, 1.2 / activeStrings.length);

    activeStrings.forEach(({ midi, stringIdx }, idx) => {
      const freq = midiToFreq(midi);

      // Stagger start times to simulate a strum (low to high, ~15ms apart)
      const strumDelay = idx * 0.015;
      const startTime = now + strumDelay;

      // Primary sine oscillator
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; // slightly richer than pure sine
      osc.frequency.value = freq;
      // Slight natural detuning per string for realism
      osc.detune.value = (stringIdx - 2.5) * 1.2;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, startTime);
      env.gain.exponentialRampToValueAtTime(perStringGain, startTime + 0.04);
      env.gain.setValueAtTime(perStringGain, startTime + 0.04);
      env.gain.exponentialRampToValueAtTime(perStringGain * 0.6, startTime + duration * 0.4);
      env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(env);
      env.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);

      oscs.push(osc);

      // Add quiet 2nd harmonic for warmth
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      osc2.detune.value = (stringIdx - 2.5) * 0.8;

      const env2 = ctx.createGain();
      env2.gain.setValueAtTime(0.001, startTime);
      env2.gain.exponentialRampToValueAtTime(perStringGain * 0.15, startTime + 0.04);
      env2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

      osc2.connect(env2);
      env2.connect(masterGain);
      osc2.start(startTime);
      osc2.stop(startTime + duration + 0.1);

      oscs.push(osc2);
    });

    activeNodesRef.current = { oscs, master: masterGain };
    isPlayingRef.current = true;

    timeoutRef.current = setTimeout(() => {
      activeNodesRef.current = null;
      isPlayingRef.current = false;
      timeoutRef.current = null;
    }, (duration + 0.3) * 1000);
  }, [stopTone]);

  return { playChordTone, stopTone, isPlaying: isPlayingRef };
}
