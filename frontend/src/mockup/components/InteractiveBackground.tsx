import React, { useEffect, useRef } from 'react';
import { isMotionEnabled, MOTION_CHANGE_EVENT } from '../../services/motionPreference';

interface InteractiveBackgroundProps {
  mode: 'landing' | 'workspace';
}

export const InteractiveBackground: React.FC<InteractiveBackgroundProps> = ({ mode }) => {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const currentPos = useRef({ x: -1000, y: -1000 });
  const targetPos = useRef({ x: -1000, y: -1000 });
  const isRunning = useRef(false);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const spotlightEl = spotlightRef.current;
    if (!spotlightEl) return;
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');

    const animate = () => {
      const dx = targetPos.current.x - currentPos.current.x;
      const dy = targetPos.current.y - currentPos.current.y;

      if (currentPos.current.x < 0) {
        currentPos.current.x = targetPos.current.x;
        currentPos.current.y = targetPos.current.y;
      } else {
        currentPos.current.x += dx * 0.085;
        currentPos.current.y += dy * 0.085;
      }

      spotlightEl.style.transform = `translate3d(${currentPos.current.x - 320}px, ${currentPos.current.y - 320}px, 0)`;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        animFrameId.current = requestAnimationFrame(animate);
      } else {
        isRunning.current = false;
        animFrameId.current = null;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!media.matches || !isMotionEnabled() || document.hidden || e.pointerType === 'touch') return;
      spotlightEl.style.opacity = '1';
      targetPos.current.x = e.clientX;
      targetPos.current.y = e.clientY;

      if (!isRunning.current) {
        isRunning.current = true;
        animFrameId.current = requestAnimationFrame(animate);
      }
    };
    const reset = () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
      isRunning.current = false;
      spotlightEl.style.opacity = '0';
    };
    const onVisibilityChange = () => { if (document.hidden) reset(); };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    media.addEventListener('change', reset);
    window.addEventListener(MOTION_CHANGE_EVENT, reset);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      media.removeEventListener('change', reset);
      window.removeEventListener(MOTION_CHANGE_EVENT, reset);
      reset();
    };
  }, [mode]);

  const isLanding = mode === 'landing';

  return (
    <div
      aria-hidden="true"
      className={`ambient-background fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-300 -z-10 ${
        isLanding ? 'opacity-100' : 'opacity-70'
      }`}
      data-mode={mode}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.14] dark:opacity-[0.22]"
        style={{
          maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 50%, transparent 100%)',
        }}
      />

      <div className="ambient-orb ambient-orb-indigo" />
      <div className="ambient-orb ambient-orb-cyan" />
      <div className="ambient-orb ambient-orb-violet" />

      <div
        ref={spotlightRef}
        className="ambient-spotlight absolute top-0 left-0 w-[640px] h-[640px] rounded-full pointer-events-none transition-opacity duration-500"
        style={{
          transform: 'translate3d(-1000px, -1000px, 0)',
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(139, 92, 246, 0.16) 30%, rgba(6, 182, 212, 0.08) 55%, transparent 72%)',
          willChange: 'transform',
          opacity: 0,
        }}
      />
    </div>
  );
};
