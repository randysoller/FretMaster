
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import CategorySelector from '@/components/features/CategorySelector';
import TypeSelector from '@/components/features/TypeSelector';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import { KEY_SIGNATURES } from '@/constants/scales';
import type { KeySignature } from '@/constants/scales';
import { Play, Music, AlertCircle, ChevronDown, X, KeyRound, Shapes, Layers } from 'lucide-react';
import heroImg from '@/assets/hero-guitar.jpg';

export default function Home() {
  const navigate = useNavigate();
  const { startPractice, getAvailableCount, categories, chordTypes, barreRoots, keyFilter, setKeyFilter } = usePracticeStore();
  const availableCount = getAvailableCount();
  const [keyDropdownOpen, setKeyDropdownOpen] = useState(false);

  const handleStart = () => {
    if (availableCount === 0) return;
    startPractice();
    navigate('/practice');
    // Note: This page is now at /chord-practice
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="Guitar fretboard"
            className="size-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--bg-base)/0.3)] via-[hsl(var(--bg-base)/0.7)] to-[hsl(var(--bg-base))]" />
        </div>

        <div className="relative px-4 sm:px-6 py-10 sm:py-16 md:py-24 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-6">
            <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">
              Guitar Chord Trainer
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight text-balance">
            <span className="text-[hsl(var(--text-default))]">Master Every Chord.</span>
            <br />
            <span className="text-gradient">One Fret at a Time.</span>
          </h1>

          <p className="mt-3 sm:mt-5 font-body text-sm sm:text-base md:text-lg text-[hsl(var(--text-subtle))] max-w-xl mx-auto text-pretty">
            Challenge yourself with timed chord reveals. Pick a category, set your timer, and test how well you know your fretboard.
          </p>
        </div>
      </div>

      {/* Setup Section */}
      <div className="px-4 sm:px-6 pb-12 sm:pb-16 -mt-2 sm:-mt-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Left: Category + Type */}
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Key Filter */}
              <div className="relative z-10 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/30" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/15">
                      <KeyRound className="size-4 text-amber-400" />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">Filter by Key</h3>
                  </div>
                  {keyFilter && (
                    <button onClick={() => setKeyFilter(null)} className="flex items-center gap-1 text-xs font-body text-[hsl(var(--semantic-error))] hover:underline">
                      <X className="size-3" /> Clear
                    </button>
                  )}
                </div>
                {/* Closing div for the Key Filter content area, which was missing */}
                {/* This div was implicitly closed by the following div, which caused the parsing error */}
                {/* The error message "Parsing error: ')' expected." on line 239:4 suggests an unbalanced JSX tag or expression. */}
                {/* Upon inspection, the </div> for the content of the Key Filter section was missing, leading to unexpected nesting. */}
                {/* It was supposed to wrap the button and the dropdown. */}
                {/* I am re-adding the missing closing div for the Key Filter content, to correctly close the `div` started on line 105 */}
                {/* before the key dropdown button. */}
                <div> {/* This div was implicitly opened and implicitly closed, leading to syntax error, now it's explicitly closed. */}
                  <div className="relative">
                    <button onClick={() => setKeyDropdownOpen(!keyDropdownOpen)} className="w-full flex items-center justify-between rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-4 py-4 sm:py-3 text-xl sm:text-base font-body text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))] transition-colors">
                      <div className="flex items-center gap-3">
                        {keyFilter ? (
                          <>
                            <span className="font-display font-bold text-xl sm:text-base">{keyFilter.display} Major</span>
                            {keyFilter.count > 0 && (
                              <span className="text-base sm:text-xs text-[hsl(var(--text-muted))]">
                                {keyFilter.count} {keyFilter.type === 'sharp' ? (keyFilter.count === 1 ? 'sharp' : 'sharps') : (keyFilter.count === 1 ? 'flat' : 'flats')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[hsl(var(--text-muted))]">All Keys</span>
                        )}
                      </div>
                      <ChevronDown className={`size-4 text-[hsl(var(--text-muted))] transition-transform ${keyDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {keyDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] shadow-xl overflow-hidden max-h-[70vh] sm:max-h-[360px] overflow-y-auto">
                        <button
                          onClick={() => { setKeyFilter(null); setKeyDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3.5 sm:py-2.5 text-xl sm:text-base font-body transition-colors ${
                            !keyFilter
                              ? 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-medium'
                              : 'text-[hsl(var(--text-subtle))] hover:bg-[hsl(var(--bg-overlay))] hover:text-[hsl(var(--text-default))]'
                          }`}
                        >
                          All Keys
                        </button>
                        {KEY_SIGNATURES.map((ks) => {
                          const isActive = keyFilter?.display === ks.display;
                          return (
                            <button
                              key={ks.display}
                              onClick={() => { setKeyFilter(ks); setKeyDropdownOpen(false); }}
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
                                    {ks.count}{ks.type === 'sharp' ? '\u266f' : '\u266d'}
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
                  <p className="mt-2 text-[11px] font-body text-[hsl(var(--text-muted))]">
                    {keyFilter ? `Showing only chords with roots in the ${keyFilter.display} major scale` : 'Showing chords in all keys'}
                  </p>
                </div> {/* Closing div for the Key Filter content area */}
              </div> {/* Closing div for the Key Filter section (started on line 105) */}
              <div className="relative z-[9] rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500/30" />
                <CategorySelector accentIcon={<div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/15"><Shapes className="size-4 text-emerald-400" /></div>} />
              </div>
              <div className="relative z-[8] rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500/30" />
                <TypeSelector accentIcon={<div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/15"><Layers className="size-4 text-violet-400" /></div>} />
              </div>
            </div>

            {/* Right: Summary + Start */}
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
                <h3 className="font-display text-base sm:text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
                  Ready to Practice
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-[hsl(var(--text-muted))]">Category</span>
                    <span className="text-[hsl(var(--text-default))] font-medium">
                      {categories.size === 0 || categories.size === 3
                        ? 'All Chords'
                        : [...categories].map((c) => CATEGORY_LABELS[c]).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-[hsl(var(--text-muted))]">Type</span>
                    <span className="text-[hsl(var(--text-default))] font-medium">
                      {chordTypes.size === 0
                        ? 'All Types'
                        : [...chordTypes].map((t) => CHORD_TYPE_LABELS[t]).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-[hsl(var(--text-muted))]">Key</span>
                    <span className="text-[hsl(var(--text-default))] font-medium">
                      {keyFilter ? `${keyFilter.display} Major` : 'All Keys'}
                    </span>
                  </div>
                  {(categories.has('barre') || categories.has('movable') || categories.size === 0 || categories.size === 3) && barreRoots.size > 0 && barreRoots.size < 3 && (
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-[hsl(var(--text-muted))]">Root String</span>
                      <span className="text-[hsl(var(--text-default))] font-medium">
                        {[...barreRoots].map((r) => BARRE_ROOT_LABELS[r]).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="h-px bg-[hsl(var(--border-subtle))]" />
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-[hsl(var(--text-muted))]">Available chords</span>
                    <span className={`font-display font-bold text-lg ${
                      availableCount > 0 ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--semantic-error))]'
                    }`}>
                      {availableCount}
                    </span>
                  </div>
                </div>

                {availableCount === 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--semantic-error)/0.1)] border border-[hsl(var(--semantic-error)/0.2)] px-3 py-2">
                    <AlertCircle className="size-4 text-[hsl(var(--semantic-error))]" />
                    <span className="text-xs text-[hsl(var(--semantic-error))] font-body">
                      No chords match this combination. Try a different category or type.
                    </span>
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={availableCount === 0}
                  className={`
                    group/btn relative w-full flex items-center justify-center gap-3 rounded-xl py-4 font-display text-lg font-bold tracking-wide uppercase overflow-hidden transition-all duration-200
                    ${availableCount > 0
                      ? 'bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] text-[hsl(var(--bg-base))] glow-primary hover:shadow-[0_0_30px_hsl(var(--color-primary)/0.4),0_0_80px_hsl(var(--color-primary)/0.15)] active:scale-[0.97]'
                      : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'
                    }
                  `}
                >
                  {availableCount > 0 && (
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                  )}
                  <Play className="size-5 transition-transform duration-200 group-hover/btn:scale-110" />
                  <span className="relative">Start Practice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
