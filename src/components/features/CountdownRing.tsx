interface CountdownRingProps {
  progress: number;
  timeLeft: number;
  size?: number;
}

export default function CountdownRing({ progress, timeLeft, size = 160 }: CountdownRingProps) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="countdown-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="countdown-progress"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            filter: `drop-shadow(0 0 6px hsl(38 75% 52% / 0.4))`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold text-[hsl(var(--text-default))] tabular-nums">
          {Math.ceil(timeLeft)}
        </span>
        <span className="text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wide mt-1">
          seconds
        </span>
      </div>
    </div>
  );
}
