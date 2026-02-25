import { useState, useRef, useEffect, useCallback } from 'react';
import { useCustomChordStore } from '@/stores/customChordStore';
import type { CustomChordData, FretMarker } from '@/types/customChord';

interface InteractiveFretboardProps {
  chord: CustomChordData;
  width?: number;
  height?: number;
}

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRING_WIDTHS = [2.8, 2.4, 2.0, 1.5, 1.1, 0.8];

const FINGER_OPTIONS = [
  { value: 1, label: '1', finger: 1, customLabel: '' },
  { value: 2, label: '2', finger: 2, customLabel: '' },
  { value: 3, label: '3', finger: 3, customLabel: '' },
  { value: 4, label: '4', finger: 4, customLabel: '' },
  { value: 'T', label: 'T', finger: 0, customLabel: 'T' },
  { value: 0, label: '–', finger: 0, customLabel: '' },
];

interface PopupState {
  fret: number;
  string: number;
  x: number;
  y: number;
  mode: 'place' | 'edit'; // 'place' = new marker, 'edit' = change finger on existing
}

interface DragState {
  marker: FretMarker;
  originFret: number;
  originString: number;
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

export default function InteractiveFretboard({ chord, width = 320, height = 420 }: InteractiveFretboardProps) {
  const { toggleMutedString, toggleOpenString, addMarkerDirect, removeMarker, moveMarker, updateMarkerFinger } = useCustomChordStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ fret: number; string: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

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

  const DRAG_THRESHOLD = 6;

  // Convert client coords to SVG coords
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [width, height]);

  // Find nearest fret/string from SVG coords
  const svgToGrid = useCallback((svgX: number, svgY: number) => {
    const string = Math.round((svgX - padLeft) / stringSpacing);
    const clampedString = Math.max(0, Math.min(numStrings - 1, string));
    const fretFloat = (svgY - padTop) / fretSpacing;
    const fret = Math.round(fretFloat + 0.5);
    const clampedFret = Math.max(1, Math.min(numFrets, fret));
    return { fret: clampedFret, string: clampedString };
  }, [padLeft, padTop, stringSpacing, fretSpacing, numStrings, numFrets]);

