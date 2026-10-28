export const MOTION_CHANGE_EVENT = 'eventchat:motion-change';

export function isMotionEnabled(): boolean {
  if (typeof document !== 'undefined') {
    const preference = document.documentElement.dataset.motion;
    if (preference === 'full') return true;
    if (preference === 'reduced') return false;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
