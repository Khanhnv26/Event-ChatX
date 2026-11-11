import { useEffect, useId, useRef, useState } from 'react';
import { AtSign, Bell, ChartNoAxesColumn, CheckCheck, CircleCheck, MessageSquare, MessagesSquare, Pin, Volume2, VolumeX, X } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';
import type { RoomNotification } from '../../types/roomNotification';

const ICONS = { message: MessageSquare, thread: MessagesSquare, poll: ChartNoAxesColumn, pin: Pin, decision: CircleCheck, mention: AtSign };
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

interface RoomNotificationMenuProps {
  entries: RoomNotification[];
  soundEnabled: boolean;
  changeSound: (enabled: boolean) => Promise<boolean>;
  previewSound: () => Promise<boolean>;
  readAll: () => void;
  onSelect: (entry: RoomNotification) => void;
}

export function RoomNotificationMenu({ entries, soundEnabled, changeSound, previewSound, readAll, onSelect }: RoomNotificationMenuProps) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const unread = entries.filter(entry => !entry.read).length;
  const visible = unreadOnly ? entries.filter(entry => !entry.read) : entries;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const change = () => setMobile(media.matches);
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);

  useEffect(() => {
    if (!open || mobile) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !anchor.current?.contains(document.activeElement)) return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [mobile, open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  const panel = (
    <section id={id} role={mobile ? 'dialog' : 'region'} aria-modal={mobile || undefined} aria-labelledby={`${id}-title`}
      className={mobile
        ? 'motion-sheet flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-foreground shadow-2xl'
        : 'absolute right-0 top-full z-50 mt-2 flex max-h-[min(34rem,calc(100dvh-5.5rem))] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-xl'}>
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div>
          <h2 id={`${id}-title`} className="text-sm font-bold">Thông báo</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">{unread ? `${unread} chưa đọc` : 'Đã đọc hết'}</p>
        </div>
        <button type="button" onClick={close} aria-label="Đóng thông báo" className="ws-icon-btn inline-flex min-h-10 items-center px-2">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 pb-2">
        <div className="flex items-center gap-1" role="group" aria-label="Lọc thông báo">
          {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={unreadOnly === value}
            onClick={() => setUnreadOnly(value)} className="ws-chip min-h-9 aria-pressed:bg-primary-soft aria-pressed:text-primary-text">
            {value ? 'Chưa đọc' : 'Tất cả'}
          </button>)}
        </div>
        <button type="button" onClick={readAll} disabled={!unread} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary-text hover:underline disabled:opacity-40">
          <CheckCheck aria-hidden="true" className="size-4" />Đọc tất cả
        </button>
      </div>
      <div data-native-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visible.length ? <ul className="divide-y divide-border">
          {visible.map(entry => {
            const Icon = ICONS[entry.kind];
            return <li key={entry.id}>
              <button type="button" onClick={() => { close(); onSelect(entry); }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-card-muted ${entry.read ? '' : 'bg-primary-soft/45'}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text"><Icon aria-hidden="true" className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-semibold">{entry.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{entry.detail}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <time dateTime={new Date(entry.receivedAt).toISOString()}>{timeFormat.format(entry.receivedAt)}</time>
                  {!entry.read && <><span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /><span className="sr-only">Chưa đọc</span></>}
                </span>
              </button>
            </li>;
          })}
        </ul> : <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {unreadOnly ? 'Không còn thông báo chưa đọc.' : 'Chưa có thông báo trong phòng.'}
        </p>}
      </div>
      <footer className="shrink-0 border-t border-border bg-card-muted/40 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" role="switch" aria-checked={soundEnabled} aria-label="Âm báo"
            onClick={async () => setSoundError(!(await changeSound(!soundEnabled)))}
            className="ws-chip min-h-9 aria-checked:bg-primary-soft aria-checked:text-primary-text">
            {soundEnabled ? <Volume2 aria-hidden="true" className="size-4" /> : <VolumeX aria-hidden="true" className="size-4" />}
            Âm báo · {soundEnabled ? 'Bật' : 'Tắt'}
          </button>
          <button type="button" onClick={async () => setSoundError(!(await previewSound()))} className="min-h-9 text-xs font-semibold text-primary-text hover:underline">Nghe thử</button>
        </div>
        {soundError && <p role="status" className="mt-1 text-xs text-muted-foreground">Trình duyệt chưa phát được âm báo.</p>}
      </footer>
    </section>
  );

  return <div ref={anchor} className="relative">
    <button ref={trigger} type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
      aria-controls={open ? id : undefined} aria-haspopup={mobile ? 'dialog' : undefined}
      aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} title="Thông báo"
      className="ws-icon-btn relative inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-primary-text aria-expanded:bg-primary-soft">
      <Bell aria-hidden="true" className="size-4" />
      {unread > 0 && <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full border border-card bg-primary px-0.5 text-center text-[10px] font-bold leading-4 text-white">{unread}</span>}
    </button>
    {open && (mobile ? <ModalPortal onClose={close}>
      <div className="motion-overlay fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60">{panel}</div>
    </ModalPortal> : panel)}
  </div>;
}
