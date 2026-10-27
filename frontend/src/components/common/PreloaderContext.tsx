import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Preloader } from './Preloader';

interface PreloaderContextType {
  showPreloader: (durationMs?: number) => void;
  hidePreloader: () => void;
  beginLoading: () => () => void;
  isPreloading: boolean;
}

const PreloaderContext = createContext<PreloaderContextType | undefined>(undefined);

export const PreloaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [startupLoading, setStartupLoading] = useState(true);
  const [manualLoading, setManualLoading] = useState(false);
  const [activeLoads, setActiveLoads] = useState(0);
  const isPreloading = startupLoading || manualLoading || activeLoads > 0;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const inlineSplash = document.getElementById('initial-splash');
    if (inlineSplash) {
      inlineSplash.remove();
    }

    const startupTimer = setTimeout(() => setStartupLoading(false), 1500);
    return () => {
      clearTimeout(startupTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isPreloading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isPreloading]);

  const showPreloader = useCallback((customDurationMs?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setManualLoading(true);
    if (customDurationMs !== undefined) {
      timerRef.current = setTimeout(() => setManualLoading(false), customDurationMs);
    }
  }, []);

  const hidePreloader = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setManualLoading(false);
  }, []);
  const beginLoading = useCallback(() => {
    setActiveLoads(count => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setActiveLoads(count => Math.max(0, count - 1));
    };
  }, []);
  const value = useMemo(() => ({ showPreloader, hidePreloader, beginLoading, isPreloading }), [showPreloader, hidePreloader, beginLoading, isPreloading]);

  return (
    <PreloaderContext.Provider value={value}>
      <div inert={isPreloading}>{children}</div>
      <Preloader
        isLoading={isPreloading}
        minDuration={1500}
        fullScreen={true}
      />
    </PreloaderContext.Provider>
  );
};

export const usePreloader = (): PreloaderContextType => {
  const context = useContext(PreloaderContext);
  if (!context) {
    throw new Error('usePreloader must be used within a PreloaderProvider');
  }
  return context;
};

export function useLoadingOverlay(loading: boolean) {
  const { beginLoading } = usePreloader();
  useEffect(() => {
    if (loading) return beginLoading();
  }, [loading, beginLoading]);
}

export function RouteLoadingFallback() {
  useLoadingOverlay(true);
  return null;
}
