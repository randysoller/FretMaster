import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgressionStore, type ProgressionTimerDuration } from '@/stores/progressionStore';
import { NOTE_NAMES, NOTE_DISPLAY, SCALES, COMMON_PROGRESSIONS, resolveScaleChords } from '@/constants/scales';
import type { NoteName, ScaleDefinition, ProgressionPreset } from '@/constants/scales';
import { useChordDetection } from '@/hooks/useChordDetection';
import type { DetectionResult } from '@/hooks/useChordDetection';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import CountdownRing from '@/components/features/CountdownRing';
import VolumeControl from '@/components/features/VolumeControl';
import { useCountdown } from '@/hooks/useCountdown';
import { useChordAudio } from '@/hooks/useChordAudio';
import { motion, AnimatePresence } from 'framer-motion';
import { useMetronome, SOUND_LABELS, type MetronomeSoundType } from '@/hooks/useMetronome';
import {
  ArrowLeft,
  SkipForward,
  SkipBack,
  Eye,
  RotateCcw,
  Volume2,
  Play,
  Music,
  ChevronDown,
  X,
  Plus,
  Repeat,
  Timer,
  Trash2,
  Mic,
  MicOff,
  SlidersHorizontal,
  Minus,
  Gauge,
  ChevronUp,
} from 'lucide-react';

// ─── Shared Detection UI ─────────────────────────────────

const SENSITIVITY_KEY = 'fretmaster-detection-sensitivity';

function getStoredSensitivity(): number {
  try {
    const v = localStorage.getItem(SENSITIVITY_KEY);
    if (v) {
      const n = Number(v);
      if (n >= 1 && n <= 10) return n;
    }
  } catch {}
  return 5;
}

