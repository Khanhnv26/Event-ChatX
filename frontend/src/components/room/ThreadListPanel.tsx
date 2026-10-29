import { useEffect, useRef } from 'react';
import { ArrowLeft, ChevronRight, MessageSquare, RefreshCw } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';
import type { ThreadListItem } from '../../hooks/useThreadDirectory';
import type { ChatMessage } from '../../types/room';

export interface ThreadListPanelProps {
  entries: ThreadListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  embedded?: boolean;
  onClose: () => void;
  onOpen: (root: ChatMessage) => void;
  onReload: () => Promise<void>;
  onLoadMore: () => Promise<void>;
}

export function ThreadListPanel({ entries, loading, error, hasMore, embedded = false, onClose, onOpen, onReload, onLoadMore }: ThreadListPanelProps) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => {
    if (!embedded) return;
    const section = panel.current;
    const origin = opener.current;
    section?.focus({ preventScroll: true });
    return () => {
      if (!section?.contains(document.activeElement)) return;
      const target = origin instanceof HTMLElement && origin.isConnected ? origin : document.querySelector<HTMLElement>('[aria-label="Mở danh sách nhánh thảo luận"]');
      target?.focus({ preventScroll: true });
    };
  }, [embedded]);
  const content = <section ref={panel} tabIndex={-1} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true}
    aria-labelledby="thread-list-heading" onKeyDown={event => { if (embedded && event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    className={`${embedded ? 'h-full min-h-0 rounded-2xl' : 'motion-drawer h-[100dvh] w-full sm:max-w-lg'} bg-card flex flex-col overflow-hidden text-foreground outline-none`}>
    <header className="shrink-0 border-b border-border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kênh chính
        </button>
        <button type="button" onClick={() => void onReload()} disabled={loading} aria-label="Làm mới danh sách nhánh" className="ws-icon-btn p-2 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><MessageSquare className="h-4 w-4" /></span>
        <div><h2 id="thread-list-heading" className="text-sm font-bold">Nhánh thảo luận</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tìm lại cuộc trao đổi dù tin gốc đã trôi.</p></div>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-2" aria-busy={loading}>
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hoạt động gần nhất</p>
      {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs">
        <p>{error}</p><button type="button" onClick={() => void onReload()} disabled={loading} className="mt-2 font-bold underline">Thử lại</button>
      </div>}
      {!entries.length && !error && <div role="status" className="py-10 px-4 text-center text-sm text-muted-foreground">
        {loading ? 'Đang tải các nhánh…' : <><MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-40" /><p className="font-semibold text-foreground">Chưa có nhánh thảo luận</p><p className="mt-2 text-xs leading-relaxed">Chọn “Mở nhánh thảo luận” trên một tin nhắn và gửi phản hồi đầu tiên. Nhánh sẽ xuất hiện ở đây.</p></>}
      </div>}
      {entries.map(entry => <button key={entry.root.id} type="button" onClick={() => onOpen(entry.root)}
        aria-label={`Mở nhánh: ${entry.root.content || 'Tin nhắn có tệp đính kèm'}`}
        className="group w-full rounded-xl border border-border bg-card-muted/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed line-clamp-2 break-words [overflow-wrap:anywhere]">{entry.root.content || 'Tin nhắn có tệp đính kèm'}</p><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></div>
        <p className="mt-1 truncate text-xs text-muted-foreground">Tin gốc của {entry.root.senderName}</p>
        {entry.lastReplySnippet && <p className="mt-2 truncate text-xs text-muted-foreground">↳ {entry.lastReplySnippet}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary-text"><MessageSquare className="h-3 w-3" />{entry.replyCount} phản hồi</span>
          {entry.lastActivityAt && <time dateTime={entry.lastActivityAt} className="text-muted-foreground">{new Date(entry.lastActivityAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>}
        </div>
      </button>)}
      {hasMore && <button type="button" disabled={loading} onClick={() => void onLoadMore()} className="w-full min-h-10 rounded-xl border border-border text-xs font-semibold hover:bg-card-muted disabled:opacity-50">{loading ? 'Đang tải…' : 'Tải thêm nhánh'}</button>}
    </div>
  </section>;
  if (embedded) return content;
  return <ModalPortal onClose={onClose}><div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}><div className="w-full sm:max-w-lg" onClick={event => event.stopPropagation()}>{content}</div></div></ModalPortal>;
}
