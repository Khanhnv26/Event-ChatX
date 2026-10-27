import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Preloader } from './Preloader';

interface PreloaderContextType {
  showPreloader: (durationMs?: number) => void;
  hidePreloader: () => void;
  isPreloading: boolean;
}

const PreloaderContext = createContext<PreloaderContextType | undefined>(undefined);

export const PreloaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initial app load: runs for 1600ms so user can comfortably appreciate the animation
  const [isPreloading, setIsPreloading] = useState(true);
  const [duration, setDuration] = useState(1600);

  useEffect(() => {
    // Dismiss inline HTML splash smoothly
    const inlineSplash = document.getElementById('initial-splash');
    if (inlineSplash) {
      inlineSplash.remove();
    }

    const timer = setTimeout(() => {
      setIsPreloading(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, []);

  const showPreloader = useCallback((customDurationMs = 1200) => {
    setDuration(customDurationMs);
    setIsPreloading(true);
    const timer = setTimeout(() => {
      setIsPreloading(false);
    }, customDurationMs);
    return () => clearTimeout(timer);
  }, []);

  const hidePreloader = useCallback(() => {
    setIsPreloading(false);
  }, []);

  return (
    <PreloaderContext.Provider value={{ showPreloader, hidePreloader, isPreloading }}>
      {children}
      <Preloader
        isLoading={isPreloading}
        minDuration={duration}
        onFinished={() => {}}
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
