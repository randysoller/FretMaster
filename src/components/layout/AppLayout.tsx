import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--bg-base))]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
