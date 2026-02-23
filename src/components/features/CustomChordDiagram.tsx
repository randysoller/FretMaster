import type { CustomChordData } from '@/types/customChord';

interface CustomChordDiagramProps {
  chord: CustomChordData;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { width: 100, height: 130, dotRadius: 7, fontSize: 14, topY: 18, fretLabelSize: 9 },
  md: { width: 140, height: 175, dotRadius: 9.5, fontSize: 18, topY: 22, fretLabelSize: 11 },
  lg: { width: 200, height: 250, dotRadius: 13, fontSize: 24, topY: 30, fretLabelSize: 14 },
};

const STRING_WIDTHS = [2.6, 2.2, 1.8, 1.4, 1.0, 0.7];
const FRET_LABEL_PAD = { sm: 10, md: 14, lg: 20 };

export default function CustomChordDiagram({ chord, size = 'md' }: CustomChordDiagramProps) {
  const config = SIZES[size];
  const numStrings = 6;
  const numFrets = chord.numFrets;

  const showNut = chord.baseFret === 1;
  const needsFretLabel = !showNut;

  const basePadLeft = size === 'lg' ? 30 : 22;
  const extraLeft = needsFretLabel ? FRET_LABEL_PAD[size] : 0;
  const padLeft = basePadLeft + extraLeft;
  const padRight = size === 'lg' ? 16 : 12;
  const padTop = config.topY + 8;

  const svgWidth = config.width + extraLeft;
  const fretRatio = numFrets / 5;
  const svgHeight = config.height * fretRatio;
  const gridWidth = svgWidth - padLeft - padRight;
  const gridHeight = svgHeight - padTop - 16;
  const stringSpacing = gridWidth / (numStrings - 1);
  const fretSpacing = gridHeight / numFrets;

  const getStringX = (i: number) => padLeft + i * stringSpacing;
  const getFretY = (f: number) => padTop + f * fretSpacing;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth}
      height={svgHeight}
      className="select-none"
    >
      {/* Fret label */}
      {needsFretLabel && (
        <text
          x={padLeft - 6}
          y={getFretY(0.5) + config.fretLabelSize / 3}
          textAnchor="end"
          fill="hsl(30 7% 47%)"
          fontSize={config.fretLabelSize}
          fontFamily="DM Sans, sans-serif"
          fontWeight={600}
        >
          {chord.baseFret}fr
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={getStringX(0)}
          y1={getFretY(i)}
          x2={getStringX(numStrings - 1)}
          y2={getFretY(i)}
          stroke="hsl(28 12% 21%)"
          strokeWidth={i === 0 && !showNut ? 1.5 : 1}
        />
      ))}

      {/* Strings */}
      {Array.from({ length: numStrings }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={getStringX(i)}
          y1={getFretY(0)}
          x2={getStringX(i)}
          y2={getFretY(numFrets)}
          stroke="hsl(33 14% 72%)"
          strokeWidth={STRING_WIDTHS[i]}
          opacity={chord.mutedStrings.has(i) ? 0.3 : 1}
        />
      ))}

      {/* Nut */}
      {showNut && (
        <rect
          x={getStringX(0) - 1}
          y={getFretY(0) - 3}
          width={getStringX(numStrings - 1) - getStringX(0) + 2}
          height={6}
          rx={1}
          fill="hsl(36 33% 93%)"
        />
      )}

      {/* Open/Muted indicators */}
      {Array.from({ length: numStrings }, (_, i) => {
        const x = getStringX(i);
        const y = config.topY - 4;
        const r = config.dotRadius * 0.65;

        if (chord.openStrings.has(i)) {
          return (
            <circle key={`open-${i}`} cx={x} cy={y} r={r} stroke="hsl(33 14% 72%)" strokeWidth={1.5} fill="none" />
          );
        }
        if (chord.mutedStrings.has(i)) {
          return (
            <g key={`muted-${i}`}>
              <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} stroke="hsl(30 7% 47%)" strokeWidth={1.5} />
              <line x1={x + r} y1={y - r} x2={x - r} y2={y + r} stroke="hsl(30 7% 47%)" strokeWidth={1.5} />
            </g>
          );
        }
        return null;
      })}

      {/* Barres */}
      {chord.barres.map((barre) => {
        const y = getFretY(barre.fret - 1) + fretSpacing / 2;
        const barHeight = config.dotRadius * 0.38;
        return (
          <rect
            key={`barre-${barre.fret}`}
            x={getStringX(barre.fromString)}
            y={y - barHeight}
            width={getStringX(barre.toString) - getStringX(barre.fromString)}
            height={barHeight * 2}
            rx={barHeight}
            fill={barre.color}
            opacity={0.85}
          />
        );
      })}

      {/* Markers */}
      {chord.markers.map((marker) => {
        const x = getStringX(marker.string);
        const y = getFretY(marker.fret - 1) + fretSpacing / 2;
        const displayLabel = marker.label || (marker.finger > 0 ? String(marker.finger) : '');

        return (
          <g key={`dot-${marker.fret}-${marker.string}`}>
            {marker.shape === 'diamond' ? (
              <polygon
                points={`${x},${y - config.dotRadius * 1.15} ${x + config.dotRadius * 1.15},${y} ${x},${y + config.dotRadius * 1.15} ${x - config.dotRadius * 1.15},${y}`}
                fill={marker.color}
              />
            ) : (
              <circle cx={x} cy={y} r={config.dotRadius} fill={marker.color} />
            )}
            {displayLabel && (
              <text
                x={x}
                y={y + config.fontSize * 0.35}
                textAnchor="middle"
                fontSize={config.fontSize}
                fontFamily="DM Sans, sans-serif"
                fontWeight={700}
                fill={isLightColor(marker.color) ? '#1a1a1a' : '#fafafa'}
              >
                {displayLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
