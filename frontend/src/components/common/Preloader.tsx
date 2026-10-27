import React, { useEffect, useState, useRef } from 'react';
import { MessageSquareCode } from 'lucide-react';

export interface PreloaderProps {
  isLoading?: boolean;
  minDuration?: number;
  onFinished?: () => void;
  fullScreen?: boolean;
}

export const Preloader: React.FC<PreloaderProps> = ({
  isLoading = true,
  minDuration = 1500,
  onFinished,
  fullScreen = true,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isRendered, setIsRendered] = useState(isLoading);
  const mountTime = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    if (isLoading) {
      mountTime.current = Date.now();
      setIsRendered(true);
      setIsExiting(false);
      return;
    }

    const triggerExit = () => {
      setIsExiting(true);
      cleanupTimer = setTimeout(() => {
        setIsRendered(false);
        if (onFinished) onFinished();
      }, 300);
    };

    if (!isLoading) {
      const elapsed = Date.now() - mountTime.current;
      const remaining = Math.max(0, minDuration - elapsed);
      timer = setTimeout(triggerExit, remaining);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, [isLoading, minDuration, onFinished]);

  if (!isRendered) return null;

  const containerPosition = fullScreen ? 'fixed inset-0 z-[100]' : 'absolute inset-0 z-30';

  const transitionClasses = isExiting
    ? 'opacity-0 pointer-events-none transition-opacity duration-300'
    : 'opacity-100 scale-100 transition-opacity duration-200';

  return (
    <div
      role="status"
      aria-label="Đang tải"
      data-native-scroll
      className={`${containerPosition} flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 select-none ${transitionClasses}`}
    >
      <div className="relative flex items-center justify-center mb-3">
        <div className="absolute w-24 h-24 rounded-full bg-indigo-500/20 dark:bg-indigo-600/30 blur-xl animate-pulse" />

        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/35 animate-float-gentle">
          <MessageSquareCode className="w-8 h-8 drop-shadow-sm" />
        </div>
      </div>

      <h2 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight mb-0.5">
        EventChat
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
        Bàn nhanh. Chốt rõ.
      </p>

      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50 animate-chat-dot-1" />
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50 animate-chat-dot-2" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-chat-dot-3" />
      </div>
    </div>
  );
};
