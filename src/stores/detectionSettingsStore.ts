import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdvancedDetectionValues {
  noiseGate: number;
  harmonicBoost: number;
  fluxTolerance: number;
}

export interface StringCalibration {
  /** Measured peak frequency for this string */
  measuredFreq: number;
  /** Signal strength (RMS) for this string */
  signalStrength: number;
  /** Spectral crest factor for this string */
  crestFactor: number;
  /** Expected frequency */
  expectedFreq: number;
  /** Cents offset from expected */
  centsOffset: number;
}

export interface PerStringCalibration {
  /** Calibration data per string index (0=E2, 1=A2, 2=D3, 3=G3, 4=B3, 5=E4) */
  strings: (StringCalibration | null)[];
  /** Whether per-string calibration has been performed */
  calibrated: boolean;
  /** Derived optimal RMS threshold based on weakest string */
  derivedRmsThreshold: number;
  /** Derived harmonic sensitivity based on average crest factor */
  derivedHarmonicSensitivity: number;
}

const DEFAULTS: AdvancedDetectionValues = {
  noiseGate: 50,
  harmonicBoost: 50,
  fluxTolerance: 50,
};

const DEFAULT_STRING_CAL: PerStringCalibration = {
  strings: [null, null, null, null, null, null],
  calibrated: false,
  derivedRmsThreshold: 0.008,
  derivedHarmonicSensitivity: 50,
};

interface DetectionSettingsState {
  sensitivity: number;
  advancedEnabled: boolean;
  advancedValues: AdvancedDetectionValues;
  perStringCalibration: PerStringCalibration;
  setSensitivity: (v: number) => void;
  setAdvancedEnabled: (v: boolean) => void;
  setAdvancedValues: (v: AdvancedDetectionValues) => void;
  updateAdvancedValue: (key: keyof AdvancedDetectionValues, val: number) => void;
  resetAdvanced: () => void;
  applyCalibrationProfile: (profile: AdvancedDetectionValues) => void;
  setPerStringCalibration: (cal: PerStringCalibration) => void;
  clearPerStringCalibration: () => void;
}

export const useDetectionSettingsStore = create<DetectionSettingsState>()(
  persist(
    (set) => ({
      sensitivity: 6,
      advancedEnabled: false,
      advancedValues: DEFAULTS,
      perStringCalibration: DEFAULT_STRING_CAL,
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
      setPerStringCalibration: (cal) => set({ perStringCalibration: cal }),
      clearPerStringCalibration: () => set({ perStringCalibration: DEFAULT_STRING_CAL }),
    }),
    {
      name: 'fretmaster-detection-settings',
      version: 1,
    }
  )
);
