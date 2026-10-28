import { memo, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import type { RoomStatus } from '../types';

export const RoomCountdown = memo(function RoomCountdown({ expiresAt, createdAt, roomStatus, onExpired }: {
  expiresAt?: string | null; createdAt?: string | null; roomStatus: RoomStatus; onExpired?: () => void;
}) {
  const end = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const start = createdAt ? new Date(createdAt).getTime() : end - 86400000;
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);
  const remaining = roomStatus === 'ACTIVE' ? Math.max(0, end - now) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const progress = Number.isFinite(remaining) ? Math.min(1, remaining / Math.max(1, end - start)) : 0;
  const formatted = Number.isFinite(seconds) ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':') : '--:--:--';

  useEffect(() => {
    notified.current = false;
    if (!Number.isFinite(end) || roomStatus !== 'ACTIVE') return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      const time = Date.now();
      setNow(time);
      if (time >= end && !notified.current) {
        notified.current = true;
        if (timer) clearInterval(timer);
        onExpired?.();
      }
    };
    const resume = () => {
      if (timer) clearInterval(timer);
      if (document.hidden) return;
      update();
      if (Date.now() < end) timer = setInterval(update, 1000);
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [end, roomStatus, onExpired]);

  return <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 space-y-1.5 shadow-xs">
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-amber-500" /><span>Thời gian phòng còn lại</span>
      </span>
      <time className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm tabular-nums">{formatted}</time>
    </div>
    <div className="w-full bg-slate-200/70 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full origin-left transition-transform duration-500"
        style={{ transform: `scaleX(${progress})` }} />
    </div>
    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">Phòng hết hạn chuyển sang chỉ đọc; dữ liệu được dọn sau 7 ngày.</p>
  </div>;
});