  // Close popup on outside click
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-finger-popup]')) return;
      setPopup(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popup]);

  // Drag handlers
  const handlePointerDown = useCallback((marker: FretMarker, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPopup(null);
    setPendingDelete(null);

    const svgCoords = clientToSvg(event.clientX, event.clientY);
    const newDrag: DragState = {
      marker,
      originFret: marker.fret,
      originString: marker.string,
      currentX: svgCoords.x,
      currentY: svgCoords.y,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
    };
    setDrag(newDrag);
    dragRef.current = newDrag;

    (event.target as Element).setPointerCapture?.(event.pointerId);
  }, [clientToSvg]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const svgCoords = clientToSvg(event.clientX, event.clientY);
    const newDrag = {
      ...dragRef.current,
      currentX: svgCoords.x,
      currentY: svgCoords.y,
      hasMoved: dragRef.current.hasMoved || distance > DRAG_THRESHOLD,
    };
    dragRef.current = newDrag;
    setDrag(newDrag);
  }, [clientToSvg]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const currentDrag = dragRef.current;
    if (!currentDrag) return;
    dragRef.current = null;

    if (currentDrag.hasMoved) {
      // Complete the drop — find target fret/string
      const svgCoords = clientToSvg(event.clientX, event.clientY);
      const target = svgToGrid(svgCoords.x, svgCoords.y);

      if (target.fret !== currentDrag.originFret || target.string !== currentDrag.originString) {
        moveMarker(currentDrag.originFret, currentDrag.originString, target.fret, target.string);
      }
      setDrag(null);
    } else {
      // It was a tap/click on marker — show finger picker
      setDrag(null);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setPopup({
          fret: currentDrag.originFret,
          string: currentDrag.originString,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          mode: 'edit',
        });
      }
    }
  }, [clientToSvg, svgToGrid, moveMarker]);

  const handleFretClick = useCallback((fret: number, string: number, event: React.MouseEvent) => {
    if (drag) return;
    const existing = chord.markers.find((m) => m.fret === fret && m.string === string);
    if (existing) {
      // Existing marker clicked without drag — this is handled by pointer events on marker
      return;
    }
    setPendingDelete(null);

    // Get click position relative to container — show new marker popup
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPopup({
        fret,
        string,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        mode: 'place',
      });
    }
  }, [chord.markers, drag]);

  const handleFingerSelect = useCallback((finger: number, label: string) => {
    if (!popup) return;
    if (popup.mode === 'edit') {
      // Update existing marker's finger
      updateMarkerFinger(popup.fret, popup.string, finger, label);
    } else {
      // Place new marker
      addMarkerDirect(popup.fret, popup.string, finger, label);
    }
    setPopup(null);
  }, [popup, addMarkerDirect, updateMarkerFinger]);

  const handleDeleteFromPopup = useCallback(() => {
    if (!popup) return;
    removeMarker(popup.fret, popup.string);
    setPopup(null);
  }, [popup, removeMarker]);

  const handleStringHeaderClick = (stringIdx: number) => {
    setPopup(null);
    setPendingDelete(null);
    const isMuted = chord.mutedStrings.has(stringIdx);
    const isOpen = chord.openStrings.has(stringIdx);
    const hasMarkers = chord.markers.some((m) => m.string === stringIdx);

    if (hasMarkers) {
      toggleMutedString(stringIdx);
    } else if (!isMuted && !isOpen) {
      toggleOpenString(stringIdx);
    } else if (isOpen) {
      toggleOpenString(stringIdx);
      toggleMutedString(stringIdx);
    } else {
      toggleMutedString(stringIdx);
    }
  };

  // Compute drag ghost position
  const dragGhost = drag?.hasMoved ? {
    x: drag.currentX,
    y: drag.currentY,
    marker: drag.marker,
    targetFret: svgToGrid(drag.currentX, drag.currentY).fret,
    targetString: svgToGrid(drag.currentX, drag.currentY).string,
  } : null;

  return (
    <div ref={containerRef} className="relative inline-block touch-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="select-none cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* String labels at top — clickable to toggle open/muted */}
        {Array.from({ length: numStrings }, (_, i) => {
          const x = getStringX(i);
          const isMuted = chord.mutedStrings.has(i);
          const isOpen = chord.openStrings.has(i);

          return (
            <g key={`label-${i}`} onClick={() => handleStringHeaderClick(i)} className="cursor-pointer">
              <rect
                x={x - stringSpacing / 2}
                y={0}
                width={stringSpacing}
                height={padTop - 4}
                fill="transparent"
              />
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
            stroke="hsl(28 14% 42%)"
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

            return (
              <rect
                key={`zone-${fretIdx}-${stringIdx}`}
                x={x - stringSpacing / 2}
                y={getFretY(fretIdx)}
                width={stringSpacing}
                height={fretSpacing}
                fill="transparent"
                className="cursor-pointer hover:fill-[hsl(38_75%_52%/0.08)]"
                onClick={(e) => handleFretClick(fretNum, stringIdx, e)}
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

        {/* Drop target indicator */}
        {dragGhost && (
          <g opacity={0.3}>
            <circle
              cx={getStringX(dragGhost.targetString)}
              cy={getFretY(dragGhost.targetFret - 1) + fretSpacing / 2}
              r={dotRadius + 3}
              fill="none"
              stroke="hsl(38 75% 52%)"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          </g>
        )}

        {/* Placed markers */}
        {chord.markers.map((marker) => {
          // If this marker is being dragged, dim it in place
          const isDragged = drag?.hasMoved && drag.originFret === marker.fret && drag.originString === marker.string;
          const x = getStringX(marker.string);
          const y = getFretY(marker.fret - 1) + fretSpacing / 2;
          const displayLabel = marker.label || (marker.finger > 0 ? String(marker.finger) : '');

          return (
            <g
              key={`marker-${marker.fret}-${marker.string}`}
              opacity={isDragged ? 0.25 : 1}
              onPointerDown={(e) => handlePointerDown(marker, e)}
              className="cursor-grab active:cursor-grabbing"
            >
              {marker.shape === 'diamond' ? (
                <polygon
                  points={`${x},${y - dotRadius * 1.15} ${x + dotRadius * 1.15},${y} ${x},${y + dotRadius * 1.15} ${x - dotRadius * 1.15},${y}`}
                  fill={marker.color}
                  stroke={pendingDelete?.fret === marker.fret && pendingDelete?.string === marker.string ? '#ef4444' : 'none'}
                  strokeWidth={2.5}
                />
              ) : (
                <circle
                  cx={x} cy={y} r={dotRadius}
                  fill={marker.color}
                  stroke={pendingDelete?.fret === marker.fret && pendingDelete?.string === marker.string ? '#ef4444' : 'none'}
                  strokeWidth={2.5}
                />
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
                  pointerEvents="none"
                >
                  {displayLabel}
                </text>
              )}
              {/* Invisible larger hit area for easier grabbing */}
              <circle
                cx={x} cy={y}
                r={dotRadius + 8}
                fill="transparent"
              />
            </g>
          );
        })}

        {/* Drag ghost */}
        {dragGhost && (
          <g opacity={0.75} pointerEvents="none">
            {dragGhost.marker.shape === 'diamond' ? (
              <polygon
                points={`${dragGhost.x},${dragGhost.y - dotRadius * 1.15} ${dragGhost.x + dotRadius * 1.15},${dragGhost.y} ${dragGhost.x},${dragGhost.y + dotRadius * 1.15} ${dragGhost.x - dotRadius * 1.15},${dragGhost.y}`}
                fill={dragGhost.marker.color}
                stroke="hsl(38 75% 52%)"
                strokeWidth={2}
              />
            ) : (
              <circle
                cx={dragGhost.x} cy={dragGhost.y} r={dotRadius}
                fill={dragGhost.marker.color}
                stroke="hsl(38 75% 52%)"
                strokeWidth={2}
              />
            )}
            {(dragGhost.marker.label || dragGhost.marker.finger > 0) && (
              <text
                x={dragGhost.x}
                y={dragGhost.y + 4.5}
                textAnchor="middle"
                fontSize={13}
                fontFamily="DM Sans, sans-serif"
                fontWeight={700}
                fill={isLightColor(dragGhost.marker.color) ? '#1a1a1a' : '#fafafa'}
              >
                {dragGhost.marker.label || String(dragGhost.marker.finger)}
              </text>
            )}
          </g>
        )}

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

      {/* Finger picker popup */}
      {popup && (
        <div
          data-finger-popup
          className="absolute z-50 flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-lg shadow-black/40 px-1.5 py-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(Math.max(popup.x - 100, 4), width - 210),
            top: popup.y < 60 ? popup.y + 12 : popup.y - 44,
          }}
        >
          {FINGER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => handleFingerSelect(opt.finger, opt.customLabel)}
              className="size-8 rounded-md text-xs font-bold font-body transition-all
                bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))]
                hover:bg-[hsl(var(--color-primary))] hover:text-[hsl(var(--bg-base))]
                active:scale-90"
              title={opt.value === 'T' ? 'Thumb' : opt.value === 0 ? 'No label' : `Finger ${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
          {/* Delete button — only show when editing existing marker */}
          {popup.mode === 'edit' && (
            <button
              onClick={handleDeleteFromPopup}
              className="size-8 rounded-md text-xs font-bold font-body transition-all
                bg-[hsl(var(--semantic-error)/0.15)] text-[hsl(var(--semantic-error))]
                hover:bg-[hsl(var(--semantic-error))] hover:text-white
                active:scale-90"
              title="Remove marker"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isLightColor(color: string): boolean {
  // Handle HSL strings like "hsl(38 75% 52%)"
  const hslMatch = color.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (hslMatch) {
    const l = parseFloat(hslMatch[3]);
    return l > 55;
  }
  // Handle hex
  const c = color.replace('#', '');
  if (c.length >= 6) {
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  }
  return false;
}
