import { Link, useLocation } from 'react-router-dom';
import { Guitar, BookOpen, PenTool } from 'lucide-react';
import MetronomeDropdown from '@/components/features/MetronomeDropdown';
import TunerDropdown from '@/components/features/TunerDropdown';

export default function Header() {
  const location = useLocation();

  const navLinks = [
    { to: '/library', label: 'Library', icon: <BookOpen className="size-[20px]" />, matchPaths: ['/library'] },
    { to: '/editor', label: 'Editor', icon: <PenTool className="size-[20px]" />, matchPaths: ['/editor'] },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.85)] backdrop-blur-md">
      <div className="flex h-[58px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center group">
          <Guitar className="size-[28px] text-[hsl(var(--color-primary))] transition-transform group-hover:rotate-[-8deg]" />
          <span className="ml-2 text-lg font-heading font-semibold text-[hsl(var(--text-default))] tracking-tight hidden sm:inline">
            Guitar Chord Trainer
          </span>
        </Link>

        <nav className="flex items-center gap-[6px]">
          {/* Metronome dropdown — first position */}
          <MetronomeDropdown />

          {/* Tuner dropdown */}
          <TunerDropdown />

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
        </nav>
      </div>
    </header>
  );
}
