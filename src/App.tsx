import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import AppLayout from '@/components/layout/AppLayout';

const PracticeLanding = lazy(() => import('@/pages/PracticeLanding'));
const Home = lazy(() => import('@/pages/Home'));
const Practice = lazy(() => import('@/pages/Practice'));
const ChordLibrary = lazy(() => import('@/pages/ChordLibrary'));
const ChordEditor = lazy(() => import('@/pages/ChordEditor'));
const ProgressionPractice = lazy(() => import('@/pages/ProgressionPractice'));


function LoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-58px)] items-center justify-center stage-gradient">
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
            <Route path="/" element={<PracticeLanding />} />
            <Route path="/chord-practice" element={<Home />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/library" element={<ChordLibrary />} />
            <Route path="/editor" element={<ChordEditor />} />
            <Route path="/progressions" element={<ProgressionPractice />} />

            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
