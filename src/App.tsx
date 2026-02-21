import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import AppLayout from '@/components/layout/AppLayout';

const Home = lazy(() => import('@/pages/Home'));
const Practice = lazy(() => import('@/pages/Practice'));
const ChordLibrary = lazy(() => import('@/pages/ChordLibrary'));

function LoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center stage-gradient">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent animate-spin" />
        <span className="text-sm font-body text-[hsl(var(--text-muted))]">Loading...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/library" element={<ChordLibrary />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
