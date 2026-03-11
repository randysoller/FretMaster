import { useState, useCallback } from 'react';
import { ChevronDown, RotateCcw, Shield, Waves, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'fretmaster-advanced-detection';
const ENABLED_KEY = 'fretmaster-advanced-enabled';

export interface AdvancedDetectionValues {
  noiseGate: number;       // 0-100
  harmonicBoost: number;   // 0-100
  fluxTolerance: number;   // 0-100
}

const DEFAULTS: AdvancedDetectionValues = {
  noiseGate: 50,
  harmonicBoost: 50,
  fluxTolerance: 50,
};

export function getStoredAdvancedSettings(): AdvancedDetectionValues | null {
  try {
    const enabled = localStorage.getItem(ENABLED_KEY);
    if (enabled !== 'true') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.noiseGate === 'number') return parsed;
    }
  } catch {}
  return null;
}

export function getStoredAdvancedEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch {} return false;
}

function persistSettings(v: AdvancedDetectionValues) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
}

function persistEnabled(v: boolean) {
  try { localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false'); } catch {}
}

interface AdvancedDetectionSettingsProps {
  values: AdvancedDetectionValues;
  enabled: boolean;
  onChange: (v: AdvancedDetectionValues) => void;
  onToggleEnabled: (e: boolean) => void;
}

function SliderRow({ icon, label, description, value, onChange, color }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-display font-bold text-[hsl(var(--text-default))]">{label}</span>
        </div>
        <span className={`text-xs font-display font-bold tabular-nums ${color}`}>{value}%</span>
      </div>
      <p className="text-[10px] font-body text-[hsl(var(--text-muted))] leading-relaxed -mt-0.5">{description}</p>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="volume-slider w-full"
      />
    </div>
  );
}

export default function AdvancedDetectionSettings({ values, enabled, onChange, onToggleEnabled }: AdvancedDetectionSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  const updateValue = useCallback((key: keyof AdvancedDetectionValues, val: number) => {
    const next = { ...values, [key]: val };
    onChange(next);
    persistSettings(next);
  }, [values, onChange]);

  const handleReset = useCallback(() => {
    onChange(DEFAULTS);
    persistSettings(DEFAULTS);
  }, [onChange]);

  const handleToggle = useCallback(() => {
    const next = !enabled;
    onToggleEnabled(next);
    persistEnabled(next);
    if (next && !localStorage.getItem(STORAGE_KEY)) {
      persistSettings(DEFAULTS);
    }
  }, [enabled, onToggleEnabled]);

  return (
    <div className="rounded-lg border border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--bg-surface)/0.4)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[hsl(var(--bg-overlay)/0.5)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-[hsl(var(--color-emphasis))]" />
          <span className="text-[10px] font-display font-bold text-[hsl(var(--text-subtle))] uppercase tracking-wider">Advanced Detection</span>
          {enabled && (
            <span className="text-[9px] font-body font-medium bg-[hsl(var(--color-emphasis)/0.15)] text-[hsl(var(--color-emphasis))] rounded-full px-1.5 py-0.5">Active</span>
          )}
        </div>
        <ChevronDown className={`size-3.5 text-[hsl(var(--text-muted))] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[hsl(var(--border-subtle)/0.3)]">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-body text-[hsl(var(--text-muted))]">
                  {enabled ? 'Overrides main sensitivity slider' : 'Using main sensitivity slider'}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={handleReset} className="text-[10px] font-body text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] transition-colors flex items-center gap-1" title="Reset to defaults">
                    <RotateCcw className="size-3" /> Reset
                  </button>
                  <button
                    onClick={handleToggle}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${enabled ? 'bg-[hsl(var(--color-emphasis))]' : 'bg-[hsl(var(--border-default))]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              </div>

              {enabled && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5">
                  <SliderRow
                    icon={<Shield className="size-3.5 text-amber-400" />}
                    label="Noise Gate"
                    description="Lower = stricter silence detection (rejects more noise). Higher = more sensitive to quiet playing."
                    value={values.noiseGate}
                    onChange={(v) => updateValue('noiseGate', v)}
                    color="text-amber-400"
                  />
                  <SliderRow
                    icon={<Waves className="size-3.5 text-cyan-400" />}
                    label="Harmonic Sensitivity"
                    description="Lower = requires stronger note presence. Higher = detects subtle harmonics and quiet strings."
                    value={values.harmonicBoost}
                    onChange={(v) => updateValue('harmonicBoost', v)}
                    color="text-cyan-400"
                  />
                  <SliderRow
                    icon={<Zap className="size-3.5 text-violet-400" />}
                    label="Flux Tolerance"
                    description="Lower = rejects changing sounds (voice). Higher = accepts more spectral variation."
                    value={values.fluxTolerance}
                    onChange={(v) => updateValue('fluxTolerance', v)}
                    color="text-violet-400"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
