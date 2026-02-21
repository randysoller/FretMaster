import { create } from 'zustand';

const STORAGE_KEY = 'fretmaster-audio';

interface AudioSettings {
  volume: number; // 0–1
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
  /** Effective volume (0 when muted) */
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
