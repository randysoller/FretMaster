import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import CategorySelector from '@/components/features/CategorySelector';
import TypeSelector from '@/components/features/TypeSelector';
import TimerSelector from '@/components/features/TimerSelector';
import { CATEGORY_LABELS, CHORD_TYPE_LABELS, BARRE_ROOT_LABELS } from '@/types/chord';
import { Play, Music, AlertCircle } from 'lucide-react';
import heroImg from '@/assets/hero-guitar.jpg';

export default function Home() {
  const navigate = useNavigate();
  const { startPractice, getAvailableCount, categories, chordTypes, barreRoots } = usePracticeStore();
  const availableCount = getAvailableCount();

  const handleStart = () => {
    if (availableCount === 0) return;
    startPractice();
    navigate('/practice');
  };

  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
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

        <div className="relative px-6 py-16 md:py-24 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-6">
            <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">
              Guitar Chord Trainer
            </span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight text-balance">
            <span className="text-[hsl(var(--text-default))]">Master Every Chord.</span>
            <br />
            <span className="text-gradient">One Fret at a Time.</span>
          </h1>

          <p className="mt-5 font-body text-base md:text-lg text-[hsl(var(--text-subtle))] max-w-xl mx-auto text-pretty">
            Challenge yourself with timed chord reveals. Pick a category, set your timer, and test how well you know your fretboard.
          </p>
        </div>
      </div>

      {/* Setup Section */}
      <div className="px-6 pb-16 -mt-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Category + Type */}
            <div className="lg:col-span-7 space-y-8">
              <div className="relative z-10 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6">
                <CategorySelector />
              </div>
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6">
                <TypeSelector />
              </div>
            </div>

            {/* Right: Timer + Start */}
            <div className="lg:col-span-5 space-y-8">
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6">
                <TimerSelector />
              </div>

              {/* Summary + Start */}
              <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.6)] backdrop-blur-sm p-6 space-y-5">
                <h3 className="font-display text-lg font-semibold text-[hsl(var(--text-default))] uppercase tracking-wider">
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
                    w-full flex items-center justify-center gap-3 rounded-lg py-5 font-display text-5xl font-bold transition-all duration-200
                    ${availableCount > 0
                      ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--bg-base))] hover:bg-[hsl(var(--color-brand))] glow-primary active:scale-[0.98]'
                      : 'bg-[hsl(var(--bg-surface))] text-[hsl(var(--text-muted))] cursor-not-allowed'
                    }
                  `}
                >
                  <Play className="size-5" />
                  Start Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
