import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Music, ChevronRight } from 'lucide-react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import heroImg from '@/assets/hero-guitar.jpg';

function SpotlightCard({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-200);
  const mouseY = useMotionValue(-200);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const spotlight = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, hsl(var(--color-primary) / 0.12), transparent 70%)`;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl z-10 transition-opacity duration-300"
        style={{ background: spotlight, opacity: isHovered ? 1 : 0 }}
      />
      {children}
    </motion.div>
  );
}

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
          <SpotlightCard delay={0.3}>
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
                  {/* Open G chord diagram */}
                  <svg width="28" height="34" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Nut */}
                    <rect x="4" y="6" width="26" height="2.5" rx="0.5" fill="hsl(var(--bg-base))" />
                    {/* Fret lines */}
                    {[0, 1, 2, 3].map((f) => (
                      <line key={f} x1="4" y1={12 + f * 8} x2="30" y2={12 + f * 8} stroke="hsl(var(--bg-base))" strokeOpacity="0.35" strokeWidth="0.8" />
                    ))}
                    {/* String lines */}
                    {[0, 1, 2, 3, 4, 5].map((s) => (
                      <line key={s} x1={4 + s * 5.2} y1="8" x2={4 + s * 5.2} y2="36" stroke="hsl(var(--bg-base))" strokeOpacity="0.5" strokeWidth={s === 0 ? 1.2 : s <= 2 ? 1 : 0.7} />
                    ))}
                    {/* Open string markers: D(3), G(2), B(1) — strings index 2,3,4 from low E */}
                    {[2, 3, 4].map((s) => (
                      <circle key={s} cx={4 + s * 5.2} cy="3.5" r="2" stroke="hsl(var(--bg-base))" strokeWidth="1" fill="none" />
                    ))}
                    {/* Finger dots: 6th string fret 3, 5th string fret 2, 1st string fret 3 */}
                    {/* String 6 (index 0) fret 3 — between fret lines 2 and 3 → y center = 12 + 2*8 - 4 = 24 */}
                    <circle cx={4 + 0 * 5.2} cy="24" r="2.8" fill="hsl(var(--bg-base))" />
                    {/* String 5 (index 1) fret 2 — between fret lines 1 and 2 → y center = 12 + 1*8 - 4 = 16 */}
                    <circle cx={4 + 1 * 5.2} cy="16" r="2.8" fill="hsl(var(--bg-base))" />
                    {/* String 1 (index 5) fret 3 — y center = 24 */}
                    <circle cx={4 + 5 * 5.2} cy="24" r="2.8" fill="hsl(var(--bg-base))" />
                  </svg>
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
          </SpotlightCard>

          {/* Progression Practice Card */}
          <SpotlightCard delay={0.45}>
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
                  {/* I–IV–V Roman numeral graphic */}
                  <svg width="28" height="34" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* I — large, centered at top */}
                    <text x="17" y="17" fill="hsl(var(--bg-base))" fontFamily="Georgia, serif" fontWeight="800" fontSize="19" textAnchor="middle">
                      I
                    </text>
                    {/* Thin separator */}
                    <line x1="9" y1="22" x2="25" y2="22" stroke="hsl(var(--bg-base))" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3" />
                    {/* IV — bottom left */}
                    <text x="12" y="36" fill="hsl(var(--bg-base))" fontFamily="Georgia, serif" fontWeight="700" fontSize="13" textAnchor="middle">
                      IV
                    </text>
                    {/* Middle dot separator */}
                    <circle cx="20" cy="33" r="1" fill="hsl(var(--bg-base))" opacity="0.4" />
                    {/* V — bottom right */}
                    <text x="27" y="36" fill="hsl(var(--bg-base))" fontFamily="Georgia, serif" fontWeight="700" fontSize="13" textAnchor="middle">
                      V
                    </text>
                  </svg>
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
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
