import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './mockup/components/Navbar';
import { Footer } from './mockup/components/Footer';
import { InteractiveBackground } from './mockup/components/InteractiveBackground';

const LandingPage = lazy(() =>
  import('./routes/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const RoomPage = lazy(() =>
  import('./routes/RoomPage').then((m) => ({ default: m.RoomPage }))
);

function AppContent({
  isDarkMode,
  onToggleDarkMode,
}: {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onLogoClick={() => {
          window.location.href = '/';
        }}
      />

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/rooms/:slug" element={<RoomPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {isLanding && <Footer />}
    </div>
  );
}

export function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eventchat_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('eventchat_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('eventchat_theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative selection:bg-indigo-500 selection:text-white flex flex-col">
        <InteractiveBackground mode="landing" />
        <AppContent
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      </div>
    </BrowserRouter>
  );
}
