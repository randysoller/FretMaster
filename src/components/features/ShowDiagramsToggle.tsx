import { Eye, EyeOff } from 'lucide-react';

interface ShowDiagramsToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}

const STORAGE_KEY = 'fretmaster-show-diagrams';

export function getStoredShowDiagrams(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'false') return false;
  } catch {}
  return true; // default: show diagrams
}

export function persistShowDiagrams(v: boolean) {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
}

export default function ShowDiagramsToggle({ enabled, onChange, compact = false }: ShowDiagramsToggleProps) {
  return (
    <button
      onClick={() => {
        const next = !enabled;
        onChange(next);
        persistShowDiagrams(next);
      }}
      className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 select-none active:scale-95 ${
        enabled
          ? 'border-[hsl(142_71%_45%/0.5)] bg-[hsl(142_71%_45%/0.1)] text-[hsl(142_71%_45%)]'
          : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
      }`}
      title={enabled ? 'Hide chord diagrams' : 'Show chord diagrams'}
      aria-pressed={enabled}
    >
      {enabled ? <Eye className="size-4 shrink-0" /> : <EyeOff className="size-4 shrink-0" />}
      {!compact && (
        <span className="text-base font-display font-bold whitespace-nowrap">
          {enabled ? 'Chord Diagram On' : 'Chord Diagram Off'}
        </span>
      )}
      {/* Sliding pill indicator */}
      <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${
        enabled ? 'bg-[hsl(142_71%_45%/0.35)]' : 'bg-[hsl(var(--border-default))]'
      }`}>
        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${
          enabled
            ? 'left-[15px] bg-[hsl(142_71%_45%)]'
            : 'left-[2px] bg-[hsl(var(--text-muted))]'
        }`} />
      </div>
    </button>
  );
}
