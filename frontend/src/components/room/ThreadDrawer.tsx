import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ChevronDown, CornerDownRight, MessageSquare, Paperclip, Smile, X } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';
import { ChatMessageList } from './ChatMessageList';
import { MessageAttachments } from '../attachments/MessageAttachments';
import { AttachmentDraftList } from '../attachments/AttachmentDraftList';
import { useAttachmentUploads } from '../../hooks/useAttachmentUploads';
import { AiActivityNotice, AiSummaryButton } from './AiActivityNotice';
import { EmojiPicker } from './EmojiPicker';
import { AtCommandSuggestions } from './AtCommandSuggestions';
import { MessageText } from './MessageText';
import { useAtCommandSuggestions } from '../../hooks/useAtCommandSuggestions';
import { focusRoomElement } from '../../services/roomNavigation';
import type { RoomNotification } from '../../types/roomNotification';
import type { AiActivity, ChatMessage, MessageInteractionControls, Participant, RoomStatus } from '../../types/room';
import type { MessageMention } from '../../types/backend.types';

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
  draftMentions?: MessageMention[];
  mentionMembers?: Participant[];
  onDraftChange?: (text: string, mentions?: MessageMention[]) => void;
  onClose: () => void;
  onShowList?: () => void;
  onReload: () => Promise<void>;
  onSend: (text: string, attachmentIds?: string[], preserveDraft?: boolean, mentions?: MessageMention[], replyToId?: string) => Promise<boolean>;
  aiActivity?: AiActivity[];
  interactions?: MessageInteractionControls;
  onDismissAiActivity?: (id: string) => void;
  onProposeDecision?: (message: ChatMessage) => void;
  onOpenDecisions?: () => void;
  notificationTarget?: RoomNotification;
  onNotificationTargetReached?: (entry: RoomNotification) => void;
}

