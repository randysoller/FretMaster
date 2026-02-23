import { PRESET_COLORS } from '@/types/customChord';
import type { DotShape } from '@/types/customChord';
import { Circle, Diamond } from 'lucide-react';

interface ColorShapePickerProps {
  selectedColor: string;
  selectedShape: DotShape;
  onColorChange: (color: string) => void;
  onShapeChange: (shape: DotShape) => void;
}

export default function ColorShapePicker({ selectedColor, selectedShape, onColorChange, onShapeChange }: ColorShapePickerProps) {
  return (
    <div className="space-y-3">
      {/* Color Grid */}
      <div>
        <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider block mb-2">
          Dot Color
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={`size-7 rounded-md transition-all border-2 hover:scale-110 ${
                selectedColor === color
                  ? 'border-white shadow-[0_0_8px_rgba(255,255,255,0.3)] scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Custom color input */}
          <div className="relative">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 size-7 opacity-0 cursor-pointer"
              title="Custom color"
            />
            <div
              className="size-7 rounded-md border-2 border-dashed border-[hsl(var(--border-default))] flex items-center justify-center text-[hsl(var(--text-muted))] text-xs font-bold cursor-pointer hover:border-[hsl(var(--text-subtle))]"
            >
              +
            </div>
          </div>
        </div>
      </div>

      {/* Shape Toggle */}
      <div>
        <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider block mb-2">
          Dot Shape
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onShapeChange('circle')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all ${
              selectedShape === 'circle'
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
            }`}
          >
            <Circle className="size-3.5" />
            Circle
          </button>
          <button
            onClick={() => onShapeChange('diamond')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-body font-medium transition-all ${
              selectedShape === 'diamond'
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
            }`}
          >
            <Diamond className="size-3.5" />
            Diamond
          </button>
        </div>
      </div>
    </div>
  );
}