function DetectionFeedback({ result }: { result: DetectionResult }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          key={result}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none pb-[8px]"
        >
          <div
            className={`
              px-10 py-[17px] rounded-2xl backdrop-blur-md border-2
              ${result === 'correct'
                ? 'bg-[hsl(142_71%_45%/0.15)] border-[hsl(142_71%_45%/0.5)]'
                : 'bg-[hsl(0_84%_60%/0.15)] border-[hsl(0_84%_60%/0.5)]'
              }
            `}
          >
            <span
              className={`
                font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wider
                ${result === 'correct'
                  ? 'text-[hsl(142_71%_45%)]'
                  : 'text-[hsl(0_84%_60%)]'
                }
              `}
              style={{
                textShadow: result === 'correct'
                  ? '0 0 30px hsl(142 71% 45% / 0.5), 0 0 60px hsl(142 71% 45% / 0.2)'
                  : '0 0 30px hsl(0 84% 60% / 0.5), 0 0 60px hsl(0 84% 60% / 0.2)',
              }}
            >
              {result === 'correct' ? 'Correct' : 'Wrong'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SensitivitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label =
    value <= 3 ? 'Strict' : value <= 7 ? 'Balanced' : 'Sensitive';
  const labelColor =
    value <= 3
      ? 'text-[hsl(var(--semantic-info))]'
      : value <= 7
        ? 'text-[hsl(var(--color-primary))]'
        : 'text-[hsl(var(--semantic-success))]';

  return (
    <div className="flex items-center gap-3 min-w-0">
      <SlidersHorizontal className="size-3.5 text-[hsl(var(--text-muted))] shrink-0" />
      <span className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase tracking-wider shrink-0 hidden sm:inline">
        Sensitivity
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="volume-slider flex-1 min-w-[80px] max-w-[120px]"
          title={`Detection sensitivity: ${value}/10 (${label})`}
        />
        <span className={`text-xs font-display font-bold tabular-nums w-5 text-center ${labelColor}`}>
          {value}
        </span>
      </div>
      <span className={`text-[10px] font-body font-medium ${labelColor} shrink-0`}>
        {label}
      </span>
    </div>
  );
}

// ─── Metronome Controls (Practice View - Compact) ──────────

/** Get Italian tempo marking for a given BPM */
function getTempoMarking(bpm: number): string {
  if (bpm < 40) return 'Grave';
  if (bpm < 55) return 'Largo';
  if (bpm < 66) return 'Larghetto';
  if (bpm < 76) return 'Adagio';
  if (bpm < 92) return 'Andante';
  if (bpm < 108) return 'Moderato';
  if (bpm < 120) return 'Allegretto';
  if (bpm < 156) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

function MetronomeBar({
  isPlaying,
  bpm,
  beatsPerMeasure,
  currentBeat,
  soundType,
  onToggle,
  onBpmChange,
  onSoundChange,
}: {
  isPlaying: boolean;
  bpm: number;
  beatsPerMeasure: number;
  currentBeat: number;
  soundType: MetronomeSoundType;
  onToggle: () => void;
  onBpmChange: (v: number) => void;
  onSoundChange: (s: MetronomeSoundType) => void;
}) {
  const tempoMarking = getTempoMarking(bpm);
  const [soundOpen, setSoundOpen] = useState(false);
  const soundTypes: MetronomeSoundType[] = ['click', 'woodblock', 'voice', 'hihat', 'rimclick'];

  return (
    <div
      className={`
        mx-4 sm:mx-6 mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 rounded-lg px-4 py-2 border transition-colors duration-200
        ${isPlaying
          ? 'bg-[hsl(var(--color-primary)/0.06)] border-[hsl(var(--color-primary)/0.2)]'
          : 'bg-[hsl(var(--bg-elevated)/0.5)] border-[hsl(var(--border-subtle)/0.5)]'
        }
      `}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all duration-200
          ${isPlaying
            ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.25)]'
            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
          }
        `}
      >
        <Gauge className="size-3.5" />
        {isPlaying ? 'Stop' : 'Metronome'}
      </button>

      {/* Sound type compact selector */}
      <div className="relative">
        <button
          onClick={() => setSoundOpen(!soundOpen)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-body font-medium bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors border border-[hsl(var(--border-subtle))]"
        >
          <span>{SOUND_LABELS[soundType]}</span>
          <ChevronUp className={`size-3 transition-transform ${soundOpen ? 'rotate-180' : ''}`} />
        </button>
        {soundOpen && (
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden min-w-[120px]">
            {soundTypes.map((s) => (
              <button
                key={s}
                onClick={() => { onSoundChange(s); setSoundOpen(false); }}
                className={`
                  w-full text-left px-3 py-2 text-xs font-body transition-colors
                  ${s === soundType
                    ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-medium'
                    : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                  }
                `}
              >
                {SOUND_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BPM control */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onBpmChange(bpm - 5)}
          className="size-6 flex items-center justify-center rounded bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
        >
          <Minus className="size-3" />
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min={30}
            max={260}
            step={1}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="volume-slider w-[80px] sm:w-[100px]"
          />
          <span className="text-xs font-display font-bold text-[hsl(var(--color-primary))] tabular-nums w-8 text-center">
            {bpm}
          </span>
          <span className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase">bpm</span>
        </div>
        <button
          onClick={() => onBpmChange(bpm + 5)}
          className="size-6 flex items-center justify-center rounded bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* Tempo marking */}
      <span className="text-[10px] sm:text-xs font-body italic text-[hsl(var(--text-subtle))] min-w-[70px] text-center">
        {tempoMarking}
      </span>

      {/* Beat indicators */}
      {isPlaying && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: beatsPerMeasure }, (_, i) => {
            const isActive = i === currentBeat;
            const isAccentBeat = i === 0 || (beatsPerMeasure === 6 && i === 3);
            return (
              <div
                key={i}
                className={`
                  rounded-full transition-all duration-100
                  ${isActive
                    ? isAccentBeat
                      ? 'size-3.5 bg-[hsl(var(--color-emphasis))] shadow-[0_0_8px_hsl(var(--color-emphasis)/0.6)]'
                      : 'size-3 bg-[hsl(var(--color-primary))] shadow-[0_0_6px_hsl(var(--color-primary)/0.5)]'
                    : 'size-2.5 bg-[hsl(var(--border-default))]'
                  }
                `}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Metronome Setup Card ────────────────────────────────────

function MetronomeSetup({
  bpm,
  beatsPerMeasure,
  isPlaying,
  currentBeat,
  soundType,
  onBpmChange,
  onBeatsChange,
  onSoundChange,
  onToggle,
}: {
  bpm: number;
  beatsPerMeasure: number;
  isPlaying: boolean;
  currentBeat: number;
  soundType: MetronomeSoundType;
  onBpmChange: (v: number) => void;
  onBeatsChange: (v: number) => void;
  onSoundChange: (s: MetronomeSoundType) => void;
  onToggle: () => void;
}) {
  const soundTypes: MetronomeSoundType[] = ['click', 'woodblock', 'voice', 'hihat', 'rimclick'];
  const timeSigOptions = [
    { value: 2, label: '2/4' },
    { value: 3, label: '3/4' },
    { value: 4, label: '4/4' },
    { value: 6, label: '6/8' },
  ];

  const presetBpms = [60, 80, 100, 120, 140, 160];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Gauge className="size-4 text-[hsl(var(--color-primary))]" />
        <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
          Metronome
        </h3>
      </div>

      {/* BPM control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Tempo</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-body italic text-[hsl(var(--text-subtle))]">
              {getTempoMarking(bpm)}
            </span>
            <span className="text-lg font-display font-bold text-[hsl(var(--color-primary))] tabular-nums">
              {bpm} <span className="text-xs font-body font-normal text-[hsl(var(--text-muted))]">BPM</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onBpmChange(bpm - 1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            type="range"
            min={30}
            max={260}
            step={1}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="volume-slider flex-1"
          />
          <button
            onClick={() => onBpmChange(bpm + 1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {/* Quick-select BPM presets */}
        <div className="flex flex-wrap gap-1.5">
          {presetBpms.map((p) => (
            <button
              key={p}
              onClick={() => onBpmChange(p)}
              className={`
                rounded-md px-2.5 py-1 text-xs font-display font-bold transition-all duration-150
                ${bpm === p
                  ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)]'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))] border border-transparent'
                }
              `}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Sound type */}
      <div className="space-y-2">
        <span className="text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Sound</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {soundTypes.map((s) => (
            <button
              key={s}
              onClick={() => onSoundChange(s)}
              className={`
                rounded-lg px-3 py-2.5 text-sm font-display font-bold transition-all duration-200
                ${soundType === s
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                }
              `}
            >
              {SOUND_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Time signature */}
      <div className="space-y-2">
        <span className="text-xs font-body text-[hsl(var(--text-muted))] uppercase tracking-wider">Time Signature</span>
        <div className="flex gap-2">
          {timeSigOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onBeatsChange(opt.value)}
              className={`
                rounded-lg px-4 py-2 text-sm font-display font-bold transition-all duration-200
                ${beatsPerMeasure === opt.value
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview / tap-to-test */}
      <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface)/0.5)] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Beat dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: beatsPerMeasure }, (_, i) => {
              const isActive = isPlaying && i === currentBeat;
              const isAccentBeat = i === 0 || (beatsPerMeasure === 6 && i === 3);
              return (
                <div
                  key={i}
                  className={`
                    rounded-full transition-all duration-100
                    ${isActive
                      ? isAccentBeat
                        ? 'size-4 bg-[hsl(var(--color-emphasis))] shadow-[0_0_10px_hsl(var(--color-emphasis)/0.6)]'
                        : 'size-3.5 bg-[hsl(var(--color-primary))] shadow-[0_0_8px_hsl(var(--color-primary)/0.5)]'
                      : isAccentBeat
                        ? 'size-3 bg-[hsl(var(--border-default))] border border-[hsl(var(--text-muted)/0.3)]'
                        : 'size-2.5 bg-[hsl(var(--border-default))]'
                    }
                  `}
                />
              );
            })}
          </div>
          {isPlaying && (
            <span className="text-xs font-body text-[hsl(var(--text-muted))]">
              Playing...
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-display font-bold transition-all duration-200
            ${isPlaying
              ? 'bg-[hsl(var(--semantic-error)/0.12)] text-[hsl(var(--semantic-error))] border border-[hsl(var(--semantic-error)/0.3)] hover:bg-[hsl(var(--semantic-error)/0.2)]'
              : 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.2)]'
            }
          `}
        >
          {isPlaying ? (
            <>
              <span className="size-3 rounded-sm bg-current" />
              Stop
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Preview
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Setup View ──────────────────────────────────────────

function KeySelector({ value, onChange }: { value: NoteName; onChange: (k: NoteName) => void }) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider mb-3">
        Select Key
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {NOTE_NAMES.map((note) => {
          const isActive = value === note;
          return (
            <button
              key={note}
              onClick={() => onChange(note)}
              className={`
                relative flex flex-col items-center justify-center rounded-lg py-2.5 px-2 font-display text-sm font-bold transition-all duration-200
                ${isActive
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] glow-primary scale-105'
                  : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                }
              `}
            >
              <span>{note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScaleSelector({ value, onChange }: { value: ScaleDefinition; onChange: (s: ScaleDefinition) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider mb-3">
        Select Scale
      </h3>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-4 py-3 text-sm font-body text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
        >
          <span>{value.name}</span>
          <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden">
            {SCALES.map((scale) => (
              <button
                key={scale.id}
                onClick={() => { onChange(scale); setOpen(false); }}
                className={`
                  w-full text-left px-4 py-3 text-sm font-body transition-colors
                  ${scale.id === value.id
                    ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-medium'
                    : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                  }
                `}
              >
                {scale.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScaleChordsPreview({ selectedKey, selectedScale }: { selectedKey: NoteName; selectedScale: ScaleDefinition }) {
  const chords = useMemo(() => resolveScaleChords(selectedKey, selectedScale), [selectedKey, selectedScale]);

  return (
    <div>
      <h4 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-2">
        Chords in {selectedKey} {selectedScale.name.replace(' Scale', '')}
      </h4>
      <div className="flex flex-wrap gap-2">
        {chords.map((c, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-md bg-[hsl(var(--bg-surface))] px-3 py-2 min-w-[52px]"
          >
            <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">{c.roman}</span>
            <span className="text-sm font-display font-bold text-[hsl(var(--text-default))]">{c.chordSymbol}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressionPresetSelector({
  selectedKey,
  selectedScale,
  selectedPreset,
  customDegrees,
  useCustom,
  onSelectPreset,
  onToggleDegree,
  onClearCustom,
}: {
  selectedKey: NoteName;
  selectedScale: ScaleDefinition;
  selectedPreset: ProgressionPreset | null;
  customDegrees: number[];
  useCustom: boolean;
  onSelectPreset: (p: ProgressionPreset) => void;
  onToggleDegree: (d: number) => void;
  onClearCustom: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const scaleChords = useMemo(() => resolveScaleChords(selectedKey, selectedScale), [selectedKey, selectedScale]);
  const visiblePresets = showAll ? COMMON_PROGRESSIONS : COMMON_PROGRESSIONS.slice(0, 6);

  // Resolve roman numerals for selected scale
  const resolveRomanForPreset = (preset: ProgressionPreset) => {
    return preset.degrees.map((d) => scaleChords[d]?.chordSymbol ?? '?').join(' – ');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider mb-3">
          Choose Progression
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visiblePresets.map((preset) => {
            const isActive = !useCustom && selectedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`
                  text-left rounded-lg border px-4 py-3 transition-all duration-200
                  ${isActive
                    ? 'border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.08)]'
                    : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'
                  }
                `}
              >
                <p className={`text-xs font-body mb-0.5 ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>
                  {preset.romanDisplay}
                </p>
                <p className={`text-sm font-display font-bold ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'}`}>
                  {resolveRomanForPreset(preset)}
                </p>
              </button>
            );
          })}
        </div>
        {COMMON_PROGRESSIONS.length > 6 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-xs font-body text-[hsl(var(--color-primary))] hover:underline"
          >
            {showAll ? 'Show less' : `Show all ${COMMON_PROGRESSIONS.length} progressions`}
          </button>
        )}
      </div>

      {/* Custom builder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
            Or Build Custom
          </h4>
          {useCustom && customDegrees.length > 0 && (
            <button
              onClick={onClearCustom}
              className="flex items-center gap-1 text-xs font-body text-[hsl(var(--semantic-error))] hover:underline"
            >
              <Trash2 className="size-3" /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {scaleChords.map((c, i) => (
            <button
              key={i}
              onClick={() => onToggleDegree(i)}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 py-2 hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--color-primary)/0.4)] transition-all duration-150 active:scale-95"
            >
              <Plus className="size-3 text-[hsl(var(--color-primary))]" />
              <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">{c.roman}</span>
              <span className="text-xs font-display font-bold text-[hsl(var(--text-default))]">{c.chordSymbol}</span>
            </button>
          ))}
        </div>
        {useCustom && customDegrees.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap rounded-lg bg-[hsl(var(--bg-overlay))] px-3 py-2 border border-[hsl(var(--color-primary)/0.2)]">
            <span className="text-xs text-[hsl(var(--text-muted))] font-body mr-1">Sequence:</span>
            {customDegrees.map((d, i) => (
              <span key={i} className="text-sm font-display font-bold text-[hsl(var(--color-primary))]">
                {scaleChords[d]?.chordSymbol ?? '?'}
                {i < customDegrees.length - 1 && <span className="text-[hsl(var(--text-muted))] ml-1">–</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimerOption({ value, selected, onSelect }: { value: ProgressionTimerDuration; selected: boolean; onSelect: () => void }) {
  const labels: Record<ProgressionTimerDuration, string> = { 0: 'No Timer', 2: '2s', 4: '4s', 8: '8s' };
  return (
    <button
      onClick={onSelect}
      className={`
        rounded-lg px-4 py-2.5 text-sm font-display font-bold transition-all duration-200
        ${selected
          ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
          : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
        }
      `}
    >
      {labels[value]}
    </button>
  );
}

// ─── Practice View ──────────────────────────────────────────

function ProgressionTimeline({
  chords,
  currentIndex,
}: {
  chords: { roman: string; chordSymbol: string }[];
  currentIndex: number;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 px-1 scrollbar-none">
      {chords.map((c, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <div key={i} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              className={`
                flex flex-col items-center rounded-lg px-3 py-2 min-w-[48px] transition-all duration-300
                ${isCurrent
                  ? 'bg-[hsl(var(--color-primary)/0.15)] border border-[hsl(var(--color-primary)/0.5)] scale-110'
                  : isPast
                    ? 'bg-[hsl(var(--semantic-success)/0.08)] border border-[hsl(var(--semantic-success)/0.2)]'
                    : 'bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]'
                }
              `}
            >
              <span className={`text-[9px] font-body ${isCurrent ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>
                {c.roman}
              </span>
              <span className={`text-xs font-display font-bold ${isCurrent ? 'text-[hsl(var(--color-primary))]' : isPast ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-subtle))]'}`}>
                {c.chordSymbol}
              </span>
            </div>
            {i < chords.length - 1 && (
              <span className={`text-xs ${isPast ? 'text-[hsl(var(--semantic-success)/0.4)]' : 'text-[hsl(var(--border-default))]'}`}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function ProgressionPractice() {
  const navigate = useNavigate();
  const store = useProgressionStore();
  const {
    selectedKey, selectedScale, selectedPreset, customDegrees, useCustom,
    timerPerChord, isPracticing, progressionChords, currentChordIndex,
    isRevealed, loopCount,
    setKey, setScale, setPreset, setCustomDegrees, toggleCustomDegree, setUseCustom,
    setTimerPerChord, startProgression, stopProgression, revealChord, nextChord, prevChord,
    getCurrentChord, getResolvedChords,
  } = store;

  const { playChord } = useChordAudio();
  const metronome = useMetronome();
  const currentInfo = getCurrentChord();

  // Sensitivity state with localStorage persistence
  const [sensitivity, setSensitivity] = useState(getStoredSensitivity);
  const handleSensitivityChange = useCallback((v: number) => {
    setSensitivity(v);
    try {
      localStorage.setItem(SENSITIVITY_KEY, String(v));
    } catch {}
  }, []);

  const handleReveal = useCallback(() => {
    revealChord();
    const current = getCurrentChord();
    if (current?.chordData) playChord(current.chordData);
  }, [revealChord, getCurrentChord, playChord]);

  const { timeLeft, progress, start, reset } = useCountdown({
    duration: timerPerChord,
    onComplete: handleReveal,
  });

  // Chord detection — auto-advance on correct
  const handleDetectionCorrect = useCallback(() => {
    const s = useProgressionStore.getState();
    if (!s.isRevealed) {
      revealChord();
    }
    reset();
    nextChord();
  }, [revealChord, reset, nextChord]);

  const { isListening, result: detectionResult, permissionDenied, toggleListening, stopListening, pauseDetection } =
    useChordDetection({
      onCorrect: handleDetectionCorrect,
      targetChord: currentInfo?.chordData ?? undefined,
      sensitivity,
      autoStart: true,
    });

  // Start timer on chord change
  useEffect(() => {
    if (isPracticing && !isRevealed && timerPerChord > 0) {
      start();
    }
  }, [isPracticing, isRevealed, currentChordIndex, start, timerPerChord]);

  // Stop mic + metronome when leaving practice
  useEffect(() => {
    return () => {
      stopListening();
      metronome.stop();
    };
  }, [stopListening, metronome.stop]);

  const handleNext = () => { reset(); nextChord(); };
  const handlePrev = () => { reset(); prevChord(); };
  const handleBack = () => { stopListening(); metronome.stop(); stopProgression(); };
  const handleRestart = () => { reset(); startProgression(); };

  const resolvedChords = getResolvedChords();
  const hasChords = resolvedChords.length > 0;
  const missingCount = resolvedChords.filter((c) => !c.chordData).length;

  const handleStart = () => {
    if (!hasChords) return;
    startProgression();
  };

  // ─── PRACTICE VIEW ───
  if (isPracticing && currentInfo) {
    const chord = currentInfo.chordData;

    return (
      <div className="stage-gradient min-h-[calc(100vh-3.5rem)] flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-body text-[hsl(var(--text-muted))]">
              <span className="px-2 py-1 rounded bg-[hsl(var(--bg-surface))]">
                {NOTE_DISPLAY[selectedKey]} {selectedScale.name.replace(' Scale', '')}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-body text-[hsl(var(--text-muted))]">
              <Repeat className="size-3" />
              <span className="font-display font-bold text-[hsl(var(--color-primary))]">{loopCount}</span>
            </div>

            {/* Microphone Toggle */}
            <button
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Start listening'}
              className={`
                relative flex items-center justify-center size-9 rounded-lg border transition-all duration-200
                ${isListening
                  ? 'border-[hsl(var(--semantic-success)/0.6)] bg-[hsl(var(--semantic-success)/0.12)] text-[hsl(var(--semantic-success))]'
                  : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                }
              `}
            >
              {isListening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              {isListening && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />
              )}
            </button>

            <VolumeControl compact />
          </div>
        </div>

        {/* Permission denied warning */}
        {permissionDenied && (
          <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5">
            <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">
              Microphone access was denied. Please allow microphone access in your browser settings to use chord detection.
            </span>
          </div>
        )}

        {/* Listening indicator + sensitivity */}
        {isListening && (
          <div className="mx-4 sm:mx-6 mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 rounded-lg bg-[hsl(var(--semantic-success)/0.06)] border border-[hsl(var(--semantic-success)/0.15)] px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 rounded-full bg-[hsl(var(--semantic-success))]"
                    animate={{ height: [4, 12, 4] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.12,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-body font-medium text-[hsl(var(--semantic-success))]">
                Listening — play the chord
              </span>
            </div>
            <div className="h-4 w-px bg-[hsl(var(--border-subtle))] hidden sm:block" />
            <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
          </div>
        )}

        {/* Sensitivity control when mic is off */}
        {!isListening && !permissionDenied && (
          <div className="mx-4 sm:mx-6 mb-2 flex items-center justify-center gap-4 rounded-lg bg-[hsl(var(--bg-elevated)/0.5)] border border-[hsl(var(--border-subtle)/0.5)] px-4 py-2">
            <span className="text-xs font-body text-[hsl(var(--text-muted))]">Mic off</span>
            <div className="h-4 w-px bg-[hsl(var(--border-subtle))]" />
            <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
          </div>
        )}

        {/* Metronome bar */}
        <MetronomeBar
          isPlaying={metronome.isPlaying}
          bpm={metronome.bpm}
          beatsPerMeasure={metronome.beatsPerMeasure}
          currentBeat={metronome.currentBeat}
          soundType={metronome.soundType}
          onToggle={metronome.toggle}
          onBpmChange={metronome.setBpm}
          onSoundChange={metronome.setSoundType}
        />

        {/* Progression Timeline */}
        <div className="px-4 sm:px-6 py-2 flex justify-center">
          <ProgressionTimeline chords={progressionChords} currentIndex={currentChordIndex} />
        </div>

        {/* Main practice area */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-12">
          {/* Detection result overlay */}
          <DetectionFeedback result={detectionResult} />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentInfo.chordSymbol}-${currentChordIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Roman + Name */}
              <div className="text-center">
                <p className="font-body text-sm text-[hsl(var(--color-primary))] uppercase tracking-wider mb-1">
                  {currentInfo.roman}
                </p>
                <h2 className="font-display text-5xl sm:text-7xl md:text-8xl font-extrabold text-[hsl(var(--text-default))] leading-none">
                  {currentInfo.chordSymbol}
                </h2>
                <p className="mt-1 text-sm font-body text-[hsl(var(--text-muted))]">
                  {currentChordIndex + 1} of {progressionChords.length}
                </p>
              </div>

              {/* Countdown or Diagram */}
              <div className="relative min-h-[260px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!isRevealed ? (
                    <motion.div
                      key="countdown"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col items-center gap-6"
                    >
                      {timerPerChord > 0 ? (
                        <CountdownRing progress={progress} timeLeft={timeLeft} size={180} />
                      ) : (
                        <div className="min-h-[180px] flex items-center justify-center">
                          <div className="text-center text-[hsl(var(--text-muted))]">
                            <Eye className="size-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-body">Tap reveal to see the chord</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="diagram"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col items-center gap-4"
                    >
                      {chord ? (
                        <>
                          <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.8)] backdrop-blur-sm p-6 glow-emphasis">
                            {(chord as any).isCustom ? (
                              <CustomChordDiagram
                                key={`custom-${chord.id}`}
                                chord={{
                                  id: chord.id,
                                  name: chord.name,
                                  symbol: chord.symbol,
                                  baseFret: chord.baseFret,
                                  numFrets: (chord as any).numFrets ?? 5,
                                  mutedStrings: new Set((chord as any).customMutedStrings ?? []),
                                  openStrings: new Set((chord as any).customOpenStrings ?? []),
                                  openDiamonds: new Set((chord as any).customOpenDiamonds ?? []),
                                  markers: (chord as any).customMarkers ?? [],
                                  barres: (chord as any).customBarres ?? [],
                                  createdAt: 0,
                                  updatedAt: 0,
                                }}
                                size="lg"
                              />
                            ) : (
                              <ChordDiagram chord={chord} size="lg" />
                            )}
                          </div>
                          <button
                            onClick={() => { pauseDetection(2000); playChord(chord); }}
                            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                          >
                            <Volume2 className="size-4" />
                            Play Again
                          </button>
                        </>
                      ) : (
                        <div className="rounded-xl border border-[hsl(var(--semantic-warning)/0.3)] bg-[hsl(var(--semantic-warning)/0.05)] p-8 text-center">
                          <p className="text-sm font-body text-[hsl(var(--semantic-warning))]">
                            No diagram available for {currentInfo.chordSymbol}
                          </p>
                          <p className="text-xs font-body text-[hsl(var(--text-muted))] mt-1">
                            This chord is not in your library
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="mt-6 flex flex-col items-center gap-4">
            {!isRevealed && (
              <div>
                {timerPerChord > 0 ? (
                  <button
                    onClick={() => { reset(); revealChord(); const c = getCurrentChord(); if (c?.chordData) playChord(c.chordData); }}
                    className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                  >
                    <Eye className="size-4" />
                    Reveal Now
                  </button>
                ) : (
                  <button
                    onClick={handleReveal}
                    className="flex items-center gap-3 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-4 font-display text-base font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98] transition-all duration-200"
                  >
                    <Eye className="size-5" />
                    Reveal Chord
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] px-4 py-3 text-sm font-body font-medium text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
              >
                <SkipBack className="size-4" />
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] px-4 py-3 text-sm font-body font-medium text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-3 text-sm font-display font-bold text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98] transition-all duration-200"
              >
                Next
                <SkipForward className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── SETUP VIEW ───
  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <div className="relative px-4 sm:px-6 pt-8 pb-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4">
          <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
          <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">
            Chord Progressions
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
          <span className="text-[hsl(var(--text-default))]">Practice </span>
          <span className="text-gradient">Progressions</span>
        </h1>
        <p className="mt-2 font-body text-sm text-[hsl(var(--text-subtle))] max-w-md mx-auto">
          Choose a key, scale, and chord progression. Practice smooth transitions between chords.
        </p>
      </div>

      {/* Setup */}
      <div className="px-4 sm:px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left: Key + Scale + Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <KeySelector value={selectedKey} onChange={setKey} />
            </div>
            <div className="relative z-10 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
              <ScaleSelector value={selectedScale} onChange={setScale} />
              <ScaleChordsPreview selectedKey={selectedKey} selectedScale={selectedScale} />
            </div>
          </div>

          {/* Right: Progressions + Timer + Start */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <ProgressionPresetSelector
                selectedKey={selectedKey}
                selectedScale={selectedScale}
                selectedPreset={selectedPreset}
                customDegrees={customDegrees}
                useCustom={useCustom}
                onSelectPreset={setPreset}
                onToggleDegree={toggleCustomDegree}
                onClearCustom={() => { setCustomDegrees([]); setUseCustom(false); }}
              />
            </div>

            {/* Timer */}
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <Timer className="size-4 text-[hsl(var(--color-primary))]" />
                <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                  Time Per Chord
                </h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {([0, 2, 4, 8] as ProgressionTimerDuration[]).map((t) => (
                  <TimerOption
                    key={t}
                    value={t}
                    selected={timerPerChord === t}
                    onSelect={() => setTimerPerChord(t)}
                  />
                ))}
              </div>
            </div>

            {/* Metronome */}
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <MetronomeSetup
                bpm={metronome.bpm}
                beatsPerMeasure={metronome.beatsPerMeasure}
                isPlaying={metronome.isPlaying}
                currentBeat={metronome.currentBeat}
                soundType={metronome.soundType}
                onBpmChange={metronome.setBpm}
                onBeatsChange={metronome.setBeatsPerMeasure}
                onSoundChange={metronome.setSoundType}
                onToggle={metronome.toggle}
              />
            </div>

            {/* Summary + Start */}
            <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                Ready to Practice
              </h3>

              {/* Summary */}
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--text-muted))]">Key</span>
                  <span className="text-[hsl(var(--text-default))] font-medium">{NOTE_DISPLAY[selectedKey]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--text-muted))]">Scale</span>
                  <span className="text-[hsl(var(--text-default))] font-medium">{selectedScale.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--text-muted))]">Progression</span>
                  <span className="text-[hsl(var(--text-default))] font-medium text-right max-w-[60%]">
                    {resolvedChords.map((c) => c.chordSymbol).join(' – ') || 'None selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--text-muted))]">Chords</span>
                  <span className="text-[hsl(var(--color-primary))] font-display font-bold">{resolvedChords.length}</span>
                </div>
                {missingCount > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--semantic-warning))]">
                    <span>⚠ {missingCount} chord{missingCount > 1 ? 's' : ''} not in library (will show name only)</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleStart}
                disabled={!hasChords}
                className={`
                  group/btn relative w-full flex items-center justify-center gap-3 rounded-xl py-4 font-display text-lg font-bold tracking-wide uppercase overflow-hidden transition-all duration-200
                  ${hasChords
                    ? 'bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))] glow-primary hover:shadow-[0_0_30px_hsl(var(--color-primary)/0.4),0_0_80px_hsl(var(--color-primary)/0.15)] active:scale-[0.97]'
                    : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'
                  }
                `}
              >
                {hasChords && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                )}
                <Play className="size-5 transition-transform duration-200 group-hover/btn:scale-110" />
                <span className="relative">Start Progression</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
