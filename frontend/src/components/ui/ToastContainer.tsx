import React from 'react';
import { useToastStore, type ToastPosition } from '../../stores/toastStore';
import { ToastItem } from './ToastItem';

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-end',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center w-full max-w-sm px-4',
  'top-left': 'top-4 left-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-start',
  'bottom-right': 'bottom-4 right-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-end',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center w-full max-w-sm px-4',
  'bottom-left': 'bottom-4 left-4 max-sm:left-4 max-sm:right-4 max-sm:items-center items-start',
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  const groupedToasts = toasts.reduce<Record<ToastPosition, typeof toasts>>((acc, toast) => {
    const pos = toast.position || 'top-right';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(toast);
    return acc;
  }, {} as Record<ToastPosition, typeof toasts>);

  return (
    <>
      {(Object.entries(groupedToasts) as [ToastPosition, typeof toasts][]).map(
        ([position, items]) => (
          <div
            key={position}
            className={`fixed z-[9999] pointer-events-none flex flex-col gap-2.5 ${positionClasses[position]}`}
          >
            {items.map((item) => (
              <ToastItem key={item.id} toast={item} />
            ))}
          </div>
        )
      )}
    </>
  );
};
