import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { preloadMetronomeSamples } from '@/stores/metronomeStore';

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

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--bg-base))]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
