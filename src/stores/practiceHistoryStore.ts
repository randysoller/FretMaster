import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryAttempt {
  chordSymbol: string;
  chordName: string;
  result: 'correct' | 'skipped';
  timeMs: number;
}

export interface PracticeSession {
  id: string;
  date: number; // timestamp
  mode: 'single' | 'progression';
  totalCorrect: number;
  totalSkipped: number;
  accuracyRate: number;
  avgResponseTimeMs: number;
  fastestTimeMs: number;
  totalDurationMs: number;
  attempts: HistoryAttempt[];
  /** Chord symbols practiced */
  chords: string[];
}

export interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: number;
  noiseGate: number;
  harmonicBoost: number;
  fluxTolerance: number;
  /** Measured noise floor RMS */
  noiseFloorRms: number;
  /** Measured signal RMS */
  signalRms: number;
}

interface PracticeHistoryState {
  sessions: PracticeSession[];
  calibrationProfiles: CalibrationProfile[];
  addSession: (session: Omit<PracticeSession, 'id'>) => void;
  clearHistory: () => void;
  addCalibrationProfile: (profile: Omit<CalibrationProfile, 'id'>) => void;
  deleteCalibrationProfile: (id: string) => void;
}

export const usePracticeHistoryStore = create<PracticeHistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      calibrationProfiles: [],
      addSession: (session) =>
        set((state) => ({
          sessions: [
            { ...session, id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
            ...state.sessions,
          ].slice(0, 200), // keep last 200 sessions
        })),
      clearHistory: () => set({ sessions: [] }),
      addCalibrationProfile: (profile) =>
        set((state) => ({
          calibrationProfiles: [
            ...state.calibrationProfiles,
            { ...profile, id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
          ],
        })),
      deleteCalibrationProfile: (id) =>
        set((state) => ({
          calibrationProfiles: state.calibrationProfiles.filter((p) => p.id !== id),
        })),
    }),
    {
      name: 'fretmaster-practice-history',
      version: 1,
    }
  )
);
