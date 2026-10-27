export const MOTION_CHANGE_EVENT = 'eventchat:motion-change';

export function isMotionEnabled(): boolean {
  const preference = document.documentElement.dataset.motion;
  if (preference === 'full') return true;
  if (preference === 'reduced') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
