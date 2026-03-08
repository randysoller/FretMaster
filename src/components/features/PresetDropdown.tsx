import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import type { ChordPreset } from '@/stores/presetStore';

interface PresetDropdownProps {
  presets: ChordPreset[];
  activePresetId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function PresetDropdown({ presets, activePresetId, onActivate, onDeactivate, onDelete, onReorder }: PresetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragVisual, setDragVisual] = useState<{ from: number; over: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Refs for drag state (avoid stale closures)
  const dragRef = useRef<{
    fromIndex: number;
    currentOver: number;
    itemHeight: number;
    listTop: number;
    isActive: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    startY: number;
  } | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (dragRef.current?.longPressTimer) clearTimeout(dragRef.current.longPressTimer);
    };
  }, []);

  const activateDrag = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-preset-item]');
    const firstItem = items[0] as HTMLElement | undefined;
    const itemHeight = firstItem?.offsetHeight || 48;
    const listTop = listRef.current.getBoundingClientRect().top;

    dragRef.current = {
      ...(dragRef.current!),
      fromIndex: index,
      currentOver: index,
      itemHeight,
      listTop,
      isActive: true,
    };
    setDragVisual({ from: index, over: index });
    try { navigator.vibrate?.(30); } catch (_) { /* not supported */ }
  }, []);

  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const pointerType = e.pointerType;

    dragRef.current = {
      fromIndex: index,
      currentOver: index,
      itemHeight: 48,
      listTop: 0,
      isActive: false,
      longPressTimer: null,
      startY,
    };

    if (pointerType === 'touch') {
      dragRef.current.longPressTimer = setTimeout(() => {
        activateDrag(index);
      }, 200);
    } else {
      activateDrag(index);
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;

      // Cancel long-press if moved too far before activation
      if (!dragRef.current.isActive) {
        const dy = Math.abs(ev.clientY - dragRef.current.startY);
        if (dy > 8) {
          if (dragRef.current.longPressTimer) clearTimeout(dragRef.current.longPressTimer);
          dragRef.current = null;
          setDragVisual(null);
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
        }
        return;
      }

      // Calculate which index the pointer is over
      const { listTop, itemHeight } = dragRef.current;
      const relY = ev.clientY - listTop;
      const newOver = Math.max(0, Math.min(presets.length - 1, Math.floor(relY / itemHeight)));

      if (newOver !== dragRef.current.currentOver) {
        dragRef.current.currentOver = newOver;
        setDragVisual({ from: dragRef.current.fromIndex, over: newOver });
      }
    };

    const onUp = () => {
      if (dragRef.current) {
        if (dragRef.current.longPressTimer) clearTimeout(dragRef.current.longPressTimer);
        if (dragRef.current.isActive) {
          const { fromIndex, currentOver } = dragRef.current;
          if (fromIndex !== currentOver) {
            onReorder(fromIndex, currentOver);
          }
        }
      }
      dragRef.current = null;
      setDragVisual(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [activateDrag, presets.length, onReorder]);

  const getItemTransformY = (index: number): number => {
    if (!dragVisual) return 0;
    const { from, over } = dragVisual;
    if (index === from) return 0; // Dragged item handled separately via opacity
    if (from < over) {
      if (index > from && index <= over) return -1;
    } else if (from > over) {
      if (index >= over && index < from) return 1;
    }
    return 0;
  };

  const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : null;

  const handleTogglePreset = (id: string) => {
    if (activePresetId === id) {
      onDeactivate();
    } else {
      onActivate(id);
    }
  };

  const handleConfirmDelete = (id: string) => {
    onDelete(id);
    setConfirmDeleteId(null);
  };

  if (presets.length === 0) return null;

  const isDragging = dragVisual !== null;

  return (
    <div ref={dropdownRef} className="relative -mt-1 mb-0.5">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-display font-semibold transition-all active:scale-95 w-full sm:w-auto ${
          activePreset
            ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] shadow-md shadow-[hsl(var(--color-primary)/0.15)]'
            : isOpen
              ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-default))]'
              : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
        }`}
      >
        <Bookmark className={`size-4 shrink-0 ${activePreset ? 'fill-current' : ''}`} />
        <span className="truncate">
          {activePreset ? activePreset.name : 'EASY START - Presets'}
        </span>
        <span className={`text-[10px] font-body tabular-nums px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${
          activePreset
            ? 'bg-[hsl(var(--color-primary)/0.2)] text-[hsl(var(--color-primary))]'
            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))]'
        }`}>
          {presets.length}
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-full sm:w-80 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/50 overflow-hidden z-50 max-h-[50vh] overflow-y-auto"
          >
            <div className="px-3.5 py-2.5 border-b border-[hsl(var(--border-subtle))] flex items-center justify-between">
              <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-widest">
                EASY START - Presets
              </span>
              {activePreset && (
                <button
                  onClick={() => { onDeactivate(); setIsOpen(false); }}
                  className="text-[10px] font-body text-[hsl(var(--color-primary))] hover:underline underline-offset-2"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Preset list */}
            <div ref={listRef} className="relative">
              {presets.map((preset, index) => {
                const isActive = activePresetId === preset.id;
                const isBeingDragged = dragVisual?.from === index;
                const shiftDir = getItemTransformY(index);
                // Measure approximate item height for shifting
                const shiftPx = shiftDir !== 0 ? shiftDir * 48 : 0;

                return (
                  <div
                    key={preset.id}
                    data-preset-item
                    className={`flex items-center gap-1.5 px-2 py-2 transition-all duration-150 ${
                      isBeingDragged
                        ? 'bg-[hsl(var(--color-primary)/0.15)] scale-[1.02] shadow-lg shadow-[hsl(var(--color-primary)/0.2)] z-10 relative rounded-lg'
                        : isActive
                          ? 'bg-[hsl(var(--color-primary)/0.1)]'
                          : 'hover:bg-[hsl(var(--bg-overlay))]'
                    }`}
                    style={{
                      transform: shiftPx ? `translateY(${shiftPx}px)` : undefined,
                      opacity: isBeingDragged ? 0.85 : 1,
                    }}
                  >
                    {/* Drag handle */}
                    <button
                      onPointerDown={(e) => handlePointerDown(index, e)}
                      className={`size-7 flex items-center justify-center rounded-md shrink-0 cursor-grab transition-colors select-none ${
                        isBeingDragged
                          ? 'text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.15)] cursor-grabbing'
                          : 'text-[hsl(var(--text-muted)/0.5)] hover:text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-surface))]'
                      }`}
                      style={{ touchAction: 'none' }}
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="size-4" />
                    </button>

                    {/* Preset info — clickable to activate */}
                    <button
                      onClick={() => { if (!isDragging) handleTogglePreset(preset.id); }}
                      className="flex-1 flex items-center gap-2 min-w-0 text-left py-0.5"
                    >
                      <Bookmark className={`size-3.5 shrink-0 ${isActive ? 'text-[hsl(var(--color-primary))] fill-current' : 'text-[hsl(var(--text-muted))]'}`} />
                      <span className={`text-sm font-display font-semibold truncate ${
                        isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                      }`}>
                        {preset.name}
                      </span>
                      <span className={`text-[10px] font-body tabular-nums px-1.5 py-0.5 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-[hsl(var(--color-primary)/0.2)] text-[hsl(var(--color-primary))]'
                          : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))]'
                      }`}>
                        {preset.chordIds.length}
                      </span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(preset.id); }}
                      className="size-7 flex items-center justify-center rounded-md shrink-0 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.1)] transition-colors"
                      aria-label="Delete preset"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Hint text */}
            <div className="px-3.5 py-2 border-t border-[hsl(var(--border-subtle))]">
              <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.6)]">
                {presets.length > 1 ? 'Drag the grip handle to reorder' : 'Save more presets from the Chord Library'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmDeleteId && (() => {
          const targetPreset = presets.find((p) => p.id === confirmDeleteId);
          if (!targetPreset) return null;
          return (
            <motion.div
              key="confirm-delete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            >
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="relative w-full max-w-[280px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-2xl shadow-black/60 p-5"
              >
                <p className="text-sm font-display font-semibold text-[hsl(var(--text-default))] text-center mb-1">Delete Preset</p>
                <p className="text-xs font-body text-[hsl(var(--text-subtle))] text-center mb-4">
                  Delete &ldquo;{targetPreset.name}&rdquo;? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 rounded-xl border border-[hsl(var(--border-default))] py-2.5 text-sm font-body font-medium text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleConfirmDelete(targetPreset.id)}
                    className="flex-1 rounded-xl bg-[hsl(var(--semantic-error))] py-2.5 text-sm font-body font-bold text-white active:scale-95 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
