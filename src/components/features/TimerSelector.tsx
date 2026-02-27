import { usePracticeStore } from '@/stores/practiceStore';
import type { TimerDuration } from '@/types/chord';
import { APP_CONFIG } from '@/constants/config';
import { Timer, TimerOff } from 'lucide-react';

export default function TimerSelector() {
  const { timerDuration, setTimerDuration } = usePracticeStore();
  const isNoTimer = timerDuration === 0;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-base sm:text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider flex items-center gap-2">
        <Timer className="size-4" />
        Reveal Timer
      </h3>
      <button
        onClick={() => setTimerDuration(0)}
        className={`
          w-full flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-body font-medium transition-all duration-200
          ${isNoTimer
            ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))] glow-primary'
            : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:border-[hsl(var(--border-default)/0.8)] hover:bg-[hsl(var(--bg-overlay))]'
          }
        `}
      >
        <TimerOff className="size-4" />
        No Timer
      </button>
      <div className="flex gap-2 sm:gap-3">
        {APP_CONFIG.timerOptions.map((dur) => {
          const isActive = timerDuration === dur;
          return (
            <button
              key={dur}
              onClick={() => setTimerDuration(dur as TimerDuration)}
              className={`
                relative flex-1 rounded-lg border py-4 text-center transition-all duration-200
                ${isActive
                  ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] glow-primary'
                  : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] hover:border-[hsl(var(--border-default)/0.8)] hover:bg-[hsl(var(--bg-overlay))]'
                }
              `}
            >
              <span className={`
                font-display text-xl sm:text-2xl font-bold
                ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-subtle))]'}
              `}>
                {dur}
              </span>
              <span className={`
                block text-xs mt-0.5
                ${isActive ? 'text-[hsl(var(--text-subtle))]' : 'text-[hsl(var(--text-muted))]'}
              `}>
                seconds
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
