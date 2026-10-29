import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, CornerDownRight, MessageSquare } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';
import { ChatMessageList } from './ChatMessageList';
import { MessageAttachments } from '../attachments/MessageAttachments';
import type { ChatMessage, RoomStatus } from '../../types/room';

export interface ThreadDrawerProps {
  root: ChatMessage;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  roomStatus: RoomStatus;
  roomCode: string;
  embedded?: boolean;
  draft?: string;
  onDraftChange?: (text: string) => void;
  onClose: () => void;
  onShowList?: () => void;
  onReload: () => Promise<void>;
  onSend: (text: string) => Promise<boolean>;
}

export function ThreadDrawer({ root, messages, loading, sending, error, roomStatus, roomCode,
  embedded = false, draft, onDraftChange, onClose, onShowList, onReload, onSend }: ThreadDrawerProps) {
  const [localText, setLocalText] = useState('');
  const text = draft ?? localText;
  const changeText = (value: string) => { setLocalText(value); onDraftChange?.(value); };
  const [atLatest, setAtLatest] = useState(true);
  const [seenLast, setSeenLast] = useState<string | undefined>(undefined);
  const stream = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const follow = useRef(true);
  const active = roomStatus === 'ACTIVE';
  const count = Math.max(root.threadReplyCount ?? 0, messages.length);
  const lastId = messages.at(-1)?.id;
  const showLatest = !atLatest && Boolean(lastId) && lastId !== seenLast;
  const goLatest = () => {
    follow.current = true; setAtLatest(true); setSeenLast(lastId);
    if (stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  };
  useEffect(() => {
    if (follow.current && stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (!embedded) return;
    field.current?.focus({ preventScroll: true });
    const section = panel.current;
    const origin = opener.current;
    return () => { if (section?.contains(document.activeElement) && origin instanceof HTMLElement && origin.isConnected) origin.focus({ preventScroll: true }); };
  }, [embedded]);

  const content = <section ref={panel} id="room-thread-panel" role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true}
    aria-labelledby="thread-heading" onKeyDown={event => { if (embedded && event.key === 'Escape' && !sending) { event.stopPropagation(); onClose(); } }}
    className={`${embedded ? 'h-full min-h-0 rounded-2xl' : 'motion-drawer h-[100dvh] w-full sm:max-w-lg'} bg-card text-foreground flex flex-col overflow-hidden`}>
    <header className="max-h-[40dvh] overflow-y-auto border-b border-border px-4 py-3 shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onClose} disabled={sending} aria-label="Đóng nhánh thảo luận"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" />Kênh chính
        </button>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-text">Đang trong nhánh</span>
      </div>
      <div className="flex items-start gap-2.5">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><MessageSquare className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 id="thread-heading" className="font-bold text-sm">Nhánh thảo luận</h2>
          <p className="mt-0.5 text-xs text-muted-foreground break-words">Từ tin nhắn của <strong className="text-foreground">{root.senderName}</strong> · {root.createdAt}</p>
        </div>
      </div>
      {onShowList && <button type="button" onClick={onShowList} disabled={sending} className="text-xs font-semibold text-primary-text hover:underline disabled:opacity-50">Xem tất cả nhánh</button>}
      <details className="group rounded-xl border border-border bg-card-muted/40 p-3">
        <summary className="cursor-pointer text-sm leading-relaxed break-words [overflow-wrap:anywhere] list-none">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Tin gốc</span>
          <span className="line-clamp-2 group-open:hidden">{root.content || 'Tin nhắn có tệp đính kèm'}</span>
          <span className="block mt-1 text-xs text-primary-text group-open:hidden">Xem đầy đủ tin gốc</span>
          <span className="hidden mt-1 text-xs text-primary-text group-open:block">Thu gọn tin gốc</span>
        </summary>
        <div className="mt-2 max-h-36 overflow-y-auto space-y-2 border-t border-border pt-2" data-native-scroll>
          {root.content && <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{root.content}</p>}
          <MessageAttachments slug={roomCode} attachments={root.attachments} />
        </div>
      </details>
    </header>
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CornerDownRight className="h-3.5 w-3.5" />{count} phản hồi trong nhánh</div>
      <div ref={stream} data-native-scroll aria-label="Phản hồi trong nhánh"
        onScroll={event => {
          const el = event.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (nearBottom || follow.current) setSeenLast(lastId);
          follow.current = nearBottom; setAtLatest(nearBottom);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4">
        {loading && <p role="status" className="text-xs text-muted-foreground py-2">Đang tải phản hồi...</p>}
        {!loading && !messages.length && !error && <div className="py-8 text-center space-y-2">
          <MessageSquare className="h-7 w-7 text-primary/60 mx-auto" />
          <p className="text-sm font-semibold">Bắt đầu từ tin nhắn này</p>
          <p className="text-xs leading-relaxed text-muted-foreground">Trao đổi riêng về chủ đề ở trên.<br />Phản hồi sẽ nằm gọn trong nhánh.</p>
        </div>}
        <ChatMessageList messages={messages} roomCode={roomCode} onOpenDecisions={() => {}} />
        {error && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <p>{error}</p><button type="button" onClick={() => void onReload()} disabled={loading || sending} className="mt-2 underline disabled:opacity-50">Tải lại phản hồi</button>
        </div>}
      </div>
      {showLatest && <button type="button" onClick={goLatest} className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/20 bg-primary px-3 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5" />Có phản hồi mới</button>}
    </div>
    <form className="border-t border-primary/20 bg-primary/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 space-y-2" onSubmit={async event => {
      event.preventDefault();
      if (!active || loading || sending || !text.trim()) return;
      if (await onSend(text)) { changeText(''); goLatest(); field.current?.focus({ preventScroll: true }); }
    }}>
      <label htmlFor="thread-message" className="flex items-center gap-1.5 text-xs font-semibold text-primary-text"><CornerDownRight className="h-4 w-4" />{active ? 'Nhắn trong nhánh này' : 'Phòng đã kết thúc · Chỉ xem phản hồi'}</label>
      <textarea ref={field} id="thread-message" data-modal-autofocus={active ? true : undefined} aria-describedby="thread-destination" value={text}
        onChange={event => changeText(event.target.value)} maxLength={2048} disabled={!active || sending} rows={2}
        placeholder={active ? `Phản hồi tin nhắn của ${root.senderName}...` : 'Không thể gửi thêm phản hồi'}
        className="w-full resize-none rounded-xl border border-primary/25 bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60" />
      <div className="flex items-center justify-between gap-2">
        <p id="thread-destination" className="text-[11px] leading-relaxed text-muted-foreground">Chỉ gửi vào nhánh này.<br />{text && onDraftChange ? 'Nháp được giữ khi đóng nhánh.' : 'Không gửi vào kênh chính.'}</p>
        <button type="submit" disabled={!active || loading || sending || !text.trim()} className="min-h-10 shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{sending ? 'Đang gửi...' : 'Gửi phản hồi'}</button>
      </div>
    </form>
  </section>;
  return embedded ? content : <ModalPortal onClose={onClose} dismissible={!sending}>
    <div className="motion-overlay fixed inset-0 z-[100] bg-slate-950/30 flex justify-end">{content}</div>
  </ModalPortal>;
}
