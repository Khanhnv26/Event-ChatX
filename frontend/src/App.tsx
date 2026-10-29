import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { InteractiveBackground } from './components/layout/InteractiveBackground';
import { PreloaderProvider, RouteLoadingFallback } from './components/common/PreloaderContext';
import { LandingScroll } from './components/common/LandingScroll';
import { MOTION_CHANGE_EVENT } from './services/motionPreference';
import { ToastContainer } from './components/ui/ToastContainer';

const LandingPage = lazy(() =>
  import('./routes/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const RoomPage = lazy(() =>
  import('./routes/RoomPage').then((m) => ({ default: m.RoomPage }))
);

function AppContent({
  isDarkMode,
  onToggleDarkMode,
  motionEnabled,
  onToggleMotion,
}: {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  motionEnabled: boolean;
  onToggleMotion: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  return (
    <div className="relative z-10 flex flex-col min-h-dvh">
      <InteractiveBackground mode={isLanding ? 'landing' : 'workspace'} />
      <LandingScroll enabled={isLanding} />
      <Navbar
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        motionEnabled={motionEnabled}
        onToggleMotion={onToggleMotion}
        onLogoClick={() => {
          navigate('/');
        }}
      />

      <main className="flex-1">
        <Suspense
          fallback={<RouteLoadingFallback />}
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
  const [motionPreference, setMotionPreference] = useState<'system' | 'full' | 'reduced'>(() => {
    const saved = localStorage.getItem('eventchat_motion');
    return saved === 'full' || saved === 'reduced' ? saved : 'system';
  });
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionEnabled = motionPreference === 'full' || (motionPreference === 'system' && !systemReduced);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== 'eventchat_motion') return;
      const saved = event.newValue;
      setMotionPreference(saved === 'full' || saved === 'reduced' ? saved : 'system');
    };
    media.addEventListener('change', update);
    window.addEventListener('storage', syncPreference);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', syncPreference);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'full' : 'reduced';
    if (motionPreference !== 'system') localStorage.setItem('eventchat_motion', motionPreference);
    window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
  }, [motionEnabled, motionPreference]);
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
      <PreloaderProvider>
        <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative selection:bg-indigo-500 selection:text-white flex flex-col">
          <AppContent
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            motionEnabled={motionEnabled}
            onToggleMotion={() => setMotionPreference(motionEnabled ? 'reduced' : 'full')}
          />
          <ToastContainer />
        </div>
      </PreloaderProvider>
    </BrowserRouter>
  );
}
