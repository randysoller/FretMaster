import type { ChordData } from '@/types/chord';
import type { StringNoteStatus } from '@/hooks/useChordDetection';

interface ChordDiagramProps {
  chord: ChordData;
  size?: 'sm' | 'md' | 'lg';
  /** Optional per-string status for real-time feedback coloring. Index 0=low E … 5=high E. */
  stringStatus?: (StringNoteStatus | null)[];
}

const SIZES = {
  sm: { width: 100, height: 130, dotRadius: 7, fontSize: 14, topY: 18, fretLabelSize: 9 },
  md: { width: 140, height: 175, dotRadius: 9.5, fontSize: 18, topY: 22, fretLabelSize: 11 },
  lg: { width: 200, height: 250, dotRadius: 13, fontSize: 24, topY: 30, fretLabelSize: 14 },
};

/** Extra left padding added when a fret label (e.g. "3fr") needs to be shown */
const FRET_LABEL_PAD = { sm: 10, md: 14, lg: 20 };

export default function ChordDiagram({ chord, size = 'md', stringStatus }: ChordDiagramProps) {
  const config = SIZES[size];
  const numStrings = 6;
  const numFrets = 5;

  const showNut = chord.baseFret === 1;
  const needsFretLabel = !showNut;

  const basePadLeft = size === 'lg' ? 30 : 22;
  const extraLeft = needsFretLabel ? FRET_LABEL_PAD[size] : 0;
  const padLeft = basePadLeft + extraLeft;
  const padRight = size === 'lg' ? 16 : 12;
  const padTop = config.topY + 8;

  const svgWidth = config.width + extraLeft;
  const gridWidth = svgWidth - padLeft - padRight;
  const gridHeight = config.height - padTop - 16;
  const stringSpacing = gridWidth / (numStrings - 1);
  const fretSpacing = gridHeight / numFrets;

  const getStringX = (i: number) => padLeft + i * stringSpacing;
  const getFretY = (f: number) => padTop + f * fretSpacing;

  const rootIdx = chord.rootNoteString;

  // Realistic string thickness: low E (thickest) → high e (thinnest)
  const STRING_WIDTHS = [2.6, 2.2, 1.8, 1.4, 1.0, 0.7];

  // String status color helpers
  const getStatusFill = (stringIdx: number): string | undefined => {
    if (!stringStatus || !stringStatus[stringIdx]) return undefined;
    const s = stringStatus[stringIdx];
    if (s === 'correct') return 'hsl(142 71% 45%)';
    if (s === 'missing') return 'hsl(0 84% 60%)';
    return undefined;
  };

  const getStatusTextFill = (stringIdx: number): string | undefined => {
    if (!stringStatus || !stringStatus[stringIdx]) return undefined;
    const s = stringStatus[stringIdx];
    if (s === 'correct') return 'hsl(0 0% 100%)';
    if (s === 'missing') return 'hsl(0 0% 100%)';
    return undefined;
  };

  const getStatusGlow = (stringIdx: number): string | undefined => {
    if (!stringStatus || !stringStatus[stringIdx]) return undefined;
    const s = stringStatus[stringIdx];
    if (s === 'correct') return 'drop-shadow(0 0 6px hsl(142 71% 45% / 0.6))';
    if (s === 'missing') return 'drop-shadow(0 0 6px hsl(0 84% 60% / 0.6))';
    return undefined;
  };

  const getStringStroke = (stringIdx: number): string | undefined => {
    if (!stringStatus || !stringStatus[stringIdx]) return undefined;
    const s = stringStatus[stringIdx];
    if (s === 'correct') return 'hsl(142 71% 45%)';
    if (s === 'missing') return 'hsl(0 84% 60% / 0.6)';
    return undefined;
  };

  // Build a set of (stringIndex) that are rendered by the barre section, so finger-dot section can skip them
  const barreRenderedStrings = new Set<string>();
  if (chord.barres) {
    for (const barreFret of chord.barres) {
      const relFret = barreFret - chord.baseFret + 1;
      if (relFret < 1 || relFret > numFrets) continue;

      const barreStrings = chord.frets
        .map((f, idx) => (f >= barreFret ? idx : -1))
        .filter((idx) => idx >= 0);
      if (barreStrings.length < 2) continue;

      const fromString = barreStrings[0];
      const toString = barreStrings[barreStrings.length - 1];
      for (let si = fromString; si <= toString; si++) {
        if (chord.frets[si] === barreFret) {
          barreRenderedStrings.add(`${si}-${barreFret}`);
        }
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${config.height}`}
      width={svgWidth}
      height={config.height}
      className="select-none"
    >
      {/* Fret number indicator */}
      {needsFretLabel && (
        <text
          x={padLeft - 6}
          y={getFretY(0.5) + config.fretLabelSize / 3}
          textAnchor="end"
          className="fill-[hsl(var(--text-subtle))]"
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
          className="chord-fret"
          strokeWidth={i === 0 && !showNut ? 2.5 : 2}
        />
      ))}

      {/* Fret dot inlays */}
      {Array.from({ length: numFrets }, (_, i) => {
        const absoluteFret = chord.baseFret + i;
        const inlayR = config.dotRadius / 2;
        const y = getFretY(i) + fretSpacing / 2;
        const centerX = (getStringX(0) + getStringX(numStrings - 1)) / 2;
        const isSingle = [3, 5, 7, 9, 15, 17, 19, 21].includes(absoluteFret);
        const isDouble = [12, 24].includes(absoluteFret);
        if (!isSingle && !isDouble) return null;
        if (isDouble) {
          const leftX = (getStringX(1) + getStringX(2)) / 2;
          const rightX = (getStringX(3) + getStringX(4)) / 2;
          return (
            <g key={`inlay-${i}`}>
              <circle cx={leftX} cy={y} r={inlayR} fill="hsl(30 15% 50%)" opacity={0.5} />
              <circle cx={rightX} cy={y} r={inlayR} fill="hsl(30 15% 50%)" opacity={0.5} />
            </g>
          );
        }
        return <circle key={`inlay-${i}`} cx={centerX} cy={y} r={inlayR} fill="hsl(30 15% 50%)" opacity={0.5} />;
      })}

      {/* String lines — thicker on left (low E) like real strings, colored by status */}
      {Array.from({ length: numStrings }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={getStringX(i)}
          y1={getFretY(0)}
          x2={getStringX(i)}
          y2={getFretY(numFrets)}
          stroke={getStringStroke(i) ?? 'hsl(var(--text-subtle))'}
          strokeWidth={STRING_WIDTHS[i]}
          style={{ transition: 'stroke 0.15s ease' }}
        />
      ))}

      {/* Nut (solid bar, rendered after strings so it sits in front) */}
      {showNut && (
        <rect
          x={getStringX(0) - 1}
          y={getFretY(0) - 3}
          width={getStringX(numStrings - 1) - getStringX(0) + 2}
          height={6}
          rx={1}
          fill="hsl(var(--text-default))"
        />
      )}

      {/* Barre indicators */}
      {chord.barres?.map((barreFret) => {
        const relFret = barreFret - chord.baseFret + 1;
        if (relFret < 1 || relFret > numFrets) return null;

        const barreStrings = chord.frets
          .map((f, idx) => (f >= barreFret ? idx : -1))
          .filter((idx) => idx >= 0);

        if (barreStrings.length < 2) return null;

        const fromString = barreStrings[0];
        const toString = barreStrings[barreStrings.length - 1];
        const y = getFretY(relFret) - fretSpacing / 2;

        const barreFingerNum = chord.fingers[fromString];
        const barHeight = config.dotRadius * 0.38;

        const contactStrings: number[] = [];
        for (let si = fromString; si <= toString; si++) {
          if (chord.frets[si] === barreFret) {
            contactStrings.push(si);
          }
        }

        return (
          <g key={`barre-${barreFret}`}>
            {contactStrings.length >= 2 && (
              <rect
                x={getStringX(contactStrings[0])}
                y={y - barHeight}
                width={getStringX(contactStrings[contactStrings.length - 1]) - getStringX(contactStrings[0])}
                height={barHeight * 2}
                rx={barHeight}
                className="chord-barre"
              />
            )}
            {contactStrings.map((si) => {
              const isRoot = si === rootIdx;
              const statusFill = getStatusFill(si);
              const statusText = getStatusTextFill(si);
              const glow = getStatusGlow(si);
              return (
                <g key={`barre-dot-${si}`} style={glow ? { filter: glow } : undefined}>
                  {isRoot ? (
                    statusFill ? (
                      <StatusDiamond x={getStringX(si)} y={y} r={config.dotRadius} fill={statusFill} />
                    ) : (
                      <RootDiamond x={getStringX(si)} y={y} r={config.dotRadius} />
                    )
                  ) : (
                    <circle
                      cx={getStringX(si)}
                      cy={y}
                      r={config.dotRadius}
                      fill={statusFill}
                      className={statusFill ? undefined : 'chord-dot'}
                      style={{ transition: 'fill 0.15s ease' }}
                    />
                  )}
                  {barreFingerNum > 0 && (
                    <text
                      x={getStringX(si)}
                      y={y + config.fontSize * 0.35}
                      textAnchor="middle"
                      fill={statusText}
                      className={statusText ? undefined : isRoot ? 'chord-root-text' : 'chord-dot-text'}
                      fontSize={config.fontSize}
                    >
                      {barreFingerNum}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Open and muted string indicators — colored by status */}
      {chord.frets.map((fret, i) => {
        const x = getStringX(i);
        const y = config.topY - 4;
        const r = config.dotRadius * 0.65;
        const statusFill = getStatusFill(i);
        const glow = getStatusGlow(i);

        if (fret === 0) {
          const isRoot = i === rootIdx;
          if (isRoot) {
            return statusFill
              ? <g key={`open-root-${i}`} style={glow ? { filter: glow } : undefined}><StatusDiamond x={x} y={y} r={r * 1.2} fill={statusFill} /></g>
              : <RootDiamond key={`open-root-${i}`} x={x} y={y} r={r * 1.2} />;
          }
          return (
            <circle
              key={`open-${i}`}
              cx={x}
              cy={y}
              r={r}
              fill={statusFill ? 'none' : undefined}
              stroke={statusFill ?? undefined}
              strokeWidth={statusFill ? 2 : undefined}
              className={statusFill ? undefined : 'chord-open'}
              style={{ ...(glow ? { filter: glow } : {}), transition: 'stroke 0.15s ease' }}
            />
          );
        }
        if (fret === -1) {
          return (
            <g key={`muted-${i}`}>
              <line
                x1={x - r}
                y1={y - r}
                x2={x + r}
                y2={y + r}
                className="chord-muted"
              />
              <line
                x1={x + r}
                y1={y - r}
                x2={x - r}
                y2={y + r}
                className="chord-muted"
              />
            </g>
          );
        }
        return null;
      })}

      {/* Finger dots (non-barre) — colored by status */}
      {chord.frets.map((fret, i) => {
        if (fret <= 0) return null;

        const relFret = fret - chord.baseFret + 1;
        if (relFret < 1 || relFret > numFrets) return null;

        // Skip if already rendered by barre section
        if (barreRenderedStrings.has(`${i}-${fret}`)) return null;

        const x = getStringX(i);
        const y = getFretY(relFret) - fretSpacing / 2;
        const isRoot = i === rootIdx;
        const statusFill = getStatusFill(i);
        const statusText = getStatusTextFill(i);
        const glow = getStatusGlow(i);

        return (
          <g key={`dot-${i}`} style={glow ? { filter: glow } : undefined}>
            {isRoot ? (
              statusFill ? (
                <StatusDiamond x={x} y={y} r={config.dotRadius} fill={statusFill} />
              ) : (
                <RootDiamond x={x} y={y} r={config.dotRadius} />
              )
            ) : (
              <circle
                cx={x}
                cy={y}
                r={config.dotRadius}
                fill={statusFill}
                className={statusFill ? undefined : 'chord-dot'}
                style={{ transition: 'fill 0.15s ease' }}
              />
            )}
            {chord.fingers[i] > 0 && (
              <text
                x={x}
                y={y + config.fontSize * 0.35}
                textAnchor="middle"
                fill={statusText}
                className={statusText ? undefined : isRoot ? 'chord-root-text' : 'chord-dot-text'}
                fontSize={config.fontSize}
              >
                {chord.fingers[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Light blue diamond shape for root notes */
function RootDiamond({ x, y, r }: { x: number; y: number; r: number }) {
  const d = r * 1.15;
  const points = `${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`;
  return <polygon points={points} className="chord-root" />;
}

/** Colored diamond for status feedback on root notes */
function StatusDiamond({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const d = r * 1.15;
  const points = `${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`;
  return <polygon points={points} fill={fill} style={{ transition: 'fill 0.15s ease' }} />;
}
