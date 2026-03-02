import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import MobileTabBar from './MobileTabBar';
import { preloadMetronomeSamples } from '@/stores/metronomeStore';
import { useProgressionStore } from '@/stores/progressionStore';

export default function AppLayout() {
  const preloaded = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (preloaded.current) return;
      preloaded.current = true;
      preloadMetronomeSamples();
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler, { once: false });
    window.addEventListener('touchstart', handler, { once: false });
    window.addEventListener('keydown', handler, { once: false });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const { pathname } = useLocation();
  const progressionPracticing = useProgressionStore((s) => s.isPracticing);
  const hideTabBar = pathname === '/practice' || (pathname === '/progressions' && progressionPracticing);

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--bg-base))]">
      <Header />
      <main className={`flex-1 sm:pb-0 ${hideTabBar ? 'pb-0' : 'pb-[56px]'}`}>
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}
