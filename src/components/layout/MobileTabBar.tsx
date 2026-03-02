import { Link, useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import MetronomeDropdown from '@/components/features/MetronomeDropdown';

function TuningForkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 2v8a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2" />
      <line x1="12" y1="13" x2="12" y2="22" />
    </svg>
  );
}

function GuitarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m11.9 12.1 4.514-4.514" />
      <path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 15 8.172H13.656a2 2 0 0 0-1.414.586l-.548.547" />
      <path d="M6.584 9.515a5 5 0 0 0 7.9 7.9" />
      <path d="m8 15-1.5 1.5" />
      <path d="M6 12a2 2 0 0 0-1.735 1c-.426.74-.26 2.065.883 3.208 1.143 1.143 2.468 1.309 3.208.883A2 2 0 0 0 9.384 15.5" />
    </svg>
  );
}

const leftTabs = [
  { to: '/', label: 'Practice', icon: GuitarIcon, matchPaths: ['/', '/chord-practice', '/practice', '/progressions'] },
] as const;

const rightTabs = [
  { to: '/library', label: 'Library', icon: BookOpen, matchPaths: ['/library'] },
  { to: '/tuner', label: 'Tuner', icon: TuningForkIcon, matchPaths: ['/tuner'] },
] as const;

export default function MobileTabBar() {
  const { pathname } = useLocation();

  const renderTab = (tab: typeof leftTabs[number] | typeof rightTabs[number]) => {
    const isActive = tab.matchPaths.some((p) =>
      p === '/' ? pathname === '/' : pathname.startsWith(p),
    );
    const Icon = tab.icon;
    return (
      <Link
        key={tab.to}
        to={tab.to}
        className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isActive
            ? 'text-[hsl(var(--color-primary))]'
            : 'text-[hsl(var(--text-muted))] active:text-[hsl(var(--text-default))]'
        }`}
      >
        <Icon className="size-[30px]" />
        <span className="text-[14px] font-display font-semibold leading-none">{tab.label}</span>
        {isActive && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[hsl(var(--color-primary))]" />
        )}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-base)/0.92)] backdrop-blur-lg safe-area-bottom">
      <div className="grid grid-cols-4 h-[56px]">
        {leftTabs.map(renderTab)}
        {/* Center metronome */}
        <div className="flex flex-col items-center justify-center">
          <MetronomeDropdown position="bottom" />
        </div>
        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
}
