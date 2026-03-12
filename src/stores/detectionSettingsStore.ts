import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdvancedDetectionValues {
  noiseGate: number;
  harmonicBoost: number;
  fluxTolerance: number;
}

export type DetectionEngine = 'dsp' | 'ml' | 'hybrid';

const DEFAULTS: AdvancedDetectionValues = {
  noiseGate: 50,
  harmonicBoost: 50,
  fluxTolerance: 50,
};

interface DetectionSettingsState {
  sensitivity: number;
  advancedEnabled: boolean;
  advancedValues: AdvancedDetectionValues;
  detectionEngine: DetectionEngine;
  setSensitivity: (v: number) => void;
  setAdvancedEnabled: (v: boolean) => void;
  setAdvancedValues: (v: AdvancedDetectionValues) => void;
  updateAdvancedValue: (key: keyof AdvancedDetectionValues, val: number) => void;
  resetAdvanced: () => void;
  applyCalibrationProfile: (profile: AdvancedDetectionValues) => void;
  setDetectionEngine: (engine: DetectionEngine) => void;
}

export const useDetectionSettingsStore = create<DetectionSettingsState>()(
  persist(
    (set) => ({
      sensitivity: 6,
      advancedEnabled: false,
      advancedValues: DEFAULTS,
      detectionEngine: 'hybrid' as DetectionEngine,
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
      setDetectionEngine: (engine) => set({ detectionEngine: engine }),
    }),
    {
      name: 'fretmaster-detection-settings',
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return { ...persisted, detectionEngine: 'hybrid' };
        }
        return persisted;
      },
    }
  )
);
