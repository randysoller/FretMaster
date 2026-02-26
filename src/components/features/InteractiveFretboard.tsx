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
  mode: 'place' | 'edit';
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

/** Barre creation mode state */
interface BarreMode {
  anchorFret: number;
  anchorString: number;
  selectedStrings: number[]; // strings selected so far (includes anchor)
}

/** Barre delete confirmation state */
interface BarreDeleteConfirm {
  fret: number;
  fromString: number;
  toString: number;
  x: number;
  y: number;
}

export default function InteractiveFretboard({ chord, width = 320, height = 420 }: InteractiveFretboardProps) {
  const { toggleMutedString, toggleOpenString, toggleOpenDiamond, addMarkerDirect, removeMarker, moveMarker, updateMarkerFinger, addBarreFromStrings, removeBarreByKey } = useCustomChordStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ fret: number; string: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Barre creation state
  const [barreMode, setBarreMode] = useState<BarreMode | null>(null);
  // Barre delete confirmation
  const [barreDeleteConfirm, setBarreDeleteConfirm] = useState<BarreDeleteConfirm | null>(null);
  const barreDoubleClickRef = useRef<{ fret: number; fromString: number; toString: number; time: number } | null>(null);

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
    if (!popup && !barreDeleteConfirm) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-finger-popup]') || target.closest('[data-barre-confirm]') || target.closest('[data-barre-connect]')) return;
      setPopup(null);
      setBarreDeleteConfirm(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopup(null);
        setBarreMode(null);
        setBarreDeleteConfirm(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popup, barreDeleteConfirm]);

  // Drag handlers
  const handlePointerDown = useCallback((marker: FretMarker, event: React.PointerEvent) => {
    // If in barre mode, handle barre selection instead of drag
    if (barreMode) return;

    event.preventDefault();
    event.stopPropagation();
    setPopup(null);
    setPendingDelete(null);
    setBarreDeleteConfirm(null);

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
  }, [clientToSvg, barreMode]);

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
      const svgCoords = clientToSvg(event.clientX, event.clientY);
      const target = svgToGrid(svgCoords.x, svgCoords.y);

      if (target.fret !== currentDrag.originFret || target.string !== currentDrag.originString) {
        moveMarker(currentDrag.originFret, currentDrag.originString, target.fret, target.string);
      }
      setDrag(null);
    } else {
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

  // Handle clicking a marker while in barre mode
  const handleBarreMarkerClick = useCallback((marker: FretMarker, event: React.MouseEvent) => {
    if (!barreMode) return;
    event.stopPropagation();

    // Must be on the same fret as anchor
    if (marker.fret !== barreMode.anchorFret) return;

    const alreadySelected = barreMode.selectedStrings.includes(marker.string);
    if (alreadySelected) {
      // Deselect (but don't deselect anchor)
      if (marker.string === barreMode.anchorString) return;
      setBarreMode({
        ...barreMode,
        selectedStrings: barreMode.selectedStrings.filter((s) => s !== marker.string),
      });
    } else {
      setBarreMode({
        ...barreMode,
        selectedStrings: [...barreMode.selectedStrings, marker.string],
      });
    }
  }, [barreMode]);

  const handleFretClick = useCallback((fret: number, string: number, event: React.MouseEvent) => {
    if (drag) return;

    // If in barre mode, check if clicking a marker on same fret
    if (barreMode) {
      const markerOnClick = chord.markers.find((m) => m.fret === fret && m.string === string);
      if (markerOnClick && fret === barreMode.anchorFret) {
        handleBarreMarkerClick(markerOnClick, event);
      }
      return;
    }

    const existing = chord.markers.find((m) => m.fret === fret && m.string === string);
    if (existing) return;
    setPendingDelete(null);
    setBarreDeleteConfirm(null);

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
  }, [chord.markers, drag, barreMode, handleBarreMarkerClick]);

  const handleFingerSelect = useCallback((finger: number, label: string) => {
    if (!popup) return;
    if (popup.mode === 'edit') {
      updateMarkerFinger(popup.fret, popup.string, finger, label);
    } else {
      addMarkerDirect(popup.fret, popup.string, finger, label);
    }
    setPopup(null);
  }, [popup, addMarkerDirect, updateMarkerFinger]);

  const handleDeleteFromPopup = useCallback(() => {
    if (!popup) return;
    removeMarker(popup.fret, popup.string);
    setPopup(null);
  }, [popup, removeMarker]);

  // Enter barre mode: called from finger popup "Barre" button
  const handleStartBarreMode = useCallback(() => {
    if (!popup) return;
    const marker = chord.markers.find((m) => m.fret === popup.fret && m.string === popup.string);
    if (!marker) return;
    setBarreMode({
      anchorFret: popup.fret,
      anchorString: popup.string,
      selectedStrings: [popup.string],
    });
    setPopup(null);
  }, [popup, chord.markers]);

  // Finalize barre connection
  const handleConnectBarre = useCallback(() => {
    if (!barreMode || barreMode.selectedStrings.length < 2) return;
    addBarreFromStrings(barreMode.anchorFret, barreMode.selectedStrings);
    setBarreMode(null);
  }, [barreMode, addBarreFromStrings]);

  const handleCancelBarreMode = useCallback(() => {
    setBarreMode(null);
  }, []);

  // Handle barre double-click for deletion
  const handleBarreClick = useCallback((barre: { fret: number; fromString: number; toString: number }, event: React.MouseEvent) => {
    event.stopPropagation();
    const now = Date.now();
    const prev = barreDoubleClickRef.current;

    if (prev && prev.fret === barre.fret && prev.fromString === barre.fromString && prev.toString === barre.toString && (now - prev.time) < 400) {
      // Double click detected — show confirm
      barreDoubleClickRef.current = null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setBarreDeleteConfirm({
          fret: barre.fret,
          fromString: barre.fromString,
          toString: barre.toString,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    } else {
      barreDoubleClickRef.current = { fret: barre.fret, fromString: barre.fromString, toString: barre.toString, time: now };
    }
  }, []);

  const handleConfirmBarreDelete = useCallback(() => {
    if (!barreDeleteConfirm) return;
    removeBarreByKey(barreDeleteConfirm.fret, barreDeleteConfirm.fromString, barreDeleteConfirm.toString);
    setBarreDeleteConfirm(null);
  }, [barreDeleteConfirm, removeBarreByKey]);

  const handleStringHeaderClick = (stringIdx: number) => {
    if (barreMode) return;
    setPopup(null);
    setPendingDelete(null);
    setBarreDeleteConfirm(null);
    const isMuted = chord.mutedStrings.has(stringIdx);
    const isOpen = chord.openStrings.has(stringIdx);
    const isDiamond = chord.openDiamonds?.has(stringIdx) ?? false;
    const hasMarkers = chord.markers.some((m) => m.string === stringIdx);

    if (hasMarkers) {
      toggleMutedString(stringIdx);
    } else if (!isMuted && !isOpen) {
      toggleOpenString(stringIdx);
    } else if (isOpen && !isDiamond) {
      toggleOpenDiamond(stringIdx);
    } else if (isOpen && isDiamond) {
      toggleOpenString(stringIdx);
      toggleMutedString(stringIdx);
    } else if (isMuted) {
      toggleMutedString(stringIdx);
    }
  };

  const dragGhost = drag?.hasMoved ? {
    x: drag.currentX,
    y: drag.currentY,
    marker: drag.marker,
    targetFret: svgToGrid(drag.currentX, drag.currentY).fret,
    targetString: svgToGrid(drag.currentX, drag.currentY).string,
  } : null;

  // Markers on the same fret as barre anchor (for highlighting eligible markers)
  const barreEligibleMarkers = barreMode
    ? chord.markers.filter((m) => m.fret === barreMode.anchorFret)
    : [];

  // Compute "Connect Now" button position (centered above the selected markers)
  const connectButtonPos = barreMode && barreMode.selectedStrings.length >= 2 ? (() => {
    const sorted = [...barreMode.selectedStrings].sort((a, b) => a - b);
    const centerStringX = (getStringX(sorted[0]) + getStringX(sorted[sorted.length - 1])) / 2;
    const fretY = getFretY(barreMode.anchorFret - 1) + fretSpacing / 2;
    // Position above the markers
    const svg = svgRef.current;
    const container = containerRef.current;
    if (svg && container) {
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = svgRect.width / width;
      const scaleY = svgRect.height / height;
      return {
        x: svgRect.left - containerRect.left + centerStringX * scaleX,
        y: svgRect.top - containerRect.top + (fretY - dotRadius - 20) * scaleY,
      };
    }
    return null;
  })() : null;

  return (
    <div ref={containerRef} className="relative inline-block touch-none">
      {/* Barre mode banner */}
      {barreMode && (
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center gap-2 rounded-t-lg bg-[hsl(38_75%_52%/0.15)] border-b border-[hsl(38_75%_52%/0.3)] px-3 py-1.5">
          <span className="text-[11px] font-body font-semibold text-[hsl(38_75%_52%)]">
            Barre Mode — Tap markers on fret {barreMode.anchorFret} to select
          </span>
          <button
            onClick={handleCancelBarreMode}
            className="text-[10px] font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] underline ml-1"
          >
            Cancel
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={`select-none ${barreMode ? 'cursor-pointer' : 'cursor-crosshair'}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* String labels at top */}
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
              {isOpen && !((chord.openDiamonds?.has(i)) ?? false) && (
                <circle cx={x} cy={36} r={7} stroke="hsl(33 14% 72%)" strokeWidth={1.5} fill="none" />
              )}
              {isOpen && (chord.openDiamonds?.has(i) ?? false) && (
                <polygon
                  points={`${x},${36 - 8.5} ${x + 8.5},${36} ${x},${36 + 8.5} ${x - 8.5},${36}`}
                  stroke="hsl(200 80% 62%)"
                  strokeWidth={1.8}
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
              {isOpen && (chord.openDiamonds?.has(i) ?? false) && (
                <text
                  x={x}
                  y={50}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="DM Sans, sans-serif"
                  fill="hsl(200 80% 62%)"
                  className="opacity-70"
                >
                  root
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
            fill="hsl(33 14% 72%)"
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
            stroke="#ffffff"
            strokeWidth={i === 0 && !showNut ? 2.5 : 2}
          />
        ))}

        {/* Fret dot inlays */}
        {Array.from({ length: numFrets }, (_, i) => {
          const absoluteFret = chord.baseFret + i;
          const inlayR = dotRadius / 2;
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
                className={`cursor-pointer ${barreMode ? 'hover:fill-[hsl(38_75%_52%/0.15)]' : 'hover:fill-[hsl(38_75%_52%/0.08)]'}`}
                onClick={(e) => handleFretClick(fretNum, stringIdx, e)}
              />
            );
          }),
        )}

        {/* Barre indicators */}
        {chord.barres.map((barre, idx) => {
          const y = getFretY(barre.fret - 1) + fretSpacing / 2;
          const barHeight = 1.5; // half of 3pt
          return (
            <rect
              key={`barre-${idx}-${barre.fret}-${barre.fromString}-${barre.toString}`}
              x={getStringX(barre.fromString)}
              y={y - barHeight}
              width={getStringX(barre.toString) - getStringX(barre.fromString)}
              height={barHeight * 2}
              rx={barHeight}
              fill={barre.color}
              opacity={0.9}
              className="cursor-pointer"
              onClick={(e) => handleBarreClick(barre, e)}
            />
          );
        })}

        {/* Barre mode: preview line connecting selected markers */}
        {barreMode && barreMode.selectedStrings.length >= 2 && (() => {
          const sorted = [...barreMode.selectedStrings].sort((a, b) => a - b);
          const y = getFretY(barreMode.anchorFret - 1) + fretSpacing / 2;
          const barHeight = 1.5;
          return (
            <rect
              x={getStringX(sorted[0])}
              y={y - barHeight}
              width={getStringX(sorted[sorted.length - 1]) - getStringX(sorted[0])}
              height={barHeight * 2}
              rx={barHeight}
              fill="hsl(38 75% 52%)"
              opacity={0.45}
              strokeDasharray="4 3"
              stroke="hsl(38 75% 52%)"
              strokeWidth={1}
            />
          );
        })()}

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
          const isDragged = drag?.hasMoved && drag.originFret === marker.fret && drag.originString === marker.string;
          const x = getStringX(marker.string);
          const y = getFretY(marker.fret - 1) + fretSpacing / 2;
          const displayLabel = marker.label || (marker.finger > 0 ? String(marker.finger) : '');

          // Highlight state for barre mode
          const isBarreEligible = barreMode && marker.fret === barreMode.anchorFret;
          const isBarreSelected = barreMode && barreMode.selectedStrings.includes(marker.string) && marker.fret === barreMode.anchorFret;
          const isBarreAnchor = barreMode && marker.fret === barreMode.anchorFret && marker.string === barreMode.anchorString;

          return (
            <g
              key={`marker-${marker.fret}-${marker.string}`}
              opacity={isDragged ? 0.25 : barreMode && !isBarreEligible ? 0.35 : 1}
              onPointerDown={barreMode ? undefined : (e) => handlePointerDown(marker, e)}
              onClick={barreMode ? (e) => handleBarreMarkerClick(marker, e) : undefined}
              className={barreMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            >
              {/* Selection ring for barre mode */}
              {isBarreSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={dotRadius + 4}
                  fill="none"
                  stroke="hsl(38 75% 52%)"
                  strokeWidth={2}
                  opacity={0.8}
                />
              )}
              {isBarreAnchor && (
                <circle
                  cx={x}
                  cy={y}
                  r={dotRadius + 6}
                  fill="none"
                  stroke="hsl(38 75% 52%)"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  opacity={0.5}
                />
              )}
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
              {/* Invisible larger hit area */}
              <circle cx={x} cy={y} r={dotRadius + 8} fill="transparent" />
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
            fill="hsl(33 14% 72%)"
            className="opacity-70"
          >
            {chord.baseFret + i}
          </text>
        ))}
      </svg>

      {/* Finger picker popup — includes Barre button */}
      {popup && !barreMode && (
        <div
          data-finger-popup
          className="absolute z-50 flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-lg shadow-black/40 px-1.5 py-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(Math.max(popup.x - 120, 4), width - 250),
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
          {/* Barre button — only for editing existing markers */}
          {popup.mode === 'edit' && (
            <button
              onClick={handleStartBarreMode}
              className="h-8 px-2 rounded-md text-[10px] font-bold font-body transition-all
                bg-[hsl(38_75%_52%/0.15)] text-[hsl(38_75%_52%)]
                hover:bg-[hsl(38_75%_52%/0.3)]
                active:scale-90 whitespace-nowrap"
              title="Create barre line from this marker"
            >
              Barre
            </button>
          )}
          {/* Delete button */}
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

      {/* Connect Now button (barre mode) */}
      {barreMode && barreMode.selectedStrings.length >= 2 && connectButtonPos && (
        <div
          data-barre-connect
          className="absolute z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: connectButtonPos.x - 55,
            top: Math.max(4, connectButtonPos.y - 16),
          }}
        >
          <button
            onClick={handleConnectBarre}
            className="rounded-lg px-3 py-1.5 text-[11px] font-body font-bold transition-all
              bg-[hsl(38_75%_52%)] text-[hsl(var(--bg-base))]
              hover:bg-[hsl(38_85%_48%)] shadow-md shadow-black/30
              active:scale-95 whitespace-nowrap"
          >
            Connect Now
          </button>
          <button
            onClick={handleCancelBarreMode}
            className="rounded-lg px-2 py-1.5 text-[11px] font-body font-medium transition-all
              bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))]
              hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)]
              active:scale-95"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Barre delete confirmation popup */}
      {barreDeleteConfirm && (
        <div
          data-barre-confirm
          className="absolute z-50 rounded-lg border border-[hsl(var(--semantic-error)/0.3)] bg-[hsl(var(--bg-elevated))] shadow-lg shadow-black/40 p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(Math.max(barreDeleteConfirm.x - 75, 4), width - 160),
            top: barreDeleteConfirm.y < 80 ? barreDeleteConfirm.y + 12 : barreDeleteConfirm.y - 80,
          }}
        >
          <p className="text-[11px] font-body text-[hsl(var(--text-default))] text-center whitespace-nowrap">
            Remove this barre?
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmBarreDelete}
              className="flex-1 rounded-md py-1.5 text-[11px] font-body font-bold bg-[hsl(var(--semantic-error))] text-white hover:bg-[hsl(0_84%_50%)] active:scale-95 transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => setBarreDeleteConfirm(null)}
              className="flex-1 rounded-md py-1.5 text-[11px] font-body font-medium bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function isLightColor(color: string): boolean {
  const hslMatch = color.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (hslMatch) {
    const l = parseFloat(hslMatch[3]);
    return l > 55;
  }
  const c = color.replace('#', '');
  if (c.length >= 6) {
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  }
  return false;
}
