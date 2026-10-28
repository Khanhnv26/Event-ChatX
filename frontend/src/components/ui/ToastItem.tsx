import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { type ToastItem as ToastItemType, useToastStore } from '../../stores/toastStore';

interface ToastItemProps {
  toast: ToastItemType;
  style?: React.CSSProperties;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, style }) => {
  const { removeToast, pauseToast, resumeToast } = useToastStore();
  const [isClosing, setIsClosing] = useState(false);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 180);
  };

  const icons = {
    success: (
      <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
        <CheckCircle2 className="w-5 h-5" />
      </div>
    ),
    error: (
      <div className="shrink-0 w-8 h-8 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
        <AlertCircle className="w-5 h-5" />
      </div>
    ),
    warning: (
      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    info: (
      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
        <Info className="w-5 h-5" />
      </div>
    ),
    loading: (
      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    ),
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => pauseToast(toast.id)}
      onMouseLeave={() => resumeToast(toast.id)}
      style={style}
      className={`
        pointer-events-auto w-full max-w-sm rounded-2xl p-3.5
        bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
        border border-slate-200/80 dark:border-slate-800/80
        shadow-xl shadow-slate-900/10 dark:shadow-black/50
        flex items-start gap-3 transition-all duration-200
        ${isClosing ? 'toast-animate-out' : 'toast-animate-in'}
      `}
    >
      {icons[toast.type]}

      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && (
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
            {toast.title}
          </p>
        )}
        {toast.description && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
            {toast.description}
          </p>
        )}

        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick(() => handleDismiss());
            }}
            className="mt-2.5 inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng thông báo"
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
