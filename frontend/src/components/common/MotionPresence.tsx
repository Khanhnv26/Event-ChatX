import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { isMotionEnabled } from '../../services/motionPreference';
import { MotionPresenceContext } from './motionPresenceContext';

export function MotionPresence({ open, children, duration = 280 }: {
  open: boolean; children: ReactNode; duration?: number;
}) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const reduced = !isMotionEnabled();
    const timer = setTimeout(() => setPresent(false), reduced ? 0 : duration);
    return () => clearTimeout(timer);
  }, [open, present, duration]);

  if (!open && !present) return null;
  return <MotionPresenceContext.Provider value={{ open, duration }}><div className="motion-presence" data-state={open ? 'open' : 'closed'}
    inert={!open} aria-hidden={!open || undefined}
    style={{ '--presence-duration': `${duration}ms` } as CSSProperties}>{children}</div></MotionPresenceContext.Provider>;
}
