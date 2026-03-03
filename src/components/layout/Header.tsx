import { Link, useLocation } from 'react-router-dom';
import { Guitar, BookOpen, PenTool } from 'lucide-react';
import MetronomeDropdown from '@/components/features/MetronomeDropdown';
import { useTunerStore } from '@/stores/tunerStore';

function TuningForkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 2v8a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2" />
      <line x1="12" y1="13" x2="12" y2="22" />
    </svg>
  );
}

export default function Header() {
  const location = useLocation();
  const tunerStore = useTunerStore();

  const navLinks = [
    { to: '/library', label: 'Library', icon: <BookOpen className="size-[23px]" />, matchPaths: ['/library'] },
    { to: '/editor', label: 'Editor', icon: <PenTool className="size-[23px]" />, matchPaths: ['/editor'] },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.85)] backdrop-blur-md">
      <div className="flex h-[58px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center group">
          <Guitar className="size-[31px] text-[hsl(var(--color-primary))] transition-transform group-hover:rotate-[-8deg]" />
          <span className="ml-2 text-lg font-heading font-semibold text-[hsl(var(--text-default))] tracking-tight hidden sm:inline">
            Guitar Chord Trainer
          </span>
        </Link>

        <nav className="flex items-center gap-[4px]">
          {/* Tuner toggle — hidden on mobile (bottom tab bar handles it) */}
          <button
            onClick={() => tunerStore.toggle()}
            className={`
              hidden sm:flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors
              ${tunerStore.isOpen
                ? 'bg-[hsl(142_71%_45%/0.12)] text-[hsl(142_71%_45%)]'
                : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
              }
            `}
          >
            <TuningForkIcon className="size-[25px]" />
            <span className="hidden sm:inline">Tuner</span>
            {tunerStore.isOpen && (
              <span className="size-2 rounded-full bg-[hsl(142_71%_45%)] animate-pulse" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-[6px]">
          <MetronomeDropdown position="top" />
          {navLinks.map((link) => {
            const isActive = link.matchPaths.includes(location.pathname);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`
                  flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-body font-medium transition-colors
                  ${isActive
                    ? 'bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-default))] hover:bg-[hsl(var(--bg-overlay))]'
                  }
                `}
              >
                {link.icon}
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
          </div>
        </nav>
      </div>
    </header>
  );
}
