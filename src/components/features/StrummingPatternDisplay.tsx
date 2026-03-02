import { useEffect, useRef, useState, useCallback } from 'react';
import { useMetronomeStore, onBeat } from '@/stores/metronomeStore';
import type { StrummingPattern, StrumType } from '@/constants/strumming';
import { getStyleStrumming, getCustomStrumPatterns, saveCustomStrumPattern, deleteCustomStrumPattern, nextStrumType } from '@/constants/strumming';
import { ChevronDown, Play, Square, Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Audio preview engine ────────────────────────────────

let previewCtx: AudioContext | null = null;
let previewStopTime = 0;
let previewRafId = 0;

function stopPreview() {
  if (previewCtx) {
    try { previewCtx.close(); } catch {}
    previewCtx = null;
  }
  previewStopTime = 0;
  if (previewRafId) { cancelAnimationFrame(previewRafId); previewRafId = 0; }
}

function scheduleStrumHit(ctx: AudioContext, dest: AudioNode, time: number, type: StrumType) {
  const isAccent = type === 'Ad' || type === 'Au';
  const isDown = type === 'D' || type === 'Ad';
  const isMute = type === 'mute';

  const duration = isMute ? 0.018 : isAccent ? 0.065 : 0.045;
  const bufSize = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);

  let seed = 54321 + Math.floor(time * 1000);
  for (let i = 0; i < bufSize; i++) {
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 2147483647) * 2 - 1;
    const env = Math.exp(-i / (bufSize * (isMute ? 0.15 : 0.3)));
    // Hann fade-in/out for click-free
    const fadeIn = i < 32 ? 0.5 * (1 - Math.cos(Math.PI * i / 32)) : 1;
    const fadeOut = i > bufSize - 32 ? 0.5 * (1 + Math.cos(Math.PI * (i - (bufSize - 32)) / 32)) : 1;
    data[i] = noise * env * fadeIn * fadeOut;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // Bandpass for tonal character
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = isMute ? 900 : isDown ? 280 : 420;
  bp.Q.value = isMute ? 2.5 : 1.2;

  // Add a percussive body resonance
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = isMute ? 1200 : isDown ? 180 : 250;
  body.Q.value = 2;
  body.gain.value = isAccent ? 6 : 4;

  const gain = ctx.createGain();
  const vol = isAccent ? 0.7 : isMute ? 0.35 : 0.45;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  src.connect(bp);
  bp.connect(body);
  body.connect(gain);
  gain.connect(dest);
  src.start(time);
}

function playPatternPreview(
  pattern: StrummingPattern,
  bpm: number,
  onTick?: (idx: number) => void,
  onEnd?: () => void,
): () => void {
  stopPreview();

  const ctx = new AudioContext();
  previewCtx = ctx;

  const secPerBeat = 60 / bpm;
  const secPerSub = secPerBeat / pattern.subdivisions;
  const startTime = ctx.currentTime + 0.05;

  pattern.pattern.forEach((action, i) => {
    if (action === 'rest') return;
    const time = startTime + i * secPerSub;
    scheduleStrumHit(ctx, ctx.destination, time, action);
  });

  const totalDuration = pattern.pattern.length * secPerSub;
  previewStopTime = startTime + totalDuration;

  // RAF loop for position tracking
  if (onTick) {
    const tick = () => {
      if (!previewCtx) return;
      const elapsed = ctx.currentTime - startTime;
      if (elapsed >= totalDuration) {
        onTick(-1);
        if (onEnd) onEnd();
        stopPreview();
        return;
      }
      const idx = Math.floor(elapsed / secPerSub);
      onTick(Math.min(idx, pattern.pattern.length - 1));
      previewRafId = requestAnimationFrame(tick);
    };
    previewRafId = requestAnimationFrame(tick);
  } else {
    setTimeout(() => {
      if (onEnd) onEnd();
      stopPreview();
    }, (totalDuration + 0.2) * 1000);
  }

  return stopPreview;
}

// ─── Strum action rendering ─────────────────────────────

