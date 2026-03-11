import { useState, useCallback, useRef } from 'react';

export interface SessionAttempt {
  chordSymbol: string;
  chordName: string;
  result: 'correct' | 'skipped';
  timeMs: number;
  timestamp: number;
}

export interface SessionSummary {
  attempts: SessionAttempt[];
  totalCorrect: number;
  totalSkipped: number;
  accuracyRate: number;
  avgResponseTimeMs: number;
  fastestTimeMs: number;
  slowestTimeMs: number;
  totalDurationMs: number;
}

export function useSessionStats() {
  const [attempts, setAttempts] = useState<SessionAttempt[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const chordStartTimeRef = useRef<number>(Date.now());
  const sessionStartTimeRef = useRef<number>(Date.now());

  const startSession = useCallback(() => {
    setAttempts([]);
    setShowSummary(false);
    sessionStartTimeRef.current = Date.now();
    chordStartTimeRef.current = Date.now();
  }, []);

  const recordAttempt = useCallback((chordSymbol: string, chordName: string, result: 'correct' | 'skipped') => {
    const now = Date.now();
    const timeMs = now - chordStartTimeRef.current;
    setAttempts(prev => [...prev, { chordSymbol, chordName, result, timeMs, timestamp: now }]);
    chordStartTimeRef.current = now;
  }, []);

  const resetChordTimer = useCallback(() => {
    chordStartTimeRef.current = Date.now();
  }, []);

  const endSession = useCallback(() => {
    setShowSummary(true);
  }, []);

  const dismissSummary = useCallback(() => {
    setShowSummary(false);
  }, []);

  const getSummary = useCallback((): SessionSummary => {
    const totalCorrect = attempts.filter(a => a.result === 'correct').length;
    const totalSkipped = attempts.filter(a => a.result === 'skipped').length;
    const correctAttempts = attempts.filter(a => a.result === 'correct');
    const avgResponseTimeMs = correctAttempts.length > 0
      ? correctAttempts.reduce((sum, a) => sum + a.timeMs, 0) / correctAttempts.length
      : 0;
    const fastestTimeMs = correctAttempts.length > 0
      ? Math.min(...correctAttempts.map(a => a.timeMs))
      : 0;
    const slowestTimeMs = correctAttempts.length > 0
      ? Math.max(...correctAttempts.map(a => a.timeMs))
      : 0;
    const scored = totalCorrect + totalSkipped;
    const accuracyRate = scored > 0 ? (totalCorrect / scored) * 100 : 0;
    return {
      attempts,
      totalCorrect,
      totalSkipped,
      accuracyRate,
      avgResponseTimeMs,
      fastestTimeMs,
      slowestTimeMs,
      totalDurationMs: Date.now() - sessionStartTimeRef.current,
    };
  }, [attempts]);

  return {
    attempts,
    showSummary,
    startSession,
    recordAttempt,
    resetChordTimer,
    endSession,
    dismissSummary,
    getSummary,
  };
}
