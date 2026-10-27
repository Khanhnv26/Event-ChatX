import { useEffect, type RefObject } from 'react';
import { isMotionEnabled, MOTION_CHANGE_EVENT } from '../services/motionPreference';

// Pointer animation updates only its decorative elements, never React form state.
export function usePointerParallax(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax-x]'));
    let frame = 0;
    let previousTime = 0;
    let visible = true;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };
    const animate = (time: number) => {
      const alpha = 1 - Math.exp(-Math.min(previousTime ? time - previousTime : 16, 64) / 110);
      previousTime = time;
      currentX += (targetX - currentX) * alpha;
      currentY += (targetY - currentY) * alpha;
      for (const element of targets) {
        const x = currentX * Number(element.dataset.parallaxX);
        const y = currentY * Number(element.dataset.parallaxY);
        element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
      frame = 0;
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.05) {
        frame = requestAnimationFrame(animate);
      } else {
        previousTime = 0;
      }
    };
    const move = (event: PointerEvent) => {
      if (!media.matches || !isMotionEnabled() || !visible || document.hidden || event.pointerType === 'touch') return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 44;
      targetY = (event.clientY / window.innerHeight - 0.5) * 44;
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const reset = () => {
      stop();
      currentX = currentY = targetX = targetY = 0;
      for (const element of targets) element.style.removeProperty('transform');
    };
    const onVisibilityChange = () => { if (document.hidden) reset(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) reset();
    });
    observer?.observe(root);
    window.addEventListener('pointermove', move, { passive: true });
    media.addEventListener('change', reset);
    window.addEventListener(MOTION_CHANGE_EVENT, reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      reset();
      observer?.disconnect();
      window.removeEventListener('pointermove', move);
      media.removeEventListener('change', reset);
      window.removeEventListener(MOTION_CHANGE_EVENT, reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [rootRef]);
}
