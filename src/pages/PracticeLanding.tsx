import { Link } from 'react-router-dom';
import { Music, ChevronRight, Guitar, ListMusic } from 'lucide-react';
import { motion } from 'framer-motion';
import heroImg from '@/assets/hero-guitar.jpg';

export default function PracticeLanding() {
  return (
    <div className="stage-gradient min-h-[calc(100vh-58px)]">
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

        <div className="relative px-4 sm:px-6 py-8 sm:py-12 md:py-16 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] px-4 py-1.5 mb-5">
            <Music className="size-3.5 text-[hsl(var(--color-primary))]" />
            <span className="text-xs font-body font-medium text-[hsl(var(--color-primary))]">
              Choose Your Practice Mode
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-balance">
            <span className="text-[hsl(var(--text-default))]">What Do You Want to</span>
            <br />
            <span className="text-gradient">Play Today?</span>
          </motion.h1>


        </div>
      </div>

      {/* Mode Cards */}
      <div className="px-4 sm:px-6 pb-16 -mt-4 sm:-mt-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Chord Practice Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
          <Link
            to="/chord-practice"
            className="group relative flex flex-col h-full rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.7)] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[hsl(var(--color-primary)/0.5)] hover:shadow-[0_0_40px_hsl(var(--color-primary)/0.12)] active:scale-[0.98]"
          >
            {/* Accent glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--color-brand))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-emphasis))] opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="flex flex-col flex-1 p-5 sm:p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center justify-center size-12 rounded-xl bg-[hsl(var(--color-primary))] shrink-0 group-hover:scale-110 group-hover:brightness-110 transition-all duration-300 overflow-hidden">
                  <Guitar className="size-6 text-[hsl(var(--bg-base))]" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[hsl(var(--text-default))]">
                  Chords
                </h2>
              </div>

              <p className="font-body text-sm text-[hsl(var(--text-subtle))] leading-relaxed flex-1">
                Study individual chords with timed reveals, audio playback, and real-time microphone detection. Filter by category, type, and root string.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-sm font-display font-bold text-[hsl(var(--color-primary))] group-hover:gap-3 transition-all duration-200 mt-3">
                <span>Start</span>
                <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
          </motion.div>

          {/* Progression Practice Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
          <Link
            to="/progressions"
            className="group relative flex flex-col h-full rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated)/0.7)] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[hsl(var(--color-emphasis)/0.5)] hover:shadow-[0_0_40px_hsl(var(--color-emphasis)/0.12)] active:scale-[0.98]"
          >
            {/* Accent glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--color-emphasis))] via-[hsl(var(--color-primary))] to-[hsl(var(--color-brand))] opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="flex flex-col flex-1 p-5 sm:p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center justify-center size-12 rounded-xl bg-[hsl(var(--color-primary))] shrink-0 group-hover:scale-110 group-hover:brightness-110 transition-all duration-300 overflow-hidden">
                  <ListMusic className="size-6 text-[hsl(var(--bg-base))]" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[hsl(var(--text-default))]">
                  Chord Progressions
                </h2>
              </div>

              <p className="font-body text-sm text-[hsl(var(--text-subtle))] leading-relaxed flex-1">
                Practice chord transitions in any key. Choose from common progressions, chord progressions by style of music, or build your own.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-sm font-display font-bold text-[hsl(var(--color-emphasis))] group-hover:gap-3 transition-all duration-200 mt-3">
                <span>Start</span>
                <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
