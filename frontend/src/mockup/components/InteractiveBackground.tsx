import React, { useEffect, useRef } from 'react';

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
      targetPos.current.x = e.clientX;
      targetPos.current.y = e.clientY;

      if (!isRunning.current) {
        isRunning.current = true;
        animFrameId.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  const isLanding = mode === 'landing';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000 z-0 ${
        isLanding ? 'opacity-100' : 'opacity-35'
      }`}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.14] dark:opacity-[0.22]"
        style={{
          maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 50%, transparent 100%)',
        }}
      />

      <div className="absolute top-[-12%] left-[-8%] w-[60vw] h-[60vw] max-w-[760px] max-h-[760px] rounded-full bg-gradient-to-tr from-indigo-500/25 via-violet-500/22 to-cyan-400/20 dark:from-indigo-600/35 dark:via-purple-600/30 dark:to-cyan-500/25 blur-[120px] animate-aurora-slow mix-blend-multiply dark:mix-blend-screen" />

      <div className="absolute top-[18%] right-[-12%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-bl from-cyan-400/20 via-sky-500/18 to-emerald-400/20 dark:from-cyan-500/30 dark:via-blue-600/25 dark:to-emerald-500/22 blur-[130px] animate-aurora-reverse mix-blend-multiply dark:mix-blend-screen" />

      <div className="absolute bottom-[-18%] left-[18%] w-[65vw] h-[65vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-t from-purple-500/18 via-indigo-500/18 to-rose-400/15 dark:from-purple-900/35 dark:via-indigo-900/30 dark:to-pink-900/20 blur-[140px] animate-aurora-slow mix-blend-multiply dark:mix-blend-screen" />

      <div
        ref={spotlightRef}
        className="absolute top-0 left-0 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{
          transform: 'translate3d(-1000px, -1000px, 0)',
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(139, 92, 246, 0.16) 30%, rgba(6, 182, 212, 0.08) 55%, transparent 72%)',
          willChange: 'transform',
        }}
      />
    </div>
  );
};
