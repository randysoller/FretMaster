import { Link, useLocation } from 'react-router-dom';
import { Guitar, BookOpen, PenTool, ListMusic } from 'lucide-react';

const LAST_PRACTICE_KEY = 'fretmaster-last-practice-route';

function getLastPracticeRoute(): string {
  try {
    const stored = localStorage.getItem(LAST_PRACTICE_KEY);
    if (stored === '/' || stored === '/practice' || stored === '/progressions') return stored;
  } catch {}
  return '/';
}

export default function Header() {
  const location = useLocation();
  const lastPracticeRoute = getLastPracticeRoute();

  const navLinks = [
    { to: lastPracticeRoute, label: 'Practice', icon: <Guitar className="size-4" />, matchPaths: ['/', '/practice', '/progressions'] },
    { to: '/progressions', label: 'Progressions', icon: <ListMusic className="size-4" />, matchPaths: ['/progressions'] },
    { to: '/library', label: 'Library', icon: <BookOpen className="size-4" />, matchPaths: ['/library'] },
    { to: '/editor', label: 'Editor', icon: <PenTool className="size-4" />, matchPaths: ['/editor'] },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.85)] backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-6">
        <Link to="/" className="flex items-center group">
          <Guitar className="size-6 text-[hsl(var(--color-primary))] transition-transform group-hover:rotate-[-8deg]" />
            <span className="ml-2 text-lg font-heading font-semibold text-[hsl(var(--text-default))] tracking-tight">
              Guitar Chord Trainer
            </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          {navLinks.map((link) => {
            const isActive = link.matchPaths.includes(location.pathname);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`
                  flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body font-medium transition-colors
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
