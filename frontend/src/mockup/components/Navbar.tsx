import React from 'react';
import { MessageSquareCode, Moon, Sun, Monitor, Disc, FileText } from 'lucide-react';

interface NavbarProps {
  currentView?: 'LANDING' | 'ROOM' | 'WHEEL' | 'EXPORT';
  setCurrentView?: (view: 'LANDING' | 'ROOM' | 'WHEEL' | 'EXPORT') => void;
  isDarkMode: boolean;
  setIsDarkMode?: (val: boolean) => void;
  onToggleDarkMode?: () => void;
  onLogoClick?: () => void;
  roomStatus?: 'ACTIVE' | 'CLOSED';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'LANDING',
  setCurrentView,
  isDarkMode,
  setIsDarkMode,
  onToggleDarkMode,
  onLogoClick,
  roomStatus = 'ACTIVE',
}) => {
  const toggleTheme = () => {
    if (onToggleDarkMode) onToggleDarkMode();
    else if (setIsDarkMode) setIsDarkMode(!isDarkMode);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => {
            if (onLogoClick) onLogoClick();
            else if (setCurrentView) setCurrentView('LANDING');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <MessageSquareCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                EventChat
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Bàn nhanh. Chốt rõ. Chia sẻ ngay.
            </p>
          </div>
        </div>

        {/* View Switcher Controls */}
        {setCurrentView && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium">
            <button
              onClick={() => setCurrentView('LANDING')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                currentView === 'LANDING'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Trang chủ</span>
            </button>

            <button
              onClick={() => setCurrentView('ROOM')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                currentView === 'ROOM'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {roomStatus === 'ACTIVE' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    roomStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                ></span>
              </span>
              <span>Workspace</span>
            </button>

            <button
              onClick={() => setCurrentView('WHEEL')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                currentView === 'WHEEL'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Vòng quay</span>
            </button>

            <button
              onClick={() => setCurrentView('EXPORT')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                currentView === 'EXPORT'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Biên bản</span>
            </button>
          </div>
        )}

        {/* Right tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={isDarkMode ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
