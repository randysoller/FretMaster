import { useCustomChordStore } from '@/stores/customChordStore';
import type { CustomChordData } from '@/types/customChord';

interface InteractiveFretboardProps {
  chord: CustomChordData;
  width?: number;
  height?: number;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRING_WIDTHS = [2.8, 2.4, 2.0, 1.5, 1.1, 0.8];

export default function InteractiveFretboard({ chord, width = 320, height = 420 }: InteractiveFretboardProps) {
  const { toggleMarker, toggleMutedString, toggleOpenString } = useCustomChordStore();

  const numStrings = 6;
  const numFrets = chord.numFrets;
  const showNut = chord.baseFret === 1;

  const padLeft = 44;
  const padRight = 20;
  const padTop = 56;
  const padBottom = 24;

  const gridWidth = width - padLeft - padRight;
  const gridHeight = height - padTop - padBottom;
  const stringSpacing = gridWidth / (numStrings - 1);
  const fretSpacing = gridHeight / numFrets;
  const dotRadius = Math.min(stringSpacing, fretSpacing) * 0.34;

  const getStringX = (i: number) => padLeft + i * stringSpacing;
  const getFretY = (f: number) => padTop + f * fretSpacing;

  const handleFretClick = (fret: number, string: number) => {
    toggleMarker(fret, string);
  };

  const handleStringHeaderClick = (stringIdx: number) => {
    const isMuted = chord.mutedStrings.has(stringIdx);
    const isOpen = chord.openStrings.has(stringIdx);
    const hasMarkers = chord.markers.some((m) => m.string === stringIdx);

    if (hasMarkers) {
      // If string has fretted notes, toggle to muted
      toggleMutedString(stringIdx);
    } else if (!isMuted && !isOpen) {
      // Nothing → open
      toggleOpenString(stringIdx);
    } else if (isOpen) {
      // Open → muted
      toggleOpenString(stringIdx); // removes open
      toggleMutedString(stringIdx); // adds muted
    } else {
      // Muted → nothing
      toggleMutedString(stringIdx);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="select-none cursor-crosshair"
    >
      {/* String labels at top — clickable to toggle open/muted */}
      {Array.from({ length: numStrings }, (_, i) => {
        const x = getStringX(i);
        const isMuted = chord.mutedStrings.has(i);
        const isOpen = chord.openStrings.has(i);

        return (
          <g key={`label-${i}`} onClick={() => handleStringHeaderClick(i)} className="cursor-pointer">
            {/* Hit area */}
            <rect
              x={x - stringSpacing / 2}
              y={0}
              width={stringSpacing}
              height={padTop - 4}
              fill="transparent"
            />
            {/* String name */}
            <text
              x={x}
              y={18}
              textAnchor="middle"
              fontSize={11}
              fontFamily="DM Sans, sans-serif"
              fontWeight={600}
              fill="hsl(33 14% 72%)"
            >
              {STRING_LABELS[i]}
            </text>
            {/* Open/Muted indicator */}
            {isOpen && (
              <circle
                cx={x}
                cy={36}
                r={7}
                stroke="hsl(33 14% 72%)"
                strokeWidth={1.5}
                fill="none"
              />
            )}
            {isMuted && (
              <g>
                <line x1={x - 5} y1={31} x2={x + 5} y2={41} stroke="hsl(30 7% 47%)" strokeWidth={1.5} />
                <line x1={x + 5} y1={31} x2={x - 5} y2={41} stroke="hsl(30 7% 47%)" strokeWidth={1.5} />
              </g>
            )}
            {!isOpen && !isMuted && (
              <text
                x={x}
                y={40}
                textAnchor="middle"
                fontSize={10}
                fontFamily="DM Sans, sans-serif"
                fill="hsl(30 7% 47%)"
                className="opacity-40"
              >
                tap
              </text>
            )}
          </g>
        );
      })}

      {/* Base fret label */}
      {!showNut && (
        <text
          x={padLeft - 8}
          y={getFretY(0.5) + 4}
          textAnchor="end"
          fontSize={11}
          fontFamily="DM Sans, sans-serif"
          fontWeight={600}
          fill="hsl(30 7% 47%)"
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

      {/* String lines */}
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

      {/* Clickable fret zones */}
      {Array.from({ length: numFrets }, (_, fretIdx) =>
        Array.from({ length: numStrings }, (_, stringIdx) => {
          const fretNum = fretIdx + 1;
          const x = getStringX(stringIdx);
          const y = getFretY(fretIdx) + fretSpacing / 2;

          return (
            <rect
              key={`zone-${fretIdx}-${stringIdx}`}
              x={x - stringSpacing / 2}
              y={getFretY(fretIdx)}
              width={stringSpacing}
              height={fretSpacing}
              fill="transparent"
              className="cursor-pointer hover:fill-[hsl(38_75%_52%/0.08)]"
              onClick={() => handleFretClick(fretNum, stringIdx)}
            />
          );
        }),
      )}

      {/* Barre indicators */}
      {chord.barres.map((barre) => {
        const y = getFretY(barre.fret - 1) + fretSpacing / 2;
        const barHeight = dotRadius * 0.4;
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

      {/* Placed markers */}
      {chord.markers.map((marker) => {
        const x = getStringX(marker.string);
        const y = getFretY(marker.fret - 1) + fretSpacing / 2;
        const displayLabel = marker.label || (marker.finger > 0 ? String(marker.finger) : '');

        return (
          <g key={`marker-${marker.fret}-${marker.string}`}>
            {marker.shape === 'diamond' ? (
              <polygon
                points={`${x},${y - dotRadius * 1.15} ${x + dotRadius * 1.15},${y} ${x},${y + dotRadius * 1.15} ${x - dotRadius * 1.15},${y}`}
                fill={marker.color}
              />
            ) : (
              <circle cx={x} cy={y} r={dotRadius} fill={marker.color} />
            )}
            {displayLabel && (
              <text
                x={x}
                y={y + 4.5}
                textAnchor="middle"
                fontSize={13}
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

      {/* Fret numbers on right */}
      {Array.from({ length: numFrets }, (_, i) => (
        <text
          key={`fnum-${i}`}
          x={getStringX(numStrings - 1) + 14}
          y={getFretY(i) + fretSpacing / 2 + 4}
          textAnchor="start"
          fontSize={9}
          fontFamily="DM Sans, sans-serif"
          fill="hsl(30 7% 47%)"
          className="opacity-50"
        >
          {chord.baseFret + i}
        </text>
      ))}
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
