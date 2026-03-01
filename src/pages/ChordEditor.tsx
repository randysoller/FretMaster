import { useState } from 'react';
import { useCustomChordStore } from '@/stores/customChordStore';
import InteractiveFretboard from '@/components/features/InteractiveFretboard';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import ColorShapePicker from '@/components/features/ColorShapePicker';
import { CHORD_TYPE_LABELS, CATEGORY_LABELS } from '@/types/chord';
import type { ChordType, ChordCategory } from '@/types/chord';
import type { DotShape } from '@/types/customChord';
import { DEFAULT_DOT_COLOR, DEFAULT_ROOT_COLOR } from '@/types/customChord';
import {
  Plus, Save, Trash2, RotateCcw,
  Minus, FileText, Pencil, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const EDITABLE_TYPES: ChordType[] = [
  'major', 'minor', 'augmented', 'slash', 'diminished', 'suspended',
  'major7', 'dominant7', 'minor7', 'aug7', 'halfDim7', 'dim7',
  '9th', '11th', '13th',
];

const EDITABLE_CATEGORIES: ChordCategory[] = ['open', 'barre', 'movable', 'custom'];

export default function ChordEditor() {
  const {
    currentChord, selectedColor, selectedShape,
    selectedFinger, customLabel, isEditing,
    setSelectedColor, setSelectedShape, setSelectedFinger,
    setCustomLabel, setName, setSymbol, setBaseFret, setNumFrets,
    setChordType, setChordCategory,
    saveChord, newChord, clearFretboard,
    deleteFromLibrary,
  } = useCustomChordStore();
  const navigate = useNavigate();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleShapeChange = (shape: DotShape) => {
    setSelectedShape(shape);
    if (shape === 'diamond') {
      setSelectedColor(DEFAULT_ROOT_COLOR);
    } else if (selectedColor === DEFAULT_ROOT_COLOR) {
      setSelectedColor(DEFAULT_DOT_COLOR);
    }
  };

  const canSave = currentChord.name.trim() !== '' && currentChord.symbol.trim() !== '' && currentChord.markers.length > 0;
  const canDelete = isEditing || !!currentChord.sourceChordId;

  const handleSave = () => {
    saveChord();
    toast.success(
      isEditing ? 'Chord updated in your library!' : 'Chord saved to your library!',
      { description: `"${currentChord.symbol}" is now available in the Chord Library.` }
    );
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-default))]">
              Chord Editor
            </h1>
            <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
              {currentChord.sourceChordId
                ? `Editing: ${currentChord.symbol} — drag dots to reposition, tap to change fingers`
                : 'Create and customize your own chord diagrams'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Left: Interactive Fretboard */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                    Fretboard
                  </h2>
                  <button
                    onClick={clearFretboard}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-body font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)] transition-colors"
                  >
                    <RotateCcw className="size-3.5" />
                    Clear
                  </button>
                </div>

                <p className="text-xs font-body text-[hsl(var(--text-muted))] mb-3">
                  Tap fret to place dot. Tap dot to change finger, delete, or start barre. Drag dots to move. Double-click barre to remove.
                </p>

                <div className="flex justify-center overflow-x-auto">
                  <InteractiveFretboard chord={currentChord} />
                </div>
              </div>

              {/* Fret Settings */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                  Fret Settings
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Base Fret</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBaseFret(currentChord.baseFret - 1)}
                        disabled={currentChord.baseFret <= 1}
                        className="size-8 rounded-md bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] flex items-center justify-center hover:bg-[hsl(var(--bg-overlay))] disabled:opacity-30 transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="font-display text-lg font-bold text-[hsl(var(--text-default))] min-w-[2ch] text-center">
                        {currentChord.baseFret}
                      </span>
                      <button
                        onClick={() => setBaseFret(currentChord.baseFret + 1)}
                        disabled={currentChord.baseFret >= 20}
                        className="size-8 rounded-md bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] flex items-center justify-center hover:bg-[hsl(var(--bg-overlay))] disabled:opacity-30 transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Visible Frets</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNumFrets(currentChord.numFrets - 1)}
                        disabled={currentChord.numFrets <= 3}
                        className="size-8 rounded-md bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] flex items-center justify-center hover:bg-[hsl(var(--bg-overlay))] disabled:opacity-30 transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="font-display text-lg font-bold text-[hsl(var(--text-default))] min-w-[2ch] text-center">
                        {currentChord.numFrets}
                      </span>
                      <button
                        onClick={() => setNumFrets(currentChord.numFrets + 1)}
                        disabled={currentChord.numFrets >= 7}
                        className="size-8 rounded-md bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] flex items-center justify-center hover:bg-[hsl(var(--bg-overlay))] disabled:opacity-30 transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barre display — existing barres from interactive fretboard */}
                {currentChord.barres.length > 0 && (
                  <div>
                    <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Active Barres</label>
                    <div className="flex flex-wrap gap-1.5">
                      {currentChord.barres.map((b, idx) => (
                        <span
                          key={`${b.fret}-${b.fromString}-${b.toString}-${idx}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-body bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))]"
                        >
                          Fret {b.fret}: {['E','A','D','G','B','e'][b.fromString]}→{['E','A','D','G','B','e'][b.toString]}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-body text-[hsl(var(--text-muted))] mt-1">Double-click a barre on the fretboard to remove it.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Dot Settings + Meta */}
            <div className="lg:col-span-4 space-y-5">
              {/* Chord Info */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="size-4" />
                  Chord Info
                </h2>

                <div>
                  <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Chord Name *</label>
                  <input
                    type="text"
                    value={currentChord.name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. C Major"
                    className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                  />
                </div>

                <div>
                  <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Symbol *</label>
                  <input
                    type="text"
                    value={currentChord.symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="e.g. C, Am7, Bb+"
                    className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                  />
                </div>

                {/* Category & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-body text-xs text-[hsl(var(--text-muted))] flex items-center gap-1 mb-1.5">
                      <Tag className="size-3" />
                      Category
                    </label>
                    <select
                      value={currentChord.chordCategory ?? 'custom'}
                      onChange={(e) => setChordCategory(e.target.value as ChordCategory)}
                      className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                    >
                      {EDITABLE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-xs text-[hsl(var(--text-muted))] flex items-center gap-1 mb-1.5">
                      <Tag className="size-3" />
                      Type
                    </label>
                    <select
                      value={currentChord.chordType ?? 'major'}
                      onChange={(e) => setChordType(e.target.value as ChordType)}
                      className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2.5 text-sm font-body text-[hsl(var(--text-default))] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                    >
                      {EDITABLE_TYPES.map((type) => (
                        <option key={type} value={type}>{CHORD_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dot Appearance */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider flex items-center gap-2">
                  <Pencil className="size-4" />
                  Dot Appearance
                </h2>
                <p className="text-xs font-body text-[hsl(var(--text-muted))]">
                  Configure the color, shape, and label for the next dot you place.
                </p>

                <ColorShapePicker
                  selectedColor={selectedColor}
                  selectedShape={selectedShape}
                  onColorChange={setSelectedColor}
                  onShapeChange={handleShapeChange}
                />

                {/* Finger Number */}
                <div>
                  <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider block mb-2">
                    Finger Number
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { val: 1, display: '1' },
                      { val: 2, display: '2' },
                      { val: 3, display: '3' },
                      { val: 4, display: '4' },
                      { val: 5, display: 'T' },
                      { val: 0, display: '–' },
                    ].map((f) => (
                      <button
                        key={f.val}
                        onClick={() => {
                          if (f.display === 'T') {
                            setSelectedFinger(0);
                            setCustomLabel('T');
                          } else {
                            setSelectedFinger(f.val);
                            if (customLabel === 'T') setCustomLabel('');
                          }
                        }}
                        className={`size-8 rounded-md text-xs font-body font-bold transition-all ${
                          (f.display === 'T' && customLabel === 'T')
                            || (f.display !== 'T' && selectedFinger === f.val && customLabel !== 'T')
                            ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))]'
                            : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))]'
                        }`}
                        title={f.display === 'T' ? 'Thumb' : f.display === '–' ? 'No label' : `Finger ${f.val}`}
                      >
                        {f.display}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Label */}
                <div>
                  <label className="font-display text-xs font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider block mb-2">
                    Custom Fret Label
                    <span className="ml-1 normal-case tracking-normal font-normal text-[hsl(var(--text-muted)/0.6)]">(overrides finger #)</span>
                  </label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value.slice(0, 3))}
                    placeholder="R, T, 3, etc."
                    maxLength={3}
                    className="w-24 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-3 py-2 text-sm font-body text-[hsl(var(--text-default))] placeholder:text-[hsl(var(--text-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--color-primary))] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-lg py-3 font-display text-base font-bold transition-all duration-200
                  ${canSave
                    ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98]'
                    : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'
                  }
                `}
              >
                <Save className="size-4" />
                {isEditing ? 'Update Chord' : 'Save to Library'}
              </button>

              {(isEditing || currentChord.sourceChordId) && (
                <div className="space-y-2">
                  <button
                    onClick={newChord}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-body font-medium text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
                  >
                    <Plus className="size-3.5" />
                    Cancel — Start New
                  </button>

                  {canDelete && !showDeleteConfirm && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-body font-medium text-[hsl(var(--semantic-error)/0.8)] border border-[hsl(var(--semantic-error)/0.25)] hover:bg-[hsl(var(--semantic-error)/0.08)] hover:text-[hsl(var(--semantic-error))] transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                      Delete from Library
                    </button>
                  )}

                  {showDeleteConfirm && (
                    <div className="rounded-lg border border-[hsl(var(--semantic-error)/0.3)] bg-[hsl(var(--semantic-error)/0.06)] p-3 space-y-2.5">
                      <p className="text-xs font-body text-[hsl(var(--semantic-error))] text-center">
                        Remove <strong>{currentChord.symbol || 'this chord'}</strong> from the library?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 rounded-md py-2 text-xs font-body font-medium text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            deleteFromLibrary();
                            setShowDeleteConfirm(false);
                            toast.success('Chord removed from library');
                          }}
                          className="flex-1 rounded-md py-2 text-xs font-body font-bold bg-[hsl(var(--semantic-error))] text-white hover:bg-[hsl(0_84%_50%)] transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Preview + Saved */}
            <div className="lg:col-span-3 space-y-5">
              {/* Live Preview */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider mb-4">
                  Live Preview
                </h2>
                <div className="flex flex-col items-center gap-3">
                  {currentChord.symbol && (
                    <span className="font-display text-xl font-bold text-[hsl(var(--color-primary))]">
                      {currentChord.symbol}
                    </span>
                  )}
                  {currentChord.name && (
                    <span className="font-body text-xs text-[hsl(var(--text-muted))]">
                      {currentChord.name}
                    </span>
                  )}
                  <CustomChordDiagram chord={currentChord} size="lg" />
                  {(currentChord.chordCategory || currentChord.chordType) && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {currentChord.chordCategory && (
                        <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[9px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                          {CATEGORY_LABELS[currentChord.chordCategory]}
                        </span>
                      )}
                      {currentChord.chordType && (
                        <span className="rounded-md bg-[hsl(var(--bg-surface))] px-2 py-0.5 text-[9px] font-body font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                          {CHORD_TYPE_LABELS[currentChord.chordType]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