export function ThreadDrawer({ root, messages, loading, sending, error, roomStatus, roomCode, aiActivity = [], interactions, onDismissAiActivity,
  notificationTarget, onNotificationTargetReached,
  embedded = false, draft, draftMentions, mentionMembers = [], onDraftChange, onClose, onShowList, onReload, onSend, onProposeDecision, onOpenDecisions }: ThreadDrawerProps) {
  const [localText, setLocalText] = useState('');
  const [localMentions, setLocalMentions] = useState<MessageMention[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const text = draft ?? localText;
  const mentions = draftMentions ?? localMentions;
  const changeText = (value: string, nextMentions: MessageMention[]) => {
    setLocalText(value);
    setLocalMentions(nextMentions);
    onDraftChange?.(value, nextMentions);
  };
  const [atLatest, setAtLatest] = useState(true);
  const [seenLast, setSeenLast] = useState<string | undefined>(undefined);
  const stream = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const emojiTrigger = useRef<HTMLButtonElement>(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const follow = useRef(true);
  const active = roomStatus === 'ACTIVE';
  const showEmojiPicker = emojiPickerOpen && active && !sending;
  const count = Math.max(root.threadReplyCount ?? 0, messages.length);
  const lastId = messages.at(-1)?.id;
  const showLatest = !atLatest && Boolean(lastId) && lastId !== seenLast;

  const uploads = useAttachmentUploads(roomCode, active);
  const replyHasImage = replyTo?.attachments?.some(item => item.contentType?.startsWith('image/'));
  const hasImage = replyHasImage || uploads.attachments.some(item => item.contentType?.startsWith('image/'));
  const commands = useAtCommandSuggestions(field, text, mentions, changeText, active && !sending && !showEmojiPicker, mentionMembers, hasImage);
  const canSend = (Boolean(text.trim()) || uploads.ready)
    && (!uploads.drafts.length || uploads.ready) && active && !loading && !sending;
  const dismissEmojiPicker = () => {
    setEmojiPickerOpen(false);
    emojiTrigger.current?.focus({ preventScroll: true });
  };
  const selectEmoji = (emoji: string) => {
    const next = text ? `${text} ${emoji}` : emoji;
    if (next.length <= 2048) commands.edit(next);
    field.current?.focus({ preventScroll: true });
  };
  const goLatest = () => {
    follow.current = true; setAtLatest(true); setSeenLast(lastId);
    if (stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  };
  const sendAiPrompt = async (prompt: string, replyToId?: string) => {
    const sent = replyToId
      ? await onSend(prompt, undefined, true, undefined, replyToId)
      : await onSend(prompt, undefined, true);
    if (sent) goLatest();
    return sent;
  };
  useEffect(() => {
    if (follow.current && stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const replyStream = stream.current;
    if (!replyStream || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (follow.current) replyStream.scrollTop = replyStream.scrollHeight;
    });
    observer.observe(replyStream);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!embedded) return;
    field.current?.focus({ preventScroll: true });
    const section = panel.current;
    const origin = opener.current;
    return () => { if (section?.contains(document.activeElement) && origin instanceof HTMLElement && origin.isConnected) origin.focus({ preventScroll: true }); };
  }, [embedded]);
  useEffect(() => {
    if (!notificationTarget) return;
    const frame = window.requestAnimationFrame(() => {
      if (focusRoomElement(stream.current, 'data-message-id', notificationTarget.targetId)) {
        follow.current = false;
        onNotificationTargetReached?.(notificationTarget);
      } else if (!loading) {
        onNotificationTargetReached?.(notificationTarget);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [notificationTarget, onNotificationTargetReached, messages, loading]);

  const content = <section ref={panel} id="room-thread-panel" data-ai-scope role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true}
    aria-labelledby="thread-heading" onKeyDown={event => {
      if (embedded && event.key === 'Escape' && !sending) {
        event.stopPropagation();
        if (showEmojiPicker) dismissEmojiPicker();
        else onClose();
      }
    }}
    className={`${embedded ? 'h-full min-h-0 rounded-2xl' : 'motion-drawer h-[100dvh] w-full sm:max-w-lg'} bg-card text-foreground flex flex-col overflow-hidden`}>
    <header className="shrink-0 space-y-1.5 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} disabled={sending} aria-label="Đóng nhánh thảo luận" title="Về kênh chính"
          className="ws-icon-btn inline-flex size-10 shrink-0 items-center justify-center disabled:opacity-50">
          <ArrowLeft aria-hidden="true" className="size-4" />
        </button>
        <h2 id="thread-heading" className="min-w-0 flex-1 text-sm font-bold">Nhánh thảo luận</h2>
        {onShowList && <button type="button" onClick={onShowList} disabled={sending} className="min-h-10 shrink-0 px-1 text-xs font-semibold text-primary-text hover:underline disabled:opacity-50">Tất cả nhánh</button>}
      </div>
      <details data-message-id={root.id} tabIndex={-1} className="group rounded-xl border border-border bg-card-muted/40 focus:outline-2 focus:outline-primary">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-2.5 text-xs text-muted-foreground" title="Xem tin gốc">
          <span className="sr-only">Tin gốc</span>
          <MessageSquare aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
          <strong className="max-w-[36%] truncate text-foreground">{root.senderName}</strong>
          <span className="shrink-0">{root.createdAt}</span>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 flex-1 truncate"><MessageText text={root.content || 'Tin nhắn có tệp đính kèm'} mentions={root.mentions} /></span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-primary transition-transform group-open:rotate-180" />
        </summary>
        <div className="max-h-[min(9rem,28dvh)] space-y-2 overflow-y-auto border-t border-border px-2.5 py-2" data-native-scroll>
          {root.content && <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><MessageText text={root.content} mentions={root.mentions} /></p>}
          <MessageAttachments slug={roomCode} attachments={root.attachments} />
        </div>
      </details>
    </header>
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"><CornerDownRight aria-hidden="true" className="size-3.5" />{count} phản hồi trong nhánh</div>
      <div ref={stream} data-native-scroll aria-label="Phản hồi trong nhánh"
        onScroll={event => {
          const el = event.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (nearBottom || follow.current) setSeenLast(lastId);
          follow.current = nearBottom; setAtLatest(nearBottom);
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-3">
        {loading && <p role="status" className="text-xs text-muted-foreground py-2">Đang tải phản hồi...</p>}
        {!loading && !messages.length && !error && <div className="py-8 text-center space-y-2">
          <MessageSquare className="h-7 w-7 text-primary/60 mx-auto" />
          <p className="text-sm font-semibold">Bắt đầu từ tin nhắn này</p>
          <p className="text-xs leading-relaxed text-muted-foreground">Trao đổi riêng về chủ đề ở trên.<br />Phản hồi sẽ nằm gọn trong nhánh.</p>
        </div>}
        <ChatMessageList
          messages={messages}
          onReply={active && !sending ? message => { setReplyTo(message); field.current?.focus({ preventScroll: true }); } : undefined}
          interactions={interactions}
          roomCode={roomCode}
          onOpenDecisions={onOpenDecisions ?? (() => {})}
          onProposeDecision={onProposeDecision}
        />
        {error && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <p>{error}</p><button type="button" onClick={() => void onReload()} disabled={loading || sending} className="mt-2 underline disabled:opacity-50">Tải lại phản hồi</button>
        </div>}
      </div>
      {showLatest && <button type="button" onClick={goLatest} className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/20 bg-primary px-3 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5" />Có phản hồi mới</button>}
    </div>
    <form className="relative shrink-0 space-y-2 border-t border-primary/20 bg-primary/5 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onSubmit={async event => {
      event.preventDefault();
      if (!canSend) return;
      const attachmentIds = uploads.attachments.map(a => a.publicId);
      const files = attachmentIds.length ? attachmentIds : undefined;
      const sent = replyTo
        ? await onSend(text, files, undefined, mentions.length ? mentions : undefined, replyTo.id)
        : mentions.length ? await onSend(text, files, undefined, mentions) : await onSend(text, files);
      if (sent) {
        changeText('', []);
        setReplyTo(null);
        setEmojiPickerOpen(false);
        uploads.clearSent();
        goLatest();
        field.current?.focus({ preventScroll: true });
      }
    }}>
      <AiActivityNotice activities={aiActivity} messages={messages} disabled={!active || loading || sending}
        onRetry={sendAiPrompt} onDismiss={onDismissAiActivity} />
      <AttachmentDraftList drafts={uploads.drafts} disabled={sending} onRemove={uploads.remove} onRetry={uploads.retry} />
      {uploads.selectionError && <p role="alert" className="text-xs text-danger">{uploads.selectionError}</p>}
      {active && replyTo && <div className="flex items-center justify-between gap-2 rounded-lg border-l-2 border-primary bg-primary-soft/50 px-2.5 py-1 text-xs">
        <p className="truncate">Trả lời {replyTo.senderName}: {replyTo.content || (replyHasImage ? 'Ảnh đính kèm' : 'Tệp đính kèm')}</p>
        <button type="button" onClick={() => setReplyTo(null)} disabled={sending} aria-label="Hủy trả lời" className="ws-icon-btn p-1">
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>}
      <label htmlFor="thread-message" className={active ? 'sr-only' : 'block text-xs font-semibold text-primary-text'}>
        {active ? 'Nhắn trong nhánh này' : 'Phòng đã kết thúc · Chỉ xem phản hồi'}
      </label>
      <textarea ref={field} id="thread-message" data-modal-autofocus={active ? true : undefined} aria-describedby={active ? 'thread-shortcuts' : undefined} value={text}
        enterKeyHint="send"
        aria-autocomplete="list"
        aria-controls={commands.open ? commands.listId : undefined}
        aria-activedescendant={commands.open ? commands.optionId(commands.selected) : undefined}
        onFocus={event => commands.track(event.currentTarget)}
        onSelect={event => commands.track(event.currentTarget)}
        onBlur={commands.dismiss}
        onKeyDown={event => {
          if (commands.handleKeyDown(event)) return;
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          if (canSend && !event.repeat) event.currentTarget.form?.requestSubmit();
        }}
        onChange={event => { commands.track(event.currentTarget); commands.edit(event.target.value); }} maxLength={2048} disabled={!active || sending} rows={1}
        placeholder={active ? 'Nhắn trong nhánh này…' : 'Không thể gửi thêm phản hồi'}
        className="peer block min-h-10 max-h-[min(8rem,24dvh)] w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm [field-sizing:content] focus:border-primary focus-visible:outline-offset-0 disabled:opacity-60" />
      <div className="chat-composer-tools relative flex flex-wrap items-center gap-1.5">
        {roomCode && active && <>
          <input ref={fileInput} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.pptx,.txt,.csv" className="hidden" aria-label="Chọn ảnh hoặc tệp"
            onChange={event => { uploads.add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={sending || uploads.drafts.length >= 4}
            aria-label="Đính kèm ảnh hoặc tệp" title="Đính kèm ảnh hoặc tệp vào nhánh"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card-muted hover:text-foreground disabled:opacity-40">
            <Paperclip aria-hidden="true" className="size-3.5" />
            Đính kèm
          </button>
        </>}
        {active && <>
          <button ref={emojiTrigger} type="button" disabled={sending} aria-expanded={showEmojiPicker} aria-haspopup="dialog"
            onClick={() => setEmojiPickerOpen(open => !open)}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card-muted hover:text-foreground aria-expanded:border-primary/35 aria-expanded:text-primary-text disabled:opacity-40">
            <Smile aria-hidden="true" className="size-3.5" />
            Emoji
          </button>
          <EmojiPicker isOpen={showEmojiPicker} triggerRef={emojiTrigger} onClose={() => setEmojiPickerOpen(false)} onSelectEmoji={selectEmoji} />
          <AiSummaryButton compact onSend={sendAiPrompt} disabled={loading || sending || aiActivity.some(activity => !activity.error)} />
        </>}
        <button type="submit" disabled={!canSend} className="ws-btn ws-btn-primary ml-auto min-h-10 w-auto shrink-0 whitespace-nowrap text-xs">{sending ? 'Đang gửi...' : 'Gửi phản hồi'}</button>
      </div>
      {active && <p id="thread-shortcuts" className="hidden text-[11px] leading-tight text-muted-foreground sm:peer-focus:block">Enter để gửi · Shift+Enter để xuống dòng</p>}
      {commands.open && <AtCommandSuggestions {...commands} />}
    </form>
  </section>;
  return embedded ? content : <ModalPortal onClose={commands.open ? commands.dismiss : showEmojiPicker ? dismissEmojiPicker : onClose} dismissible={!sending}>
    <div className="motion-overlay fixed inset-0 z-[100] bg-slate-950/30 flex justify-end">{content}</div>
  </ModalPortal>;
}
