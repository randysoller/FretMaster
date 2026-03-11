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
          ? 'border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
          : 'border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
      }`}
      title={enabled ? 'Hide chord diagrams' : 'Show chord diagrams'}
      aria-pressed={enabled}
    >
      {enabled ? <Eye className="size-4 shrink-0" /> : <EyeOff className="size-4 shrink-0" />}
      {!compact && (
        <span className="text-xs font-display font-bold whitespace-nowrap">
          {enabled ? 'Diagrams On' : 'Diagrams Off'}
        </span>
      )}
      {/* Sliding pill indicator */}
      <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${
        enabled ? 'bg-[hsl(var(--color-primary)/0.35)]' : 'bg-[hsl(var(--border-default))]'
      }`}>
        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${
          enabled
            ? 'left-[15px] bg-[hsl(var(--color-primary))]'
            : 'left-[2px] bg-[hsl(var(--text-muted))]'
        }`} />
      </div>
    </button>
  );
}
