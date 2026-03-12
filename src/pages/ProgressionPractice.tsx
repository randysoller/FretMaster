import { useCallback, useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProgressionStore, type SavedProgression } from '@/stores/progressionStore';
import { useMetronomeStore, onChordAdvance, onAutoReveal, resetBeatCounter } from '@/stores/metronomeStore';
import { SCALES, COMMON_PROGRESSIONS, STYLE_PROGRESSIONS, resolveScaleChords, resolvePresetChordSymbols, KEY_SIGNATURES } from '@/constants/scales';
import type { NoteName, ScaleDefinition, ProgressionPreset, KeySignature } from '@/constants/scales';
import { useDetectionSettingsStore } from '@/stores/detectionSettingsStore';
import { useChordDetection } from '@/hooks/useChordDetection';
import type { DetectionResult, AdvancedDetectionSettings } from '@/hooks/useChordDetection';
import { useSessionStats } from '@/hooks/useSessionStats';
import { useReferenceTone } from '@/hooks/useReferenceTone';
import SessionSummary from '@/components/features/SessionSummary';
import AdvancedDetectionSettingsPanel from '@/components/features/AdvancedDetectionSettings';
import ChordDiagram from '@/components/features/ChordDiagram';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';

import VolumeControl from '@/components/features/VolumeControl';
import BeatSyncControls from '@/components/features/BeatSyncControls';
import StrummingPatternDisplay, { StrummingPatternPreview } from '@/components/features/StrummingPatternDisplay';
import { getStyleStrumming, getCustomStrumPatterns } from '@/constants/strumming';

import { useChordAudio } from '@/hooks/useChordAudio';
import { findChordInLibrary } from '@/stores/progressionStore';
import { motion, AnimatePresence } from 'framer-motion';
import CalibrationWizard from '@/components/features/CalibrationWizard';
import {
  ArrowLeft, SkipForward, SkipBack, Eye, EyeOff, RotateCcw, Volume2, Play, Music,
  ChevronDown, X, Plus, Repeat, Trash2, Mic, MicOff, SlidersHorizontal,
  Save, FolderOpen, Upload, Check, Heart, KeyRound, Waves, ListMusic, Headphones,
  BarChart3, Crosshair,
} from 'lucide-react';
import ShowDiagramsToggle, { getStoredShowDiagrams } from '@/components/features/ShowDiagramsToggle';

// ─── Shared Detection UI ─────────────────────────────────

const FAVORITES_KEY = 'fretmaster-favorite-progressions';

function getStoredFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function persistFavorites(favs: Set<string>) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs])); } catch {}
}