function StrumArrow({ type, active, index }: { type: StrumType; active: boolean; index: number }) {
  const isAccent = type === 'Ad' || type === 'Au';
  const isDown = type === 'D' || type === 'Ad';
  const isMute = type === 'mute';
  const isRest = type === 'rest';

  if (isRest) {
    return (
      <div
        className={`flex items-center justify-center w-full transition-all duration-100 ${
          active ? 'opacity-60' : 'opacity-20'
        }`}
        style={{ height: 36 }}
      >
        <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">·</span>
      </div>
    );
  }

  if (isMute) {
    return (
      <div
        className={`flex items-center justify-center w-full rounded-md transition-all duration-100 ${
          active
            ? 'bg-[hsl(var(--text-muted)/0.25)]'
            : 'bg-[hsl(var(--text-muted)/0.06)]'
        }`}
        style={{ height: 36 }}
      >
        <span className={`font-display text-xs font-bold transition-colors duration-100 ${
          active ? 'text-[hsl(var(--text-subtle))]' : 'text-[hsl(var(--text-muted)/0.4)]'
        }`}>
          ✕
        </span>
      </div>
    );
  }

  const color = active
    ? isAccent ? 'hsl(var(--color-emphasis))' : 'hsl(var(--color-primary))'
    : isAccent ? 'hsl(var(--color-emphasis) / 0.3)' : 'hsl(var(--text-muted) / 0.25)';

  const glowColor = isAccent
    ? 'hsl(var(--color-emphasis) / 0.4)'
    : 'hsl(var(--color-primary) / 0.3)';

  return (
    <div className="flex items-center justify-center w-full transition-all duration-100" style={{ height: 36 }}>
      <svg
        width={isAccent ? 20 : 16}
        height={isAccent ? 28 : 24}
        viewBox="0 0 16 24"
        className={`transition-all duration-100 ${active ? 'scale-110' : ''}`}
        style={{ filter: active ? `drop-shadow(0 0 6px ${glowColor})` : 'none' }}
      >
        {isDown ? (
          <>
            <line x1="8" y1="2" x2="8" y2="18" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" />
            <polyline points="3,14 8,20 13,14" fill="none" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <line x1="8" y1="22" x2="8" y2="6" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" />
            <polyline points="3,10 8,4 13,10" fill="none" stroke={color} strokeWidth={isAccent ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Editor cell (clickable to cycle strum type) ─────────

function EditorCell({ type, onClick }: { type: StrumType; onClick: () => void }) {
  const isAccent = type === 'Ad' || type === 'Au';
  const isDown = type === 'D' || type === 'Ad';
  const isMute = type === 'mute';
  const isRest = type === 'rest';

  const label = isRest ? '·' : isMute ? '✕' : isDown ? '↓' : '↑';
  const sublabel = isAccent ? 'ACC' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-150 active:scale-90 min-w-[36px] h-[52px] ${
        isRest
          ? 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))]'
          : isMute
            ? 'border-[hsl(var(--text-muted)/0.3)] bg-[hsl(var(--text-muted)/0.08)]'
            : isAccent
              ? 'border-[hsl(var(--color-emphasis)/0.5)] bg-[hsl(var(--color-emphasis)/0.1)]'
              : 'border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.08)]'
      }`}
    >
      <span className={`text-base font-display font-bold leading-none ${
        isRest
          ? 'text-[hsl(var(--text-muted)/0.4)]'
          : isMute
            ? 'text-[hsl(var(--text-muted))]'
            : isAccent
              ? 'text-[hsl(var(--color-emphasis))]'
              : 'text-[hsl(var(--color-primary))]'
      }`}>
        {label}
      </span>
      {sublabel && (
        <span className="text-[7px] font-display font-bold text-[hsl(var(--color-emphasis))] leading-none mt-0.5">
          {sublabel}
        </span>
      )}
    </button>
  );
}

// ─── Pattern Editor ──────────────────────────────────────

function PatternEditor({
  initialPattern,
  onSave,
  onCancel,
}: {
  initialPattern?: StrummingPattern;
  onSave: (pattern: StrummingPattern) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialPattern?.name ?? '');
  const [subdivisions, setSubdivisions] = useState(initialPattern?.subdivisions ?? 2);
  const [beats, setBeats] = useState(initialPattern?.beats ?? 4);
  const [cells, setCells] = useState<StrumType[]>(() => {
    if (initialPattern) return [...initialPattern.pattern];
    return Array(4 * 2).fill('D') as StrumType[];
  });

  // Reset cells when subdivisions or beats change
  const handleSubChange = (sub: number) => {
    const total = beats * sub;
    const newCells: StrumType[] = [];
    for (let i = 0; i < total; i++) {
      newCells.push(cells[i] ?? 'D');
    }
    setCells(newCells);
    setSubdivisions(sub);
  };

  const handleBeatChange = (b: number) => {
    const total = b * subdivisions;
    const newCells: StrumType[] = [];
    for (let i = 0; i < total; i++) {
      newCells.push(cells[i] ?? 'D');
    }
    setCells(newCells);
    setBeats(b);
  };

  const handleCellClick = (idx: number) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = nextStrumType(next[idx]);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const pattern: StrummingPattern = {
      id: initialPattern?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      description: 'Custom pattern',
      subdivisions,
      beats,
      pattern: cells,
    };
    onSave(pattern);
  };

  // Preview
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(-1);
  const bpm = useMetronomeStore((s) => s.bpm);

  const handlePreview = () => {
    if (isPreviewPlaying) {
      stopPreview();
      setIsPreviewPlaying(false);
      setPreviewIdx(-1);
      return;
    }
    setIsPreviewPlaying(true);
    const tempPattern: StrummingPattern = {
      id: 'preview',
      name: 'Preview',
      description: '',
      subdivisions,
      beats,
      pattern: cells,
    };
    playPatternPreview(
      tempPattern,
      bpm,
      (idx) => setPreviewIdx(idx),
      () => { setIsPreviewPlaying(false); setPreviewIdx(-1); },
    );
  };

  return (
    <div className="space-y-3">
      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pattern name..."
        className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.6)]"
      />

      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Feel</span>
          <div className="flex items-center gap-1">
            {([
              { val: 2, label: '8ths' },
              { val: 3, label: 'Triplets' },
              { val: 4, label: '16ths' },
            ] as const).map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => handleSubChange(opt.val)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-display font-bold transition-all ${
                  subdivisions === opt.val
                    ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Beats</span>
          <div className="flex items-center gap-1">
            {[2, 3, 4].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => handleBeatChange(b)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-display font-bold transition-all ${
                  beats === b
                    ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tap instruction */}
      <p className="text-[10px] font-body text-[hsl(var(--text-muted))]">
        Tap each cell to cycle: ↓ Down → ↓ Accent → ↑ Up → ↑ Accent → ✕ Mute → · Rest
      </p>

      {/* Editor grid */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
        {Array.from({ length: beats }, (_, beatIdx) => (
          <div key={beatIdx} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-display font-bold tabular-nums text-[hsl(var(--text-muted)/0.5)]">
              {beatIdx + 1}
            </span>
            <div className="flex items-center gap-[3px]">
              {Array.from({ length: subdivisions }, (_, s) => {
                const idx = beatIdx * subdivisions + s;
                const isHighlighted = idx === previewIdx;
                return (
                  <div
                    key={s}
                    className={`transition-all duration-100 rounded-lg ${isHighlighted ? 'ring-2 ring-[hsl(var(--semantic-success))] scale-105' : ''}`}
                  >
                    <EditorCell
                      type={cells[idx] ?? 'rest'}
                      onClick={() => handleCellClick(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handlePreview}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-display font-bold transition-all ${
            isPreviewPlaying
              ? 'bg-[hsl(var(--semantic-error)/0.12)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.3)]'
              : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
          }`}
        >
          {isPreviewPlaying ? <Square className="size-3" /> : <Play className="size-3" />}
          {isPreviewPlaying ? 'Stop' : `Preview (${bpm} BPM)`}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-display font-bold text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-all"
          >
            <X className="size-3" /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-display font-bold bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check className="size-3" /> Save Pattern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Beat group divider ──────────────────────────────────

function BeatGroup({
  beatIndex,
  subdivisions,
  pattern,
  activeSubIndex,
  patternOffset,
}: {
  beatIndex: number;
  subdivisions: number;
  pattern: StrumType[];
  activeSubIndex: number;
  patternOffset: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-display font-bold tabular-nums transition-colors duration-100 ${
        activeSubIndex >= patternOffset && activeSubIndex < patternOffset + subdivisions
          ? 'text-[hsl(var(--color-primary))]'
          : 'text-[hsl(var(--text-muted)/0.4)]'
      }`}>
        {beatIndex + 1}
      </span>
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: subdivisions }, (_, s) => {
          const pIdx = patternOffset + s;
          const action = pattern[pIdx % pattern.length];
          const isActive = pIdx === activeSubIndex;
          return (
            <div
              key={s}
              className={`rounded-md transition-all duration-100 ${
                isActive
                  ? 'bg-[hsl(var(--color-primary)/0.12)] ring-1 ring-[hsl(var(--color-primary)/0.4)]'
                  : 'bg-transparent'
              }`}
              style={{ width: subdivisions <= 2 ? 32 : subdivisions <= 3 ? 26 : 22, minWidth: 18 }}
            >
              <StrumArrow type={action} active={isActive} index={pIdx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Play button for preset patterns ─────────────────────

function PatternPlayButton({
  pattern,
  compact,
}: {
  pattern: StrummingPattern;
  compact?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const bpm = useMetronomeStore((s) => s.bpm);

  const handleClick = useCallback(() => {
    if (isPlaying) {
      stopPreview();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    playPatternPreview(pattern, bpm, undefined, () => setIsPlaying(false));
  }, [isPlaying, pattern, bpm]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-center shrink-0 rounded-md transition-all duration-200 active:scale-90 ${
        compact ? 'size-7' : 'size-8'
      } ${
        isPlaying
          ? 'bg-[hsl(var(--semantic-error)/0.12)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.3)]'
          : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--color-primary))] hover:border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.06)]'
      }`}
      title={isPlaying ? 'Stop preview' : `Preview at ${bpm} BPM`}
    >
      {isPlaying ? <Square className="size-3" /> : <Play className="size-3" />}
    </button>
  );
}

// ─── Main display component ─────────────────────────────

interface StrummingPatternDisplayProps {
  styleId: string;
  animated?: boolean;
  patternId?: string;
  compact?: boolean;
}

export default function StrummingPatternDisplay({
  styleId,
  animated = true,
  patternId,
  compact = false,
}: StrummingPatternDisplayProps) {
  const stylePatterns = getStyleStrumming(styleId);
  const [customPatterns, setCustomPatterns] = useState(() => getCustomStrumPatterns());
  const allPatterns = [...stylePatterns, ...customPatterns];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSubIndex, setActiveSubIndex] = useState(-1);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPattern, setEditingPattern] = useState<StrummingPattern | undefined>(undefined);

  const metronome = useMetronomeStore();
  const lastBeatTimeRef = useRef(0);
  const rafRef = useRef(0);
  const currentBeatRef = useRef(0);

  const pattern = patternId
    ? allPatterns.find((p) => p.id === patternId) ?? allPatterns[0]
    : allPatterns[selectedIdx] ?? null;

  if (!pattern && !isEditing && allPatterns.length === 0) {
    // Show create button only
    return (
      <div className={`rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
        {isEditing ? (
          <PatternEditor
            initialPattern={editingPattern}
            onSave={(p) => {
              saveCustomStrumPattern(p);
              setCustomPatterns(getCustomStrumPatterns());
              setIsEditing(false);
              setEditingPattern(undefined);
              // Select the new pattern
              const newAll = [...stylePatterns, ...getCustomStrumPatterns()];
              const newIdx = newAll.findIndex((x) => x.id === p.id);
              if (newIdx >= 0) setSelectedIdx(newIdx);
            }}
            onCancel={() => { setIsEditing(false); setEditingPattern(undefined); }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
              Strumming Pattern
            </span>
            <button
              type="button"
              onClick={() => { setEditingPattern(undefined); setIsEditing(true); }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-display font-bold bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.22)] transition-all"
            >
              <Plus className="size-3" /> Create Pattern
            </button>
          </div>
        )}
      </div>
    );
  }

  const totalSteps = pattern ? pattern.pattern.length : 0;

  // Subscribe to beat events
  useEffect(() => {
    if (!animated) return;
    const unsub = onBeat((beat) => {
      currentBeatRef.current = beat;
      lastBeatTimeRef.current = performance.now();
    });
    return unsub;
  }, [animated]);

  // RAF loop
  useEffect(() => {
    if (!animated || isEditing) {
      setActiveSubIndex(-1);
      return;
    }

    const tick = () => {
      const state = useMetronomeStore.getState();
      if (!state.isPlaying || !pattern) {
        setActiveSubIndex(-1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      const beatDurationMs = (60 / state.bpm) * 1000;
      const elapsed = now - lastBeatTimeRef.current;
      const beatFraction = Math.min(elapsed / beatDurationMs, 0.999);
      const subInBeat = Math.floor(beatFraction * pattern.subdivisions);
      const beatInPattern = currentBeatRef.current % pattern.beats;
      const globalIdx = (beatInPattern * pattern.subdivisions + subInBeat) % totalSteps;

      setActiveSubIndex(globalIdx);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animated, pattern, totalSteps, isEditing]);

  const isCustomPattern = pattern ? pattern.id.startsWith('custom-') : false;

  const handleDeleteCustom = () => {
    if (!pattern || !isCustomPattern) return;
    deleteCustomStrumPattern(pattern.id);
    setCustomPatterns(getCustomStrumPatterns());
    setSelectedIdx(0);
  };

  const handleEditCustom = () => {
    if (!pattern || !isCustomPattern) return;
    setEditingPattern(pattern);
    setIsEditing(true);
  };

  return (
    <div className={`rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
      {isEditing ? (
        <PatternEditor
          initialPattern={editingPattern}
          onSave={(p) => {
            saveCustomStrumPattern(p);
            setCustomPatterns(getCustomStrumPatterns());
            setIsEditing(false);
            setEditingPattern(undefined);
            const newAll = [...stylePatterns, ...getCustomStrumPatterns()];
            const newIdx = newAll.findIndex((x) => x.id === p.id);
            if (newIdx >= 0) setSelectedIdx(newIdx);
          }}
          onCancel={() => { setIsEditing(false); setEditingPattern(undefined); }}
        />
      ) : (
        <>
          {/* Header with pattern selector, play button, and create button */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-display font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider shrink-0">
                Strumming Pattern
              </span>
              {pattern && <PatternPlayButton pattern={pattern} compact={compact} />}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Create pattern button */}
              <button
                type="button"
                onClick={() => { setEditingPattern(undefined); setIsEditing(true); }}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-display font-bold bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.25)] hover:bg-[hsl(var(--color-primary)/0.2)] transition-all"
                title="Create custom pattern"
              >
                <Plus className="size-3" />
                <span className="hidden sm:inline">Create</span>
              </button>

              {/* Edit/Delete for custom patterns */}
              {isCustomPattern && (
                <>
                  <button
                    type="button"
                    onClick={handleEditCustom}
                    className="flex items-center justify-center size-7 rounded-md text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--color-primary))] hover:border-[hsl(var(--color-primary)/0.3)] transition-all"
                    title="Edit pattern"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCustom}
                    className="flex items-center justify-center size-7 rounded-md text-[hsl(var(--text-muted))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--semantic-error))] hover:border-[hsl(var(--semantic-error)/0.3)] hover:bg-[hsl(var(--semantic-error)/0.06)] transition-all"
                    title="Delete pattern"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </>
              )}

              {/* Pattern selector dropdown */}
              {allPatterns.length > 1 && !patternId && (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-display font-bold bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-all"
                  >
                    <span className="max-w-[100px] truncate">{pattern?.name}</span>
                    <ChevronDown className={`size-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-30 top-full mt-1 right-0 w-60 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden max-h-[280px] overflow-y-auto"
                      >
                        {stylePatterns.length > 0 && (
                          <div className="px-3 pt-2 pb-1">
                            <span className="text-[9px] font-display font-bold text-[hsl(var(--text-muted)/0.5)] uppercase tracking-wider">Style Patterns</span>
                          </div>
                        )}
                        {stylePatterns.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedIdx(i); setDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 transition-colors ${
                              i === selectedIdx ? 'bg-[hsl(var(--color-primary)/0.1)]' : 'hover:bg-[hsl(var(--bg-overlay))]'
                            }`}
                          >
                            <p className={`text-xs font-display font-bold ${
                              i === selectedIdx ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                            }`}>{p.name}</p>
                            <p className="text-[10px] font-body text-[hsl(var(--text-muted))] mt-0.5">{p.description}</p>
                          </button>
                        ))}
                        {customPatterns.length > 0 && (
                          <div className="px-3 pt-2 pb-1 border-t border-[hsl(var(--border-subtle)/0.5)]">
                            <span className="text-[9px] font-display font-bold text-[hsl(var(--text-muted)/0.5)] uppercase tracking-wider">Custom Patterns</span>
                          </div>
                        )}
                        {customPatterns.map((p, ci) => {
                          const globalIdx = stylePatterns.length + ci;
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedIdx(globalIdx); setDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2.5 transition-colors ${
                                globalIdx === selectedIdx ? 'bg-[hsl(var(--color-primary)/0.1)]' : 'hover:bg-[hsl(var(--bg-overlay))]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <p className={`text-xs font-display font-bold ${
                                  globalIdx === selectedIdx ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                                }`}>{p.name}</p>
                                <span className="text-[8px] font-display font-bold text-[hsl(var(--color-emphasis))] bg-[hsl(var(--color-emphasis)/0.1)] rounded px-1 py-0.5">CUSTOM</span>
                              </div>
                              <p className="text-[10px] font-body text-[hsl(var(--text-muted))] mt-0.5">
                                {p.subdivisions === 2 ? '8ths' : p.subdivisions === 3 ? 'Triplets' : '16ths'} · {p.beats} beats
                              </p>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {!compact && pattern && (
            <p className="text-xs font-body text-[hsl(var(--text-muted))] mb-3">
              {pattern.description}
            </p>
          )}

          {/* Pattern visualization */}
          {pattern && (
            <div className="flex items-end justify-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
              {Array.from({ length: pattern.beats }, (_, beatIdx) => (
                <BeatGroup
                  key={beatIdx}
                  beatIndex={beatIdx}
                  subdivisions={pattern.subdivisions}
                  pattern={pattern.pattern}
                  activeSubIndex={activeSubIndex}
                  patternOffset={beatIdx * pattern.subdivisions}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          {!compact && (
            <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[hsl(var(--border-subtle)/0.5)]">
              <LegendItem symbol="↓" label="Down" color="text-[hsl(var(--text-muted))]" />
              <LegendItem symbol="↑" label="Up" color="text-[hsl(var(--text-muted))]" />
              <LegendItem symbol="↓" label="Accent" color="text-[hsl(var(--color-emphasis))]" bold />
              <LegendItem symbol="✕" label="Mute" color="text-[hsl(var(--text-muted))]" />
              <LegendItem symbol="·" label="Rest" color="text-[hsl(var(--text-muted))]" />
            </div>
          )}

          {/* Subdivision info */}
          {pattern && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.5)]">
                {pattern.subdivisions === 2 ? '8th notes' : pattern.subdivisions === 3 ? 'Triplets' : '16th notes'}
                {' · '}
                {pattern.beats} beats
                {isCustomPattern && ' · Custom'}
              </span>
              {animated && metronome.isPlaying && (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />
                  <span className="text-[10px] font-body text-[hsl(var(--semantic-success))]">Synced</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LegendItem({ symbol, label, color, bold }: { symbol: string; label: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-sm ${color} ${bold ? 'font-bold' : ''}`}>{symbol}</span>
      <span className="text-[9px] font-body text-[hsl(var(--text-muted)/0.5)]">{label}</span>
    </div>
  );
}

// ─── Setup preview (non-animated, with play buttons) ─────

export function StrummingPatternPreview({ styleId }: { styleId: string }) {
  const patterns = getStyleStrumming(styleId);
  if (patterns.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {patterns.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--bg-surface)/0.5)] px-3 py-2">
          {/* Play button */}
          <PatternPlayButton pattern={p} compact />

          {/* Mini pattern preview */}
          <div className="flex items-center gap-[1px] shrink-0">
            {p.pattern.slice(0, Math.min(p.pattern.length, 16)).map((action, i) => {
              const isAccent = action === 'Ad' || action === 'Au';
              const isDown = action === 'D' || action === 'Ad';
              const isUp = action === 'U' || action === 'Au';
              const isMute = action === 'mute';
              const isRest = action === 'rest';
              return (
                <span
                  key={i}
                  className={`text-[9px] font-display font-bold w-2.5 text-center ${
                    isRest
                      ? 'text-[hsl(var(--text-muted)/0.2)]'
                      : isMute
                        ? 'text-[hsl(var(--text-muted)/0.35)]'
                        : isAccent
                          ? 'text-[hsl(var(--color-emphasis))]'
                          : 'text-[hsl(var(--text-subtle)/0.6)]'
                  }`}
                >
                  {isRest ? '·' : isMute ? '✕' : isDown ? '↓' : isUp ? '↑' : '·'}
                </span>
              );
            })}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-display font-bold text-[hsl(var(--text-default))] truncate">
              {p.name}
            </p>
            <p className="text-[9px] font-body text-[hsl(var(--text-muted))] truncate">
              {p.subdivisions === 2 ? '8ths' : p.subdivisions === 3 ? 'Triplets' : '16ths'}
              {' · '}
              {p.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
