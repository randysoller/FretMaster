import { useAudioStore } from '@/stores/audioStore';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  compact?: boolean;
}

export default function VolumeControl({ compact = false }: VolumeControlProps) {
  const { volume, muted, setVolume, toggleMute } = useAudioStore();

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <button
        onClick={toggleMute}
        className={`
          flex items-center justify-center rounded-md transition-colors
          ${compact ? 'size-8' : 'size-9'}
          ${muted
            ? 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)]'
            : 'text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)]'
          }
        `}
        title={muted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className={compact ? 'size-4' : 'size-[18px]'} />
      </button>

      <div className="relative flex items-center group">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className={`volume-slider ${compact ? 'w-28 sm:w-24' : 'w-28'}`}
          aria-label="Volume"
        />
      </div>

      {!compact && (
        <span className="min-w-[32px] text-right text-xs font-body text-[hsl(var(--text-muted))] tabular-nums">
          {muted ? '0' : Math.round(volume * 100)}%
        </span>
      )}
    </div>
  );
}
