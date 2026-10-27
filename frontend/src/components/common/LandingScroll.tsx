import { useEffect } from 'react';
import type Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { isMotionEnabled, MOTION_CHANGE_EVENT } from '../../services/motionPreference';

export function LandingScroll({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    let disposed = false;
    let request = 0;
    let scroll: Lenis | undefined;
    const update = async () => {
      const currentRequest = ++request;
      scroll?.destroy();
      scroll = undefined;
      if (!media.matches || !isMotionEnabled() || document.hidden) return;
      try {
        const { default: Lenis } = await import('lenis');
        if (disposed || currentRequest !== request || !media.matches || !isMotionEnabled() || document.hidden) return;
        scroll = new Lenis({ autoRaf: true, lerp: 0.12, smoothWheel: true, syncTouch: false,
          anchors: true, respectReducedMotion: false,
          prevent: node => Boolean(node.closest('[role="dialog"], [data-native-scroll]')) });
      } catch {
      }
    };
    void update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener(MOTION_CHANGE_EVENT, update);
    return () => {
      disposed = true;
      ++request;
      scroll?.destroy();
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener(MOTION_CHANGE_EVENT, update);
    };
  }, [enabled]);
  return null;
}
