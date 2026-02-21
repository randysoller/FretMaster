import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCountdownOptions {
  duration: number;
  onComplete: () => void;
}

export function useCountdown({ duration, onComplete }: UseCountdownOptions) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef(duration);

  onCompleteRef.current = onComplete;
  durationRef.current = duration;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    startTimeRef.current = Date.now();
    setTimeLeft(durationRef.current);
    setIsRunning(true);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeLeft(durationRef.current);
  }, [clearTimer]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, durationRef.current - elapsed);

      if (remaining <= 0) {
        clearTimer();
        setIsRunning(false);
        setTimeLeft(0);
        onCompleteRef.current();
      } else {
        setTimeLeft(remaining);
      }
    }, 50);

    return clearTimer;
  }, [isRunning, clearTimer]);

  const progress = duration > 0 ? Math.max(0, timeLeft / duration) : 0;

  return { timeLeft, isRunning, progress, start, stop, reset };
}
