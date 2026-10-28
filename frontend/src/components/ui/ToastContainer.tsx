import React, { useContext, useEffect, useRef } from 'react';
import { DEFAULT_TOAST_POSITION, useToastStore, type ToastPosition } from '../../stores/toastStore';
import { ToastItem } from './ToastItem';
import { PreloaderContext } from '../common/PreloaderContext';
import { isMotionEnabled } from '../../services/motionPreference';

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-20 right-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-end',
  'top-center': 'top-20 left-1/2 -translate-x-1/2 items-center w-full max-w-sm px-4',
  'top-left': 'top-20 left-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-start',
  'bottom-right': 'toast-placement-bottom-right',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center w-full max-w-sm px-4',
  'bottom-left': 'bottom-4 left-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-start',
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const preloader = useContext(PreloaderContext);
  const isBlocked = preloader ? preloader.isOverlayVisible : false;
  const wasBlockedRef = useRef(isBlocked);

  useEffect(() => {
    if (isBlocked) {
      toasts.forEach((t) => {
        useToastStore.getState().pauseToast(t.id);
      });
    } else if (wasBlockedRef.current && !isBlocked) {
      const currentToasts = useToastStore.getState().toasts;
      if (currentToasts.length > 3) {
        const excess = currentToasts.slice(0, currentToasts.length - 3);
        excess.forEach((t) => useToastStore.getState().removeToast(t.id));
      }
      useToastStore.getState().toasts.forEach((t) => {
        useToastStore.getState().resumeToast(t.id);
      });
    }
    wasBlockedRef.current = isBlocked;
  }, [isBlocked, toasts]);

  if (isBlocked || toasts.length === 0) return null;

  const groupedToasts = toasts.reduce<Record<ToastPosition, typeof toasts>>((acc, toast) => {
    const pos = toast.position || DEFAULT_TOAST_POSITION;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(toast);
    return acc;
  }, {} as Record<ToastPosition, typeof toasts>);

  const motionActive = isMotionEnabled();

  return (
    <>
      {(Object.entries(groupedToasts) as [ToastPosition, typeof toasts][]).map(
        ([position, items]) => (
          <div
            key={position}
            data-toast-position={position}
            className={`fixed z-[9999] pointer-events-none flex flex-col gap-2.5 ${positionClasses[position]}`}
          >
            {items.map((item, index) => (
              <ToastItem
                key={item.id}
                toast={item}
                style={{
                  animationDelay: motionActive ? `${index * 80}ms` : undefined,
                }}
              />
            ))}
          </div>
        )
      )}
    </>
  );
};