function DetectionFeedback({ result }: { result: DetectionResult }) {
  return (
    <div className="flex justify-center items-center min-h-[32px] sm:min-h-[40px] pointer-events-none">
      <AnimatePresence>
        {result && (
          <motion.div key={result} initial={{ opacity: 0, scale: 0.5, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7, y: -6 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex items-center justify-center">
            <div className={`px-5 py-1.5 sm:px-7 sm:py-2 rounded-2xl backdrop-blur-md border-2 ${result === 'correct' ? 'bg-[hsl(142_71%_45%/0.15)] border-[hsl(142_71%_45%/0.5)]' : 'bg-[hsl(0_84%_60%/0.15)] border-[hsl(0_84%_60%/0.5)]'}`}>
              <span className={`font-display text-xl sm:text-2xl font-extrabold uppercase tracking-wider ${result === 'correct' ? 'text-[hsl(142_71%_45%)]' : 'text-[hsl(0_84%_60%)]'}`}
                style={{ textShadow: result === 'correct' ? '0 0 20px hsl(142 71% 45% / 0.4), 0 0 40px hsl(142 71% 45% / 0.15)' : '0 0 20px hsl(0 84% 60% / 0.4), 0 0 40px hsl(0 84% 60% / 0.15)' }}>
                {result === 'correct' ? 'Correct' : 'Wrong'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SensitivitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = value <= 3 ? 'Strict' : value <= 7 ? 'Balanced' : 'Sensitive';
  const labelColor = value <= 3 ? 'text-[hsl(var(--semantic-info))]' : value <= 7 ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--semantic-success))]';
  return (
    <div className="flex items-center gap-3 min-w-0">
      <SlidersHorizontal className="size-3.5 text-[hsl(var(--text-muted))] shrink-0" />
      <span className="text-[10px] font-body text-[hsl(var(--text-muted))] uppercase tracking-wider shrink-0">Mic Sensitivity</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input type="range" min={1} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="volume-slider flex-1 min-w-[80px] max-w-[120px]" title={`Detection sensitivity: ${value}/10 (${label})`} />
        <span className={`text-xs font-display font-bold tabular-nums w-5 text-center ${labelColor}`}>{value}</span>
      </div>
      <span className={`text-[10px] font-body font-medium ${labelColor} shrink-0`}>{label}</span>
    </div>
  );
}

// ─── Setup View Components ───────────────────────────────

function KeySelector({ value, onChange, accentIcon }: { value: KeySignature; onChange: (ks: KeySignature) => void; accentIcon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        {accentIcon}
        <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Select Key</h3>
      </div>
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-4 py-4 sm:py-3 text-xl sm:text-base font-body text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-xl sm:text-base">{value.display} Major</span>
            {value.count > 0 && (
              <span className="text-base sm:text-xs text-[hsl(var(--text-muted))]">
                {value.count} {value.type === 'sharp' ? (value.count === 1 ? 'sharp' : 'sharps') : (value.count === 1 ? 'flat' : 'flats')}
              </span>
            )}
          </div>
          <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden max-h-[70vh] sm:max-h-[360px] overflow-y-auto">
            {KEY_SIGNATURES.map((ks) => {
              const isActive = value.display === ks.display;
              return (
                <button
                  key={ks.display}
                  onClick={() => { onChange(ks); setOpen(false); }}
                  className={`w-full text-left px-4 py-3.5 sm:py-2.5 text-xl sm:text-base font-body transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-medium'
                      : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-display font-bold text-xl sm:text-base min-w-[36px] ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'}`}>{ks.display}</span>
                    {ks.count === 0 && (
                      <span className="text-base sm:text-xs text-[hsl(var(--text-muted))]">no sharps or flats</span>
                    )}
                    {ks.count > 0 && (
                      <span className="text-base sm:text-xs text-[hsl(var(--text-muted))]">
                        {ks.count}{ks.type === 'sharp' ? '♯' : '♭'}
                      </span>
                    )}
                  </div>
                  {ks.count > 0 && (
                    <span className={`text-[15px] sm:text-[11px] font-body tabular-nums ${isActive ? 'text-[hsl(var(--color-primary)/0.7)]' : 'text-[hsl(var(--text-muted)/0.6)]'}`}>
                      {ks.notes.join('  ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ScaleSelector({ value, onChange, accentIcon }: { value: ScaleDefinition; onChange: (s: ScaleDefinition) => void; accentIcon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        {accentIcon}
        <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Select Scale</h3>
      </div>
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-4 py-4 sm:py-3 text-xl sm:text-base font-body text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
          <span>{value.name}</span>
          <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden">
            {SCALES.map((scale) => (
              <button key={scale.id} onClick={() => { onChange(scale); setOpen(false); }} className={`w-full text-left px-4 py-4 sm:py-3 text-xl sm:text-base font-body transition-colors ${scale.id === value.id ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-medium' : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'}`}>
                {scale.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScaleChordsPreview({ selectedKey, selectedScale, useFlats, keyDisplay }: { selectedKey: NoteName; selectedScale: ScaleDefinition; useFlats: boolean; keyDisplay: string }) {
  const chords = useMemo(() => resolveScaleChords(selectedKey, selectedScale, useFlats), [selectedKey, selectedScale, useFlats]);
  const { playChord } = useChordAudio();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback((index: number, chordSymbol: string, quality: string) => {
    const chordData = findChordInLibrary(chordSymbol, quality);
    if (chordData) playChord(chordData);
    setActiveIndex(index);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setActiveIndex(null), 600);
  }, [playChord]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div>
      <h4 className="font-display text-sm sm:text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider mb-3 sm:mb-2">Chords in {keyDisplay} {selectedScale.name.replace(' Scale', '')}</h4>
      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {chords.map((c, i) => {
          const isActive = activeIndex === i;
          const hasChord = !!findChordInLibrary(c.chordSymbol, c.quality);
          return (
            <button
              key={i}
              onClick={() => handleTap(i, c.chordSymbol, c.quality)}
              className={`flex flex-col items-center rounded-lg bg-[hsl(var(--bg-surface))] border px-5 py-3 sm:px-5 sm:py-3 min-w-[64px] sm:min-w-[72px] transition-all duration-200 ${
                isActive
                  ? 'border-[hsl(var(--color-primary)/0.7)] bg-[hsl(var(--color-primary)/0.12)] scale-105 shadow-[0_0_16px_hsl(var(--color-primary)/0.25)]'
                  : hasChord
                    ? 'border-[hsl(var(--border-subtle)/0.5)] hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 cursor-pointer'
                    : 'border-[hsl(var(--border-subtle)/0.3)] opacity-50 cursor-not-allowed'
              }`}
              disabled={!hasChord}
              title={hasChord ? `Play ${c.chordSymbol}` : `${c.chordSymbol} not in library`}
            >
              <span className={`text-base sm:text-base font-body transition-colors duration-200 ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>{c.roman}</span>
              <span className={`text-lg sm:text-lg font-display font-bold transition-colors duration-200 ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'}`}>{c.chordSymbol}</span>
              {hasChord && (
                <Volume2 className={`size-3 mt-1 transition-all duration-200 ${isActive ? 'text-cyan-300 scale-125' : 'text-cyan-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressionPresetSelector({ selectedKey, selectedScale, useFlats, selectedPreset, customDegrees, useCustom, onSelectPreset, onToggleDegree, onClearCustom }: {
  selectedKey: NoteName; selectedScale: ScaleDefinition; useFlats: boolean; selectedPreset: ProgressionPreset | null;
  customDegrees: number[]; useCustom: boolean;
  onSelectPreset: (p: ProgressionPreset) => void; onToggleDegree: (d: number) => void; onClearCustom: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const scaleChords = useMemo(() => resolveScaleChords(selectedKey, selectedScale, useFlats), [selectedKey, selectedScale, useFlats]);
  const visiblePresets = showAll ? COMMON_PROGRESSIONS : COMMON_PROGRESSIONS.slice(0, 6);
  const resolveRomanForPreset = (preset: ProgressionPreset) => resolvePresetChordSymbols(preset, selectedKey, selectedScale, useFlats);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider mb-3">Choose Progression</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visiblePresets.map((preset) => {
            const isActive = !useCustom && selectedPreset?.id === preset.id;
            return (
              <button key={preset.id} onClick={() => onSelectPreset(preset)} className={`text-left rounded-lg border px-4 py-3.5 sm:py-3 transition-all duration-200 ${isActive ? 'border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.08)]' : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'}`}>
                <p className={`text-lg sm:text-base font-body mb-0.5 ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-subtle))]'}`}>{preset.romanDisplay}</p>
                <p className={`text-base sm:text-sm font-display font-bold ${isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'}`}>{resolveRomanForPreset(preset)}</p>
              </button>
            );
          })}
        </div>
        {COMMON_PROGRESSIONS.length > 6 && (
          <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-body text-[hsl(var(--color-primary))] hover:underline">{showAll ? 'Show less' : `Show all ${COMMON_PROGRESSIONS.length} progressions`}</button>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Or Build Custom</h4>
          {useCustom && customDegrees.length > 0 && (
            <button onClick={onClearCustom} className="flex items-center gap-1 text-xs font-body text-[hsl(var(--semantic-error))] hover:underline"><Trash2 className="size-3" /> Clear</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {scaleChords.map((c, i) => (
            <button key={i} onClick={() => onToggleDegree(i)} className="flex flex-col items-center gap-0.5 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 py-2 hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--color-primary)/0.4)] transition-all duration-150 active:scale-95">
              <Plus className="size-3 text-[hsl(var(--color-primary))]" />
              <span className="text-sm font-body text-[hsl(var(--text-muted))]">{c.roman}</span>
              <span className="text-xs font-display font-bold text-[hsl(var(--text-default))]">{c.chordSymbol}</span>
            </button>
          ))}
        </div>
        {useCustom && customDegrees.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap rounded-lg bg-[hsl(var(--bg-overlay))] px-3 py-2 border border-[hsl(var(--color-primary)/0.2)]">
            <span className="text-xs text-[hsl(var(--text-muted))] font-body mr-1">Sequence:</span>
            {customDegrees.map((d, i) => (
              <span key={i} className="text-sm font-display font-bold text-[hsl(var(--color-primary))]">
                {scaleChords[d]?.chordSymbol ?? '?'}{i < customDegrees.length - 1 && <span className="text-[hsl(var(--text-muted))] ml-1">–</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── By Style Section ────────────────────────────────────

function StyleProgressionSelector({ selectedKey, selectedScale, useFlats, selectedPreset, useCustom, onSelectPreset, favorites, onToggleFavorite }: {
  selectedKey: NoteName; selectedScale: ScaleDefinition; useFlats: boolean; selectedPreset: ProgressionPreset | null;
  useCustom: boolean; onSelectPreset: (p: ProgressionPreset) => void;
  favorites: Set<string>; onToggleFavorite: (id: string) => void;
}) {
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);
  const resolveRomanForPreset = (preset: ProgressionPreset) => resolvePresetChordSymbols(preset, selectedKey, selectedScale, useFlats);

  return (
    <div className="space-y-2">
      {STYLE_PROGRESSIONS.map((style) => {
        const isExpanded = expandedStyle === style.id;
        const hasActivePreset = !useCustom && style.progressions.some((p) => p.id === selectedPreset?.id);
        return (
          <div key={style.id} className="rounded-lg border border-[hsl(var(--border-subtle))] overflow-hidden transition-colors duration-150">
            <button
              onClick={() => setExpandedStyle(isExpanded ? null : style.id)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors duration-150 ${
                hasActivePreset
                  ? 'bg-[hsl(var(--color-primary)/0.06)]'
                  : 'bg-[hsl(var(--bg-surface))] hover:bg-[hsl(var(--bg-overlay))]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl sm:text-lg">{style.emoji}</span>
                <span className={`font-display text-base sm:text-sm font-bold ${
                  hasActivePreset ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                }`}>
                  {style.name}
                </span>
                <span className="text-sm sm:text-[10px] font-body text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-base)/0.5)] rounded-full px-2 py-0.5">
                  {style.progressions.length}
                </span>
                <span className="text-sm sm:text-[10px] font-body text-[hsl(var(--text-subtle))] tabular-nums">
                  {style.bpmRange.min}–{style.bpmRange.max} BPM
                </span>
              </div>
              <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 pt-1 space-y-1.5">
                    {/* Strumming pattern preview */}
                    {getStyleStrumming(style.id).length > 0 && (
                      <div className="mb-2">
                        <StrummingPatternPreview styleId={style.id} />
                      </div>
                    )}
                    {style.progressions.map((preset) => {
                      const isActive = !useCustom && selectedPreset?.id === preset.id;
                      const isFav = favorites.has(preset.id);
                      return (
                        <div key={preset.id} className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectPreset(preset)}
                            className={`flex-1 text-left rounded-lg border px-4 py-2.5 transition-all duration-200 ${
                              isActive
                                ? 'border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.1)]'
                                : 'border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-elevated)/0.5)] hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className={`text-base sm:text-xs font-display font-bold mb-0.5 ${
                                  isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                                }`}>
                                  {preset.name}
                                </p>
                                <p className={`text-sm sm:text-[11px] font-body ${
                                  isActive ? 'text-[hsl(var(--color-primary)/0.7)]' : 'text-[hsl(var(--text-subtle))]'
                                }`}>
                                  {preset.romanDisplay}
                                </p>
                              </div>
                              <p className={`text-base sm:text-xs font-display font-bold min-w-0 text-right leading-relaxed ${
                                isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-subtle))]'
                              }`}>
                                {resolveRomanForPreset(preset)}
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(preset.id); }}
                            className={`flex items-center justify-center size-10 sm:size-9 rounded-lg shrink-0 transition-all duration-200 active:scale-90 ${
                              isFav
                                ? 'text-[hsl(0_84%_60%)]'
                                : 'text-[hsl(var(--text-muted)/0.4)] hover:text-[hsl(var(--text-muted))]'
                            }`}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart className={`size-4 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Favorites Section ───────────────────────────────────

function FavoritesSelector({ selectedKey, selectedScale, useFlats, selectedPreset, useCustom, onSelectPreset, favorites, onToggleFavorite }: {
  selectedKey: NoteName; selectedScale: ScaleDefinition; useFlats: boolean; selectedPreset: ProgressionPreset | null;
  useCustom: boolean; onSelectPreset: (p: ProgressionPreset) => void;
  favorites: Set<string>; onToggleFavorite: (id: string) => void;
}) {
  const resolveRomanForPreset = (preset: ProgressionPreset) => resolvePresetChordSymbols(preset, selectedKey, selectedScale, useFlats);

  // Collect all favorited progressions from all styles
  const favProgressions = useMemo(() => {
    const items: { preset: ProgressionPreset; styleName: string; emoji: string; bpmRange: { min: number; max: number; default: number } }[] = [];
    for (const style of STYLE_PROGRESSIONS) {
      for (const preset of style.progressions) {
        if (favorites.has(preset.id)) {
          items.push({ preset, styleName: style.name, emoji: style.emoji, bpmRange: style.bpmRange });
        }
      }
    }
    return items;
  }, [favorites]);

  if (favProgressions.length === 0) {
    return (
      <div className="text-center py-8">
        <Heart className="size-8 mx-auto mb-3 text-[hsl(var(--text-muted)/0.25)]" />
        <p className="text-sm font-body text-[hsl(var(--text-muted))]">
          No favorites yet
        </p>
        <p className="text-xs font-body text-[hsl(var(--text-muted)/0.6)] mt-1">
          Tap the heart icon on any style progression to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {favProgressions.map(({ preset, styleName, emoji, bpmRange }) => {
        const isActive = !useCustom && selectedPreset?.id === preset.id;
        return (
          <div key={preset.id} className="flex items-center gap-1.5">
            <button
              onClick={() => onSelectPreset(preset)}
              className={`flex-1 text-left rounded-lg border px-4 py-2.5 transition-all duration-200 ${
                isActive
                  ? 'border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.1)]'
                  : 'border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-elevated)/0.5)] hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--border-default))]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs">{emoji}</span>
                    <span className={`text-[10px] font-body ${
                      isActive ? 'text-[hsl(var(--color-primary)/0.7)]' : 'text-[hsl(var(--text-muted))]'
                    }`}>{styleName}</span>
                    <span className="text-[10px] font-body text-[hsl(var(--text-subtle)/0.7)] tabular-nums">{bpmRange.min}–{bpmRange.max}</span>
                  </div>
                  <p className={`text-base sm:text-xs font-display font-bold ${
                    isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-default))]'
                  }`}>
                    {preset.name}
                  </p>
                  <p className={`text-sm sm:text-[11px] font-body ${
                    isActive ? 'text-[hsl(var(--color-primary)/0.7)]' : 'text-[hsl(var(--text-subtle))]'
                  }`}>
                    {preset.romanDisplay}
                  </p>
                </div>
                <p className={`text-base sm:text-xs font-display font-bold min-w-0 text-right leading-relaxed ${
                  isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-subtle))]'
                }`}>
                  {resolveRomanForPreset(preset)}
                </p>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(preset.id); }}
              className="flex items-center justify-center size-9 rounded-lg shrink-0 text-[hsl(0_84%_60%)] transition-all duration-200 active:scale-90"
              title="Remove from favorites"
            >
              <Heart className="size-4 fill-current" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Progression Timeline ────────────────────────────────

function ProgressionTimeline({ chords, currentIndex }: { chords: { roman: string; chordSymbol: string }[]; currentIndex: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 px-1 scrollbar-none">
      {chords.map((c, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <div key={i} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className={`flex flex-col items-center rounded-lg px-3 py-2 min-w-[48px] transition-all duration-300 ${isCurrent ? 'bg-[hsl(var(--color-primary)/0.15)] border border-[hsl(var(--color-primary)/0.5)] scale-110' : isPast ? 'bg-[hsl(var(--semantic-success)/0.08)] border border-[hsl(var(--semantic-success)/0.2)]' : 'bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]'}`}>
              <span className={`text-[13px] font-body ${isCurrent ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--text-muted))]'}`}>{c.roman}</span>
              <span className={`text-xs font-display font-bold ${isCurrent ? 'text-[hsl(var(--color-primary))]' : isPast ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-subtle))]'}`}>{c.chordSymbol}</span>
            </div>
            {i < chords.length - 1 && <span className={`text-xs ${isPast ? 'text-[hsl(var(--semantic-success)/0.4)]' : 'text-[hsl(var(--border-default))]'}`}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Progression Diagram Row (all chords at once) ────────

function ProgressionDiagramRow({ chords, currentIndex }: { chords: ProgressionChordInfo[]; currentIndex: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current chord on mobile
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const currentEl = container.children[currentIndex] as HTMLElement | undefined;
    if (!currentEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = currentEl.getBoundingClientRect();
    const scrollLeft = currentEl.offsetLeft - containerRect.width / 2 + elRect.width / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }, [currentIndex]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 px-1 scrollbar-none sm:justify-center sm:flex-wrap"
    >
      {chords.map((pc, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = idx < currentIndex;
        const cd = pc.chordData;

        return (
          <motion.div
            key={`${pc.chordSymbol}-${idx}`}
            animate={{
              scale: isCurrent ? 1.05 : 1,
              opacity: isCurrent ? 1 : isPast ? 0.55 : 0.7,
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`shrink-0 flex flex-col items-center rounded-xl border transition-all duration-300 ${
              isCurrent
                ? 'border-[hsl(var(--color-primary)/0.7)] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_20px_hsl(var(--color-primary)/0.15)]'
                : isPast
                  ? 'border-[hsl(var(--semantic-success)/0.25)] bg-[hsl(var(--semantic-success)/0.04)]'
                  : 'border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-elevated)/0.5)]'
            } p-2 sm:p-3`}
          >
            {/* Roman numeral label */}
            <span className={`text-[11px] sm:text-xs font-body mb-0.5 ${
              isCurrent ? 'text-[hsl(var(--color-primary))]' : isPast ? 'text-[hsl(var(--semantic-success)/0.7)]' : 'text-[hsl(var(--text-muted))]'
            }`}>
              {pc.roman}
            </span>

            {/* Chord symbol */}
            <span className={`text-sm sm:text-base font-display font-bold mb-1.5 ${
              isCurrent ? 'text-[hsl(var(--color-primary))]' : isPast ? 'text-[hsl(var(--semantic-success))]' : 'text-[hsl(var(--text-subtle))]'
            }`}>
              {pc.chordSymbol}
            </span>

            {/* Chord diagram */}
            {cd ? (
              <div className={`rounded-lg bg-[hsl(var(--bg-elevated)/0.6)] p-1 sm:p-1.5 ${
                isCurrent ? 'ring-1 ring-[hsl(var(--color-primary)/0.3)]' : ''
              }`}>
                {(cd as any).isCustom ? (
                  <CustomChordDiagram
                    chord={{
                      id: cd.id, name: cd.name, symbol: cd.symbol, baseFret: cd.baseFret,
                      numFrets: (cd as any).numFrets ?? 5,
                      mutedStrings: new Set((cd as any).customMutedStrings ?? []),
                      openStrings: new Set((cd as any).customOpenStrings ?? []),
                      openDiamonds: new Set((cd as any).customOpenDiamonds ?? []),
                      markers: (cd as any).customMarkers ?? [],
                      barres: (cd as any).customBarres ?? [],
                      createdAt: 0, updatedAt: 0,
                    }}
                    size="sm"
                  />
                ) : (
                  <ChordDiagram chord={cd} size="sm" />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center w-[100px] h-[100px] rounded-lg border border-dashed border-[hsl(var(--border-subtle)/0.4)] bg-[hsl(var(--bg-surface)/0.3)]">
                <span className="text-[10px] font-body text-[hsl(var(--text-muted)/0.5)] text-center px-2">Not in library</span>
              </div>
            )}

            {/* Current indicator dot */}
            {isCurrent && (
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-primary))] animate-pulse" />
            )}
            {isPast && (
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--semantic-success)/0.5)]" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function ProgressionPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useProgressionStore();
  const metronome = useMetronomeStore();
  const prevLocationKeyRef = useRef(location.key);

  const {
    selectedKey, selectedScale, selectedKeySignature, useFlats, selectedPreset, customDegrees, useCustom,
    isPracticing, progressionChords, currentChordIndex,
    isRevealed, loopCount, savedProgressions,
    setKey, setKeySignature, setScale, setPreset, setCustomDegrees, toggleCustomDegree, setUseCustom,
    saveProgression, deleteSavedProgression, loadSavedProgression,
    startProgression, stopProgression, revealChord, nextChord, prevChord,
    getCurrentChord, getResolvedChords,
  } = store;

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);

  const [progressionTab, setProgressionTab] = useState<'common' | 'favorites' | 'style' | 'custom'>('common');
  const [favorites, setFavorites] = useState<Set<string>>(getStoredFavorites);
  const favCount = favorites.size;
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);

  const handleToggleFavorite = useCallback((presetId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      persistFavorites(next);
      return next;
    });
  }, []);
  const { playChord } = useChordAudio();
  const currentInfo = getCurrentChord();

  const { sensitivity, advancedEnabled, advancedValues, setSensitivity } = useDetectionSettingsStore();
  const [showDiagrams, setShowDiagrams] = useState(getStoredShowDiagrams);
  const advancedSettings: AdvancedDetectionSettings | null = advancedEnabled ? advancedValues : null;
  const handleSensitivityChange = useCallback((v: number) => {
    setSensitivity(v);
  }, [setSensitivity]);

  // Session stats
  const session = useSessionStats();
  // Reference tone
  const { playChordTone } = useReferenceTone();
  // Calibration wizard
  const [showCalibration, setShowCalibration] = useState(false);

  // Auto-set metronome BPM when a style progression is selected
  const handleStylePresetSelect = useCallback((preset: ProgressionPreset) => {
    setPreset(preset);
    // Find which style this preset belongs to and auto-set BPM + track style
    for (const style of STYLE_PROGRESSIONS) {
      if (style.progressions.some((p) => p.id === preset.id)) {
        metronome.setBpm(style.bpmRange.default);
        setActiveStyleId(style.id);
        break;
      }
    }
  }, [setPreset, metronome]);

  const handleReveal = useCallback(() => {
    revealChord();
    const current = getCurrentChord();
    if (current?.chordData) playChord(current.chordData);
  }, [revealChord, getCurrentChord, playChord]);

  const handleDetectionCorrect = useCallback(() => {
    const s = useProgressionStore.getState();
    const ci = s.progressionChords[s.currentChordIndex];
    if (ci) session.recordAttempt(ci.chordSymbol, ci.chordSymbol, 'correct');
    if (!s.isRevealed) revealChord();
    resetBeatCounter();
    nextChord();
  }, [revealChord, nextChord, session]);

  const { isListening, result: detectionResult, permissionDenied, toggleListening, stopListening, pauseDetection } =
    useChordDetection({ onCorrect: handleDetectionCorrect, targetChord: currentInfo?.chordData ?? undefined, sensitivity, autoStart: true, advancedSettings });

  // Subscribe to metronome beat-sync chord advance
  useEffect(() => {
    const unsub = onChordAdvance(() => {
      const s = useProgressionStore.getState();
      if (!s.isPracticing) return;
      if (!s.isRevealed) revealChord();
      nextChord();
    });
    return unsub;
  }, [revealChord, nextChord]);

  // Subscribe to auto-reveal before advancing
  useEffect(() => {
    const unsub = onAutoReveal(() => {
      const s = useProgressionStore.getState();
      if (!s.isPracticing || s.isRevealed) return;
      revealChord();
      const current = s.getCurrentChord();
      if (current?.chordData) playChord(current.chordData);
    });
    return unsub;
  }, [revealChord, playChord]);

  useEffect(() => {
    if (prevLocationKeyRef.current !== location.key && isPracticing) {
      stopListening();
      stopProgression();
    }
    prevLocationKeyRef.current = location.key;
  }, [location.key]);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  const handleNext = () => {
    const ci = progressionChords[currentChordIndex];
    if (ci) session.recordAttempt(ci.chordSymbol, ci.chordSymbol, 'skipped');
    resetBeatCounter();
    nextChord();
  };
  const handlePrev = () => { resetBeatCounter(); prevChord(); };
  const handleBack = () => {
    if (session.attempts.length > 0) {
      session.endSession();
    } else {
      stopListening(); stopProgression();
    }
  };
  const handleRestart = () => { resetBeatCounter(); session.startSession(); startProgression(); };

  const resolvedChords = getResolvedChords();
  const hasChords = resolvedChords.length > 0;
  const missingCount = resolvedChords.filter((c) => !c.chordData).length;

  const handleStart = () => { if (!hasChords) return; startProgression(); };

  // ─── PRACTICE VIEW ───
  if (isPracticing && currentInfo) {
    const chord = currentInfo.chordData;

    return (
      <div className="stage-gradient min-h-[calc(100vh-58px)] flex flex-col">
        {/* Session Summary Overlay */}
        <AnimatePresence>
          {session.showSummary && (
            <SessionSummary
              summary={session.getSummary()}
              mode="progression"
              onClose={() => {
                session.dismissSummary();
                stopListening();
                stopProgression();
              }}
            />
          )}
        </AnimatePresence>

        {/* Calibration Wizard */}
        <CalibrationWizard
          open={showCalibration}
          onClose={() => setShowCalibration(false)}
        />

        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <button onClick={handleBack} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-body text-[hsl(var(--text-muted))]">
              <span className="px-2 py-1 rounded bg-[hsl(var(--bg-surface))]">{selectedKeySignature.display} {selectedScale.name.replace(' Scale', '')}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-body text-[hsl(var(--text-muted))]">
              <Repeat className="size-3" />
              <span className="font-display font-bold text-[hsl(var(--color-primary))]">{loopCount}</span>
            </div>
            <button onClick={toggleListening} title={isListening ? 'Stop listening' : 'Start listening'}
              className={`relative flex items-center justify-center size-9 rounded-lg border transition-all duration-200 ${isListening ? 'border-[hsl(var(--semantic-success)/0.6)] bg-[hsl(var(--semantic-success)/0.12)] text-[hsl(var(--semantic-success))]' : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'}`}>
              {isListening ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              {isListening && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(var(--semantic-success))] animate-pulse" />}
            </button>
            <VolumeControl compact />
          </div>
        </div>

        {permissionDenied && (
          <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.25)] px-4 py-2.5">
            <MicOff className="size-4 text-[hsl(var(--semantic-error))] shrink-0" />
            <span className="text-xs sm:text-sm font-body text-[hsl(var(--semantic-error))]">Microphone access was denied. Please allow microphone access in your browser settings.</span>
          </div>
        )}

        {isListening && (
          <div className="mx-4 sm:mx-6 mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 rounded-lg bg-[hsl(var(--semantic-success)/0.06)] border border-[hsl(var(--semantic-success)/0.15)] px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4].map((i) => (
                  <motion.div key={i} className="w-0.5 rounded-full bg-[hsl(var(--semantic-success))]" animate={{ height: [4, 12, 4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }} />
                ))}
              </div>
              <span className="text-xs font-body font-medium text-[hsl(var(--semantic-success))]">Listening — play the chord</span>
            </div>
            <div className="h-4 w-px bg-[hsl(var(--border-subtle))] hidden sm:block" />
            <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
          </div>
        )}

        {!isListening && !permissionDenied && (
          <div className="mx-4 sm:mx-6 mb-2 flex items-center justify-center gap-4 rounded-lg bg-[hsl(var(--bg-elevated)/0.5)] border border-[hsl(var(--border-subtle)/0.5)] px-4 py-2">
            <span className="text-xs font-body text-[hsl(var(--text-muted))]">Mic off</span>
            <div className="h-4 w-px bg-[hsl(var(--border-subtle))]" />
            <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
          </div>
        )}

        {/* Advanced Detection Settings */}
        <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <AdvancedDetectionSettingsPanel />
          </div>
          <button onClick={() => setShowCalibration(true)} className="flex items-center gap-1 shrink-0 rounded-lg border border-[hsl(var(--color-emphasis)/0.3)] bg-[hsl(var(--color-emphasis)/0.06)] px-2.5 py-2 text-[10px] font-display font-bold text-[hsl(var(--color-emphasis))] hover:bg-[hsl(var(--color-emphasis)/0.14)] transition-colors" title="Auto-Calibrate">
            <Crosshair className="size-3.5" />
            <span className="hidden sm:inline">Calibrate</span>
          </button>
        </div>

        {/* Metronome status indicator */}
        {metronome.isPlaying && (() => {
          const totalSyncBeats = metronome.syncUnit === 'measures' ? metronome.beatsPerChord * metronome.beatsPerMeasure : metronome.beatsPerChord;
          const syncProgress = totalSyncBeats > 0 ? ((totalSyncBeats - metronome.beatsUntilAdvance) / totalSyncBeats) * 100 : 0;
          return (
            <div className="mx-4 sm:mx-6 mb-2 flex items-center justify-center gap-3 rounded-lg bg-[hsl(var(--color-emphasis)/0.06)] border border-[hsl(var(--color-emphasis)/0.15)] px-4 py-1.5">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(metronome.beatsPerMeasure, 12) }, (_, i) => {
                  const isActive = i === metronome.currentBeat;
                  const isAccent = i === 0 || (metronome.beatsPerMeasure === 6 && i === 3) || (metronome.beatsPerMeasure === 12 && (i === 3 || i === 6 || i === 9));
                  return (
                    <span key={i} className={`font-display font-bold tabular-nums text-xs min-w-[16px] text-center transition-all duration-100 select-none ${isActive ? isAccent ? 'text-[hsl(var(--color-emphasis))] scale-125 drop-shadow-[0_0_6px_hsl(var(--color-emphasis)/0.7)]' : 'text-[hsl(var(--color-primary))] scale-110' : 'text-[hsl(var(--text-muted)/0.3)]'}`}>
                      {i + 1}
                    </span>
                  );
                })}
              </div>
              <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">{metronome.bpm} BPM</span>
              {metronome.syncEnabled && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="font-display font-bold text-sm text-[hsl(var(--color-emphasis))] tabular-nums">{metronome.beatsUntilAdvance}</span>
                    <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">left</span>
                  </div>
                  <div className="w-14 h-1.5 rounded-full bg-[hsl(var(--border-default))] overflow-hidden">
                    <div className="h-full rounded-full bg-[hsl(var(--color-emphasis))] transition-all duration-150" style={{ width: `${syncProgress}%` }} />
                  </div>
                  {metronome.autoRevealBeforeAdvance && <Eye className="size-3 text-[hsl(var(--color-primary)/0.5)]" />}
                </div>
              )}
            </div>
          );
        })()}

        {/* Beat Sync Controls */}
        <div className="px-4 sm:px-6 mb-2">
          <BeatSyncControls />
        </div>

        {/* Chord Diagram Toggle */}
        <div className="flex justify-center px-4 sm:px-6 mb-2">
          <ShowDiagramsToggle enabled={showDiagrams} onChange={setShowDiagrams} />
        </div>

        {/* Strumming Pattern (visible when style is active and has patterns, or custom patterns exist) */}
        {((activeStyleId && getStyleStrumming(activeStyleId).length > 0) || getCustomStrumPatterns().length > 0) && (
          <div className="px-4 sm:px-6 mb-2">
            <StrummingPatternDisplay styleId={activeStyleId ?? ''} animated compact />
          </div>
        )}

        {/* Progression Timeline */}
        <div className="px-4 sm:px-6 py-2 flex justify-center">
          <ProgressionTimeline chords={progressionChords} currentIndex={currentChordIndex} />
        </div>

        {/* Main practice area */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-3 sm:px-6 pb-[140px] sm:pb-12">
          <AnimatePresence mode="wait">
            <motion.div key={`${currentInfo.chordSymbol}-${currentChordIndex}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-2 sm:gap-4 w-full">
              {/* Detection feedback above chord name */}
              <DetectionFeedback result={detectionResult} />
              {/* Current chord name */}
              <div className="text-center">
                <p className="font-body text-base sm:text-lg text-[hsl(var(--color-primary))] uppercase tracking-wider mb-0.5">{currentInfo.roman}</p>
                <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold text-[hsl(var(--text-default))] leading-none">{currentInfo.chordSymbol}</h2>
                <p className="mt-0.5 text-xs sm:text-sm font-body text-[hsl(var(--text-muted))]">{currentChordIndex + 1} of {progressionChords.length}</p>
              </div>

              {/* Diagrams area */}
              <div className="w-full flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {showDiagrams ? (
                    /* All diagrams visible in progression order */
                    <motion.div key="all-diagrams" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="w-full">
                      <ProgressionDiagramRow chords={progressionChords} currentIndex={currentChordIndex} />
                    </motion.div>
                  ) : !isRevealed ? (
                    /* Diagrams off + not revealed */
                    <motion.div key="hidden" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.25 }} className="flex flex-col items-center gap-4">
                      <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-surface)/0.3)] px-12 sm:px-16 py-10 sm:py-14 flex flex-col items-center gap-3">
                        <EyeOff className="size-10 sm:size-12 text-[hsl(var(--text-muted)/0.25)]" />
                        <p className="text-sm font-body text-[hsl(var(--text-muted)/0.6)] text-center">Diagram hidden</p>
                        <p className="text-xs font-body text-[hsl(var(--text-muted)/0.4)] text-center">Tap Reveal or toggle diagrams on</p>
                      </div>
                    </motion.div>
                  ) : (
                    /* Diagrams off + revealed — show only current chord */
                    chord ? (
                      <motion.div key="diagram-revealed" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-center gap-4">
                        <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.8)] backdrop-blur-sm p-6 glow-emphasis">
                          {(chord as any).isCustom ? (
                            <CustomChordDiagram key={`custom-${chord.id}`} chord={{ id: chord.id, name: chord.name, symbol: chord.symbol, baseFret: chord.baseFret, numFrets: (chord as any).numFrets ?? 5, mutedStrings: new Set((chord as any).customMutedStrings ?? []), openStrings: new Set((chord as any).customOpenStrings ?? []), openDiamonds: new Set((chord as any).customOpenDiamonds ?? []), markers: (chord as any).customMarkers ?? [], barres: (chord as any).customBarres ?? [], createdAt: 0, updatedAt: 0 }} size="lg" />
                          ) : (
                            <ChordDiagram chord={chord} size="lg" />
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="no-diagram-revealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-[hsl(var(--semantic-warning)/0.3)] bg-[hsl(var(--semantic-warning)/0.05)] p-8 text-center">
                        <p className="text-sm font-body text-[hsl(var(--semantic-warning))]">No diagram available for {currentInfo.chordSymbol}</p>
                        <p className="text-xs font-body text-[hsl(var(--text-muted))] mt-1">This chord is not in your library</p>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Fixed bottom toolbar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated)/0.95)] backdrop-blur-md safe-area-bottom">
          <div className="flex items-stretch gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 max-w-2xl mx-auto">
            <button onClick={handlePrev} className="flex items-center justify-center size-11 sm:size-12 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all" title="Previous"><SkipBack className="size-4 sm:size-5" /></button>
            <button onClick={handleRestart} className="flex items-center justify-center size-11 sm:size-12 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all" title="Restart"><RotateCcw className="size-4 sm:size-5" /></button>
            <button onClick={() => navigate('/history')} className="flex items-center justify-center size-11 sm:size-12 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-95 transition-all" title="Practice History"><BarChart3 className="size-4 sm:size-5" /></button>
            {!isRevealed ? (
              <button onClick={() => { revealChord(); const c = getCurrentChord(); if (c?.chordData) playChord(c.chordData); }} className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl min-h-[44px] sm:min-h-[48px] bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] font-display font-bold text-xs sm:text-sm border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.25)] active:scale-[0.97] transition-all">
                <Eye className="size-4 sm:size-5" /> <span className="hidden sm:inline">Reveal</span><span className="sm:hidden">Reveal</span>
              </button>
            ) : (
              <>
                <button onClick={() => { pauseDetection(2000); if (chord) playChord(chord); }} className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl min-h-[44px] sm:min-h-[48px] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] font-body font-medium text-xs sm:text-sm border border-[hsl(var(--border-default))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] active:scale-[0.97] transition-all" title="Play Again">
                  <Volume2 className="size-4 sm:size-5" /> <span className="hidden sm:inline">Play Again</span>
                </button>
                {chord && (
                  <button onClick={() => { pauseDetection(3000); playChordTone(chord); }} className="flex items-center justify-center size-11 sm:size-12 rounded-xl border border-[hsl(var(--color-emphasis)/0.3)] bg-[hsl(var(--color-emphasis)/0.08)] text-[hsl(var(--color-emphasis))] hover:bg-[hsl(var(--color-emphasis)/0.18)] active:scale-95 transition-all" title="Reference Tone">
                    <Headphones className="size-4 sm:size-5" />
                  </button>
                )}
              </>
            )}
            <button onClick={handleNext} className="flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl min-h-[44px] sm:min-h-[48px] px-3 sm:px-5 bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] font-display font-bold text-xs sm:text-sm glow-primary hover:bg-[hsl(var(--color-brand))] active:scale-95 transition-all" title="Next">
              <span className="hidden sm:inline">Next</span> <SkipForward className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── SETUP VIEW ───
  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      <div className="relative px-4 sm:px-6 pt-8 pb-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-4">
          <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
          <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">Chord Progressions</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
          <span className="text-[hsl(var(--text-default))]">Practice </span>
          <span className="text-gradient">Progressions</span>
        </h1>
        <p className="mt-2 font-body text-sm text-[hsl(var(--text-subtle))] max-w-md mx-auto">Choose a key, scale, and chord progression. Practice smooth transitions between chords.</p>
      </div>

      <div className="px-4 sm:px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="relative z-20 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/30" />
              <KeySelector value={selectedKeySignature} onChange={setKeySignature} accentIcon={<div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/15"><KeyRound className="size-4 text-amber-400" /></div>} />
            </div>
            <div className="relative z-10 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500/30" />
              <ScaleSelector value={selectedScale} onChange={setScale} accentIcon={<div className="flex items-center justify-center size-7 rounded-lg bg-cyan-500/15"><Waves className="size-4 text-cyan-400" /></div>} />
              <ScaleChordsPreview selectedKey={selectedKey} selectedScale={selectedScale} useFlats={useFlats} keyDisplay={selectedKeySignature.display} />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500/30" />
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/15">
                  <ListMusic className="size-4 text-violet-400" />
                </div>
                <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Choose Progression</h3>
              </div>
              {/* Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-[hsl(var(--bg-surface))] p-1 mb-4">
                {([
                  { key: 'common' as const, label: 'Common', badge: 0 },
                  { key: 'favorites' as const, label: 'Favorites', badge: favCount },
                  { key: 'style' as const, label: 'By Style', badge: 0 },
                  { key: 'custom' as const, label: 'Custom', badge: 0 },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProgressionTab(tab.key)}
                    className={`relative flex-1 rounded-md px-2 py-3 sm:py-2 text-base sm:text-xs font-display font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 overflow-hidden ${
                      progressionTab === tab.key
                        ? 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--text-muted))] border border-[hsl(var(--border-default))] hover:text-[hsl(var(--text-default))] hover:border-[hsl(var(--border-default)/0.8)]'
                    }`}
                  >
                    {progressionTab === tab.key && (
                      <motion.div
                        layoutId="progression-tab-indicator"
                        className="absolute inset-0 rounded-md bg-[hsl(var(--color-primary)/0.15)] border border-[hsl(var(--color-primary)/0.4)] shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {tab.key === 'favorites' && <Heart className={`size-4 sm:size-3 ${favCount > 0 ? 'fill-current text-[hsl(0_84%_60%)]' : ''}`} />}
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.key === 'favorites' ? '' : tab.label}</span>
                      {tab.badge > 0 && <span className="text-[9px] font-bold bg-[hsl(0_84%_60%/0.15)] text-[hsl(0_84%_60%)] rounded-full px-1.5 py-0.5 leading-none">{tab.badge}</span>}
                    </span>
                  </button>
                ))}
              </div>

              {/* Common progressions */}
              {progressionTab === 'common' && (
                <ProgressionPresetSelector selectedKey={selectedKey} selectedScale={selectedScale} useFlats={useFlats} selectedPreset={selectedPreset} customDegrees={customDegrees} useCustom={useCustom} onSelectPreset={setPreset} onToggleDegree={toggleCustomDegree} onClearCustom={() => { setCustomDegrees([]); setUseCustom(false); }} />
              )}

              {/* Favorites */}
              {progressionTab === 'favorites' && (
                <FavoritesSelector selectedKey={selectedKey} selectedScale={selectedScale} useFlats={useFlats} selectedPreset={selectedPreset} useCustom={useCustom} onSelectPreset={handleStylePresetSelect} favorites={favorites} onToggleFavorite={handleToggleFavorite} />
              )}

              {/* By Style */}
              {progressionTab === 'style' && (
                <StyleProgressionSelector selectedKey={selectedKey} selectedScale={selectedScale} useFlats={useFlats} selectedPreset={selectedPreset} useCustom={useCustom} onSelectPreset={handleStylePresetSelect} favorites={favorites} onToggleFavorite={handleToggleFavorite} />
              )}

              {/* Custom builder */}
              {progressionTab === 'custom' && (() => {
                const scaleChords = resolveScaleChords(selectedKey, selectedScale, useFlats);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Build Your Own</h4>
                      {useCustom && customDegrees.length > 0 && (
                        <button onClick={() => { setCustomDegrees([]); setUseCustom(false); }} className="flex items-center gap-1 text-xs font-body text-[hsl(var(--semantic-error))] hover:underline"><Trash2 className="size-3" /> Clear</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scaleChords.map((c, i) => (
                        <button key={i} onClick={() => toggleCustomDegree(i)} className="flex flex-col items-center gap-0.5 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-3 py-2 hover:bg-[hsl(var(--bg-overlay))] hover:border-[hsl(var(--color-primary)/0.4)] transition-all duration-150 active:scale-95">
                          <Plus className="size-3 text-[hsl(var(--color-primary))]" />
                          <span className="text-sm font-body text-[hsl(var(--text-muted))]">{c.roman}</span>
                          <span className="text-xs font-display font-bold text-[hsl(var(--text-default))]">{c.chordSymbol}</span>
                        </button>
                      ))}
                    </div>
                    {useCustom && customDegrees.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap rounded-lg bg-[hsl(var(--bg-overlay))] px-3 py-2 border border-[hsl(var(--color-primary)/0.2)]">
                        <span className="text-xs text-[hsl(var(--text-muted))] font-body mr-1">Sequence:</span>
                        {customDegrees.map((d, i) => (
                          <span key={i} className="text-sm font-display font-bold text-[hsl(var(--color-primary))]">
                            {scaleChords[d]?.chordSymbol ?? '?'}{i < customDegrees.length - 1 && <span className="text-[hsl(var(--text-muted))] ml-1">–</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Save / Load */}
            <div className="relative rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500/30" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-7 rounded-lg bg-rose-500/15">
                    <FolderOpen className="size-4 text-rose-400" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">My Progressions</h3>
                  {savedProgressions.length > 0 && <span className="text-[10px] font-display font-bold text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-surface))] rounded-full px-2 py-0.5">{savedProgressions.length}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {hasChords && (
                    <div className="relative">
                      {!showSaveDialog ? (
                        <button onClick={() => { setShowSaveDialog(true); setSaveName(''); setJustSaved(false); }} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-display font-bold bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border border-[hsl(var(--color-primary)/0.3)] hover:bg-[hsl(var(--color-primary)/0.22)] transition-all duration-150">
                          <Save className="size-3.5" /> Save Current
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input autoFocus type="text" placeholder="Progression name..." value={saveName} onChange={(e) => setSaveName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) { saveProgression(saveName); setJustSaved(true); setTimeout(() => { setShowSaveDialog(false); setJustSaved(false); }, 1200); } if (e.key === 'Escape') setShowSaveDialog(false); }}
                            className="w-[160px] rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-2.5 py-1.5 text-xs font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.6)]" />
                          {justSaved ? (
                            <span className="flex items-center gap-1 text-xs font-body font-medium text-[hsl(var(--semantic-success))]"><Check className="size-3.5" /> Saved</span>
                          ) : (
                            <>
                              <button onClick={() => { if (saveName.trim()) { saveProgression(saveName); setJustSaved(true); setTimeout(() => { setShowSaveDialog(false); setJustSaved(false); }, 1200); } }} disabled={!saveName.trim()} className="flex items-center justify-center size-7 rounded-md bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><Check className="size-3.5" /></button>
                              <button onClick={() => setShowSaveDialog(false)} className="flex items-center justify-center size-7 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"><X className="size-3.5" /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {savedProgressions.length > 0 && (
                    <button onClick={() => setShowSavedList(!showSavedList)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-display font-bold border transition-all duration-150 ${showSavedList ? 'bg-[hsl(var(--color-emphasis)/0.12)] text-[hsl(var(--color-emphasis))] border-[hsl(var(--color-emphasis)/0.3)]' : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] border-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'}`}>
                      <ChevronDown className={`size-3 transition-transform ${showSavedList ? 'rotate-180' : ''}`} /> {showSavedList ? 'Hide' : 'Browse'}
                    </button>
                  )}
                </div>
              </div>
              {showSavedList && savedProgressions.length > 0 && (
                <div className="space-y-2">
                  {savedProgressions.map((sp) => {
                    const scale = SCALES.find((s) => s.id === sp.scaleId);
                    const scaleName = scale ? scale.name.replace(' Scale', '') : sp.scaleId;
                    const scaleChords = scale ? resolveScaleChords(sp.key, scale) : [];
                    const chordNames = sp.degrees.map((d) => scaleChords[d]?.chordSymbol ?? '?').join(' \u2013 ');
                    return (
                      <div key={sp.id} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] px-4 py-3 group hover:border-[hsl(var(--color-primary)/0.3)] transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display font-bold text-[hsl(var(--text-default))] truncate">{sp.name}</p>
                          <p className="text-xs font-body text-[hsl(var(--text-muted))] truncate mt-0.5"><span className="text-[hsl(var(--color-primary))] font-medium">{sp.key} {scaleName}</span><span className="mx-1.5">{'\u00b7'}</span>{chordNames}</p>
                        </div>
                        <button onClick={() => { loadSavedProgression(sp); setShowSavedList(false); }} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-display font-bold bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.2)] transition-colors"><Upload className="size-3" /> Load</button>
                        <button onClick={() => deleteSavedProgression(sp.id)} className="flex items-center justify-center size-7 rounded-md text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.1)] opacity-0 group-hover:opacity-100 transition-all duration-150" title="Delete"><Trash2 className="size-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              {savedProgressions.length === 0 && (
                <div className="text-center py-4"><p className="text-xs font-body text-[hsl(var(--text-muted))]">No saved progressions yet. Build or select a progression above, then save it here.</p></div>
              )}
            </div>

            {/* Summary + Start */}
            <div className="relative rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis)/0.3)]" />
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-lg bg-[hsl(var(--color-primary)/0.15)]">
                  <Play className="size-4 text-[hsl(var(--color-primary))]" />
                </div>
                <h3 className="font-display text-base font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Ready to Practice</h3>
              </div>
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between"><span className="text-[hsl(var(--text-muted))]">Key</span><span className="text-[hsl(var(--text-default))] font-medium">{selectedKeySignature.display}</span></div>
                <div className="flex justify-between"><span className="text-[hsl(var(--text-muted))]">Scale</span><span className="text-[hsl(var(--text-default))] font-medium">{selectedScale.name}</span></div>
                <div className="flex justify-between"><span className="text-[hsl(var(--text-muted))]">Progression</span><span className="text-[hsl(var(--text-default))] font-medium text-right max-w-[60%]">{resolvedChords.map((c) => c.chordSymbol).join(' \u2013 ') || 'None selected'}</span></div>
                <div className="flex justify-between"><span className="text-[hsl(var(--text-muted))]">Chords</span><span className="text-[hsl(var(--color-primary))] font-display font-bold">{resolvedChords.length}</span></div>
                {missingCount > 0 && <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--semantic-warning))]"><span>⚠ {missingCount} chord{missingCount > 1 ? 's' : ''} not in library</span></div>}
              </div>
              <button onClick={handleStart} disabled={!hasChords} className={`group/btn relative w-full flex items-center justify-center gap-3 rounded-xl py-4 font-display text-lg font-bold tracking-wide uppercase overflow-hidden transition-all duration-200 ${hasChords ? 'bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))] glow-primary hover:shadow-[0_0_30px_hsl(var(--color-primary)/0.4),0_0_80px_hsl(var(--color-primary)/0.15)] active:scale-[0.97]' : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'}`}>
                {hasChords && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />}
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
