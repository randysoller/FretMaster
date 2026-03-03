import type { ChordData } from '@/types/chord';

interface ChordTablatureProps {
  chord: ChordData;
  size?: 'sm' | 'md' | 'lg';
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const;

/**
 * Renders guitar tablature for a chord.
 * The frets array is [lowE, A, D, G, B, highE] — we display top-to-bottom as high-e → low-E.
 */
export default function ChordTablature({ chord, size = 'sm' }: ChordTablatureProps) {
  // Reverse to display high e on top, low E on bottom (standard tab notation)
  const reversedFrets = [...chord.frets].reverse();
  const rootIdx = chord.rootNoteString;
  // reversed index: string 0 (low E) → index 5 in reversed, string 5 (high e) → index 0
  const reversedRootIdx = 5 - rootIdx;

  const textSizes = {
    sm: { label: 'text-[10px]', fret: 'text-[11px]', gap: 'gap-[1px]', lineH: 'h-[14px]', dashW: 'w-3', labelW: 'w-3' },
    md: { label: 'text-xs', fret: 'text-xs', gap: 'gap-[2px]', lineH: 'h-[18px]', dashW: 'w-5', labelW: 'w-4' },
    lg: { label: 'text-sm', fret: 'text-sm', gap: 'gap-[3px]', lineH: 'h-[22px]', dashW: 'w-6', labelW: 'w-5' },
  };

  const cfg = textSizes[size];

  return (
    <div className={`font-mono flex flex-col ${cfg.gap} select-none`}>
      {reversedFrets.map((fret, i) => {
        const isRoot = i === reversedRootIdx;
        const fretDisplay = fret === -1 ? 'x' : String(fret);
        const isOpen = fret === 0;
        const isMuted = fret === -1;

        return (
          <div key={i} className={`flex items-center ${cfg.lineH}`}>
            {/* String label */}
            <span className={`${cfg.label} ${cfg.labelW} text-right font-bold text-[hsl(var(--text-muted))] shrink-0 pr-0.5`}>
              {STRING_LABELS[i]}
            </span>
            {/* Dashes before */}
            <span className={`${cfg.fret} text-[hsl(var(--text-muted)/0.4)]`}>--</span>
            {/* Fret number */}
            <span
              className={`${cfg.fret} font-bold tabular-nums text-center min-w-[14px] ${
                isMuted
                  ? 'text-[hsl(var(--text-muted)/0.5)]'
                  : isRoot
                    ? 'text-[hsl(200_80%_62%)]'
                    : isOpen
                      ? 'text-[hsl(var(--text-subtle))]'
                      : 'text-[hsl(var(--color-primary))]'
              }`}
            >
              {fretDisplay}
            </span>
            {/* Dashes after */}
            <span className={`${cfg.fret} text-[hsl(var(--text-muted)/0.4)]`}>--</span>
          </div>
        );
      })}
    </div>
  );
}
