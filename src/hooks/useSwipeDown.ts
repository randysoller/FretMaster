import { useRef, useCallback, type TouchEvent } from 'react';

interface UseSwipeDownOptions {
  /** Minimum vertical distance (px) to trigger swipe. Default: 60 */
  threshold?: number;
  /** Maximum horizontal distance (px) allowed. Default: 100 */
  maxHorizontal?: number;
  /** Callback when swipe-down is detected */
  onSwipeDown: () => void;
}

/**
 * Hook that detects a downward swipe gesture on a touch-enabled element.
 * Returns touch event handlers to spread onto the target element.
 */
export function useSwipeDown({
  threshold = 60,
  maxHorizontal = 100,
  onSwipeDown,
}: UseSwipeDownOptions) {
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startY.current = touch.clientY;
    startX.current = touch.clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (startY.current === null || startX.current === null) return;
      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - startY.current;
      const deltaX = Math.abs(touch.clientX - startX.current);
      startY.current = null;
      startX.current = null;

      if (deltaY >= threshold && deltaX <= maxHorizontal) {
        onSwipeDown();
      }
    },
    [threshold, maxHorizontal, onSwipeDown],
  );

  return { onTouchStart, onTouchEnd };
}
