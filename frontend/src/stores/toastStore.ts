import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition =
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left';

export interface ToastAction {
  label: string;
  onClick: (dismiss: () => void) => void;
  variant?: 'primary' | 'secondary';
}

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  position?: ToastPosition;
  onDismiss?: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
  dismissible: boolean;
  position: ToastPosition;
  onDismiss?: () => void;
  createdAt: number;
}

interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout>;
  startedAt: number;
  remaining: number;
}

const MAX_TOASTS = 4;
const timers = new Map<string, ToastTimer>();

function getDefaultDuration(type: ToastType): number {
  switch (type) {
    case 'loading':
      return 0;
    case 'error':
    case 'warning':
      return 6000;
    case 'success':
    case 'info':
    default:
      return 4000;
  }
}

function generateId(): string {
  return 'toast_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (options: ToastOptions | string) => string;
  updateToast: (id: string, updates: Partial<ToastOptions>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (options) => {
    const rawOptions: ToastOptions =
      typeof options === 'string' ? { title: options } : options;

    const id = rawOptions.id || generateId();
    const type: ToastType = rawOptions.type || 'info';
    const duration = rawOptions.duration !== undefined ? rawOptions.duration : getDefaultDuration(type);
    const position: ToastPosition = rawOptions.position || 'top-right';
    const dismissible = rawOptions.dismissible !== false;

    const existingTimer = timers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer.timeoutId);
      timers.delete(id);
    }

    const newItem: ToastItem = {
      id,
      title: rawOptions.title,
      description: rawOptions.description,
      type,
      duration,
      action: rawOptions.action,
      dismissible,
      position,
      onDismiss: rawOptions.onDismiss,
      createdAt: Date.now(),
    };

    set((state) => {
      const existingIndex = state.toasts.findIndex((t) => t.id === id);
      if (existingIndex !== -1) {
        const updated = [...state.toasts];
        updated[existingIndex] = newItem;
        return { toasts: updated };
      }

      let currentToasts = [...state.toasts];
      if (currentToasts.length >= MAX_TOASTS) {
        const discarded = currentToasts.shift();
        if (discarded) {
          const t = timers.get(discarded.id);
          if (t) {
            clearTimeout(t.timeoutId);
            timers.delete(discarded.id);
          }
          discarded.onDismiss?.();
        }
      }

      return { toasts: [...currentToasts, newItem] };
    });

    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        get().removeToast(id);
      }, duration);
      timers.set(id, {
        timeoutId,
        startedAt: Date.now(),
        remaining: duration,
      });
    }

    return id;
  },

  updateToast: (id, updates) => {
    set((state) => {
      const index = state.toasts.findIndex((t) => t.id === id);
      if (index === -1) return state;

      const current = state.toasts[index];
      const updatedType = updates.type || current.type;
      const updatedDuration =
        updates.duration !== undefined
          ? updates.duration
          : updates.type && updates.type !== current.type
          ? getDefaultDuration(updatedType)
          : current.duration;

      const updatedItem: ToastItem = {
        ...current,
        ...updates,
        type: updatedType,
        duration: updatedDuration,
      };

      const existingTimer = timers.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer.timeoutId);
        timers.delete(id);
      }

      if (updatedDuration > 0) {
        const timeoutId = setTimeout(() => {
          get().removeToast(id);
        }, updatedDuration);
        timers.set(id, {
          timeoutId,
          startedAt: Date.now(),
          remaining: updatedDuration,
        });
      }

      const newToasts = [...state.toasts];
      newToasts[index] = updatedItem;
      return { toasts: newToasts };
    });
  },

  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timers.delete(id);
    }

    const toast = get().toasts.find((t) => t.id === id);
    if (toast?.onDismiss) {
      try {
        toast.onDismiss();
      } catch (e) {
        console.error('Error in onDismiss callback of toast', e);
      }
    }

    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    timers.forEach((t) => clearTimeout(t.timeoutId));
    timers.clear();
    get().toasts.forEach((t) => t.onDismiss?.());
    set({ toasts: [] });
  },

  pauseToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      const elapsed = Date.now() - timer.startedAt;
      timer.remaining = Math.max(0, timer.remaining - elapsed);
    }
  },

  resumeToast: (id) => {
    const timer = timers.get(id);
    if (timer && timer.remaining > 0) {
      timer.startedAt = Date.now();
      timer.timeoutId = setTimeout(() => {
        get().removeToast(id);
      }, timer.remaining);
    }
  },
}));

type ToastFn = (message: string | ToastOptions, options?: Partial<ToastOptions>) => string;

const createToastMethod = (type: ToastType): ToastFn => {
  return (message, options) => {
    const baseOptions: ToastOptions =
      typeof message === 'string'
        ? { title: message, ...options, type }
        : { ...message, ...options, type };
    return useToastStore.getState().addToast(baseOptions);
  };
};

export const toast = Object.assign(
  (message: string | ToastOptions, options?: Partial<ToastOptions>) => {
    const baseOptions: ToastOptions =
      typeof message === 'string' ? { title: message, ...options } : { ...message, ...options };
    return useToastStore.getState().addToast(baseOptions);
  },
  {
    success: createToastMethod('success'),
    error: createToastMethod('error'),
    warning: createToastMethod('warning'),
    info: createToastMethod('info'),
    loading: createToastMethod('loading'),
    dismiss: (id?: string) => {
      if (id) {
        useToastStore.getState().removeToast(id);
      } else {
        useToastStore.getState().clearToasts();
      }
    },
    promise: async <T>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: unknown) => string);
      },
      options?: Partial<ToastOptions>
    ): Promise<T> => {
      const id = useToastStore.getState().addToast({
        title: messages.loading,
        type: 'loading',
        duration: 0,
        ...options,
      });

      try {
        const result = await promise;
        const successMsg =
          typeof messages.success === 'function' ? messages.success(result) : messages.success;
        useToastStore.getState().updateToast(id, {
          title: successMsg,
          type: 'success',
          duration: options?.duration ?? 4000,
        });
        return result;
      } catch (err) {
        const errorMsg =
          typeof messages.error === 'function' ? messages.error(err) : messages.error;
        useToastStore.getState().updateToast(id, {
          title: errorMsg,
          type: 'error',
          duration: options?.duration ?? 6000,
        });
        throw err;
      }
    },
  }
);
