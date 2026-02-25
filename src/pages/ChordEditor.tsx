import { useState } from 'react';
import { useCustomChordStore } from '@/stores/customChordStore';
import InteractiveFretboard from '@/components/features/InteractiveFretboard';
import CustomChordDiagram from '@/components/features/CustomChordDiagram';
import ColorShapePicker from '@/components/features/ColorShapePicker';
import {
  Plus, Save, Trash2, Edit3, RotateCcw, ChevronDown, ChevronUp,
  Minus, FileText, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ChordEditor() {
  const {
    customChords, currentChord, selectedColor, selectedShape,
    selectedFinger, customLabel, isEditing,
    setSelectedColor, setSelectedShape, setSelectedFinger,
    setCustomLabel, setName, setSymbol, setBaseFret, setNumFrets,
    saveChord, deleteChord, editChord, newChord, clearFretboard,
  } = useCustomChordStore();

  const [showSaved, setShowSaved] = useState(true);
  const [barreFromStr, setBarreFromStr] = useState(0);
  const [barreToStr, setBarreToStr] = useState(5);
  const [barreFret, setBarreFret] = useState(1);

  const canSave = currentChord.name.trim() !== '' && currentChord.symbol.trim() !== '' && currentChord.markers.length > 0;

  const handleSave = () => {
    saveChord();
    toast.success(
      isEditing ? 'Chord updated in your library!' : 'Chord saved to your library!',
      { description: `"${currentChord.symbol}" is now available in the Chord Library.` }
    );
  };

  const handleAddBarre = () => {
    const { addBarre } = useCustomChordStore.getState();
    addBarre(barreFret, barreFromStr, barreToStr);
  };

  const handleRemoveBarre = (fret: number) => {
    const { removeBarre } = useCustomChordStore.getState();
    removeBarre(fret);
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-default))]">
              Chord Editor
            </h1>
            <p className="mt-1 font-body text-sm text-[hsl(var(--text-muted))]">
              Create and customize your own chord diagrams
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
                  Tap fret positions to place dots. Tap string headers to cycle: open → muted → none.
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

                {/* Barre tool */}
                <div>
                  <label className="font-body text-xs text-[hsl(var(--text-muted))] block mb-1.5">Add Barre</label>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <span className="text-[10px] text-[hsl(var(--text-muted))]">Fret</span>
                      <select
                        value={barreFret}
                        onChange={(e) => setBarreFret(Number(e.target.value))}
                        className="block w-16 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-default))] text-xs px-2 py-1.5 focus:outline-none focus:border-[hsl(var(--color-primary))]"
                      >
                        {Array.from({ length: currentChord.numFrets }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-[hsl(var(--text-muted))]">From</span>
                      <select
                        value={barreFromStr}
                        onChange={(e) => setBarreFromStr(Number(e.target.value))}
                        className="block w-16 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-default))] text-xs px-2 py-1.5 focus:outline-none focus:border-[hsl(var(--color-primary))]"
                      >
                        {['E', 'A', 'D', 'G', 'B', 'e'].map((s, i) => (
                          <option key={i} value={i}>{s} ({i + 1})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-[hsl(var(--text-muted))]">To</span>
                      <select
                        value={barreToStr}
                        onChange={(e) => setBarreToStr(Number(e.target.value))}
                        className="block w-16 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-default))] text-xs px-2 py-1.5 focus:outline-none focus:border-[hsl(var(--color-primary))]"
                      >
                        {['E', 'A', 'D', 'G', 'B', 'e'].map((s, i) => (
                          <option key={i} value={i}>{s} ({i + 1})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddBarre}
                      disabled={barreFromStr >= barreToStr}
                      className="rounded-md px-3 py-1.5 text-xs font-body font-medium bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.25)] disabled:opacity-30 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {currentChord.barres.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {currentChord.barres.map((b) => (
                        <span
                          key={b.fret}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-body bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-subtle))]"
                        >
                          Fret {b.fret}: {['E','A','D','G','B','e'][b.fromString]}→{['E','A','D','G','B','e'][b.toString]}
                          <button onClick={() => handleRemoveBarre(b.fret)} className="text-[hsl(var(--semantic-error))] hover:text-red-400">
                            <Trash2 className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
                  onShapeChange={setSelectedShape}
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
                {isEditing ? 'Update Chord' : 'Save Chord'}
              </button>

              {isEditing && (
                <button
                  onClick={newChord}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-body font-medium text-[hsl(var(--text-subtle))] border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors"
                >
                  <Plus className="size-3.5" />
                  Cancel — Start New
                </button>
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
                </div>
              </div>

              {/* Saved Chords */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6">
                <button
                  onClick={() => setShowSaved(!showSaved)}
                  className="w-full flex items-center justify-between"
                >
                  <h2 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                    My Chords ({customChords.length})
                  </h2>
                  {showSaved ? <ChevronUp className="size-4 text-[hsl(var(--text-muted))]" /> : <ChevronDown className="size-4 text-[hsl(var(--text-muted))]" />}
                </button>

                {showSaved && (
                  <div className="mt-4 space-y-3">
                    {customChords.length === 0 ? (
                      <p className="text-xs font-body text-[hsl(var(--text-muted))] text-center py-4">
                        No custom chords yet. Create one above!
                      </p>
                    ) : (
                      customChords.map((chord) => (
                        <div
                          key={chord.id}
                          className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.4)] p-3 flex items-center gap-3"
                        >
                          <CustomChordDiagram chord={chord} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-sm font-bold text-[hsl(var(--text-default))] truncate">
                              {chord.symbol}
                            </p>
                            <p className="font-body text-[10px] text-[hsl(var(--text-muted))] truncate">
                              {chord.name}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editChord(chord.id)}
                              className="size-7 rounded-md flex items-center justify-center text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteChord(chord.id)}
                              className="size-7 rounded-md flex items-center justify-center text-[hsl(var(--text-muted))] hover:text-[hsl(var(--semantic-error))] hover:bg-[hsl(var(--semantic-error)/0.08)] transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
