import { Link } from 'react-router-dom';
import { Guitar, ListMusic, Music, ChevronRight } from 'lucide-react';
import heroImg from '@/assets/hero-guitar.jpg';

export default function PracticeLanding() {
  return (
    <div className="stage-gradient min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="Guitar fretboard"
            className="size-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--bg-base)/0.4)] via-[hsl(var(--bg-base)/0.75)] to-[hsl(var(--bg-base))]" />
        </div>

        <div className="relative px-4 sm:px-6 py-10 sm:py-16 md:py-20 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-5">
            <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">
              Choose Your Practice Mode
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-balance">
            <span className="text-[hsl(var(--text-default))]">How Do You Want to</span>
            <br />
            <span className="text-gradient">Practice Today?</span>
          </h1>

          <p className="mt-3 sm:mt-4 font-body text-sm sm:text-base text-[hsl(var(--text-subtle))] max-w-lg mx-auto text-pretty">
            Master individual chords or work through full progressions — pick a mode and start building your skills.
          </p>
        </div>
      </div>

      {/* Mode Cards */}
      <div className="px-4 sm:px-6 pb-16 -mt-2 sm:-mt-4">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Chord Practice Card */}
          <Link
            to="/chord-practice"
            className="group relative flex flex-col rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.7)] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[hsl(var(--color-primary)/0.5)] hover:shadow-[0_0_40px_hsl(var(--color-primary)/0.12)] active:scale-[0.98]"
          >
            {/* Accent glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="flex flex-col flex-1 p-5 sm:p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center justify-center size-12 rounded-xl bg-[hsl(var(--color-primary)/0.12)] border border-[hsl(var(--color-primary)/0.2)] shrink-0 group-hover:scale-110 group-hover:bg-[hsl(var(--color-primary)/0.18)] transition-all duration-300">
                  <Guitar className="size-6 text-[hsl(var(--color-primary))]" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[hsl(var(--text-default))]">
                  Chord Practice
                </h2>
              </div>

              <p className="font-body text-sm text-[hsl(var(--text-subtle))] leading-relaxed mb-4 flex-1">
                Study individual chords with timed reveals, audio playback, and real-time microphone detection. Filter by category, type, and root string.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-sm font-display font-bold text-[hsl(var(--color-primary))] group-hover:gap-3 transition-all duration-200">
                <span>Start Chord Practice</span>
                <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Progression Practice Card */}
          <Link
            to="/progressions"
            className="group relative flex flex-col rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.7)] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[hsl(var(--color-emphasis)/0.5)] hover:shadow-[0_0_40px_hsl(var(--color-emphasis)/0.12)] active:scale-[0.98]"
          >
            {/* Accent glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--color-emphasis))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-brand))] opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="flex flex-col flex-1 p-5 sm:p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center justify-center size-12 rounded-xl bg-[hsl(var(--color-emphasis)/0.12)] border border-[hsl(var(--color-emphasis)/0.2)] shrink-0 group-hover:scale-110 group-hover:bg-[hsl(var(--color-emphasis)/0.18)] transition-all duration-300">
                  <ListMusic className="size-6 text-[hsl(var(--color-emphasis))]" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[hsl(var(--text-default))]">
                  Progression Practice
                </h2>
              </div>

              <p className="font-body text-sm text-[hsl(var(--text-subtle))] leading-relaxed mb-4 flex-1">
                Practice chord transitions in any key and scale. Choose from common progressions or build your own, with a built-in metronome and tap-tempo.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-sm font-display font-bold text-[hsl(var(--color-emphasis))] group-hover:gap-3 transition-all duration-200">
                <span>Start Progressions</span>
                <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
