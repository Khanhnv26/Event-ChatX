import { memo } from 'react';
import { CheckCircle2, ChevronRight, CornerUpLeft, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../../types/room';
import { MessageAttachments } from '../attachments/MessageAttachments';

const MessageBubble = memo(function MessageBubble({
  message: msg,
  onOpenDecisions,
  onReply,
  onOpenThread,
  activeThreadId,
  replyContent,
  roomCode,
}: {
  message: ChatMessage;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  activeThreadId?: string;
  replyContent?: string;
  roomCode?: string;
}) {
  if (msg.type === 'SYSTEM') {
    return (
      <div
        className="chat-message chat-message-system text-center text-xs text-muted-foreground py-1"
        data-message-id={msg.id}
      >
        {msg.content}
      </div>
    );
  }

  if (msg.isMe) {
    return (
      <div className={`chat-message chat-message-own flex justify-end rounded-xl ${activeThreadId === msg.id ? 'bg-primary/5 ring-1 ring-primary/20 p-2' : ''}`} data-message-id={msg.id}>
        <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-end min-w-0">
          <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
            <span>{msg.createdAt}</span>
            <span className="font-bold text-primary">Bạn</span>
          </div>
          {msg.replyToId && (
            <p className="text-xs border-l-2 border-primary pl-2 mb-1 text-muted-foreground truncate">
              ↳ {replyContent || 'Tin nhắn trước đó'}
            </p>
          )}
          {msg.content && <div className="p-3 rounded-2xl rounded-tr-xs bg-primary text-white text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words max-w-full">
            {msg.content}
          </div>}
          <MessageAttachments slug={roomCode} attachments={msg.attachments} />
          <MessageActions message={msg} onReply={onReply} onOpenThread={onOpenThread} active={activeThreadId === msg.id} />
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message flex justify-start rounded-xl ${activeThreadId === msg.id ? 'bg-primary/5 ring-1 ring-primary/20 p-2' : ''}`} data-message-id={msg.id}>
      <div className="max-w-[90%] sm:max-w-[80%] flex items-start gap-2.5 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-2xs"
          style={{ backgroundColor: msg.avatarColor }}
        >
          {msg.senderName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold text-foreground break-words">
              {msg.senderName}
            </span>
            {msg.senderRole === 'HOST' && (
              <span className="ws-badge text-xs bg-warn-soft text-warn-text">
                HOST
              </span>
            )}
            <span className="text-xs text-muted-foreground">{msg.createdAt}</span>
          </div>
          {msg.replyToId && (
            <p className="text-xs border-l-2 border-primary pl-2 mb-1 text-muted-foreground truncate">
              ↳ {replyContent || 'Tin nhắn trước đó'}
            </p>
          )}
          {msg.content && <div className="p-3 rounded-2xl rounded-tl-xs bg-card-muted text-xs sm:text-sm text-foreground leading-relaxed shadow-2xs whitespace-pre-wrap break-words border border-border">
            {msg.content}
          </div>}
          <MessageAttachments slug={roomCode} attachments={msg.attachments} />
          <MessageActions message={msg} onReply={onReply} onOpenThread={onOpenThread} active={activeThreadId === msg.id} />
          {msg.type === 'DECISION_NOTIF' && (
            <div className="animate-fade-slide-up mt-2.5 p-2.5 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-bold text-accent-text">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-accent" />
                Đã chốt quyết định vào biên bản
              </span>
              <button
                type="button"
                onClick={onOpenDecisions}
                className="text-accent-text underline text-xs cursor-pointer shrink-0 hover:opacity-80"
              >
                Xem chi tiết
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function MessageActions({ message, onReply, onOpenThread, active }: {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  active: boolean;
}) {
  const canReply = onReply && message.sequence != null;
  const canOpenThread = onOpenThread && message.sequence != null && !message.threadRootId && (!message.type || message.type === 'TEXT');
  if (!canReply && !canOpenThread) return null;
  return <div className={`mt-1.5 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 ${message.isMe ? 'justify-end' : ''}`}>
    <ThreadButton message={message} onOpen={onOpenThread} active={active} />
    {canReply && <button type="button" onClick={() => onReply(message)} aria-label="Trích dẫn vào kênh chính"
      title="Trích dẫn tin nhắn này để trả lời trong kênh chính"
      className="inline-flex min-h-10 sm:min-h-8 items-center gap-1.5 rounded-lg px-1.5 text-[11px] sm:text-xs text-muted-foreground transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
      <CornerUpLeft className="h-3.5 w-3.5 shrink-0" /><span>Trích dẫn</span>
    </button>}
  </div>;
}

function ThreadButton({ message, onOpen, active }: { message: ChatMessage; onOpen?: (message: ChatMessage) => void; active: boolean }) {
  if (!onOpen || message.sequence == null || message.threadRootId || message.type && message.type !== 'TEXT') return null;
  const count = message.threadReplyCount ?? 0;
  return <button type="button" onClick={() => onOpen(message)}
    aria-expanded={active} aria-controls={active ? 'room-thread-panel' : undefined}
    aria-label={`${count ? `${count} phản hồi trong nhánh` : 'Mở nhánh thảo luận'}: ${message.content || 'Tệp đính kèm'}`}
    title={active ? 'Nhánh này đang mở bên cạnh kênh chính' : 'Mở cuộc thảo luận riêng cho tin nhắn này'}
    className={`inline-flex min-h-10 sm:min-h-8 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] sm:text-xs font-semibold text-primary-text transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary ${active ? 'border-primary/40 bg-primary/10' : 'border-primary/15 bg-primary/5'}`}>
    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
    <span>{active ? 'Đang mở nhánh' : count ? `${count} phản hồi` : 'Thảo luận nhánh'}</span>
    {active && count > 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] tabular-nums" aria-hidden="true">{count}</span>}
    <ChevronRight className="h-3 w-3 shrink-0" />
  </button>;
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  roomCode,
  onOpenDecisions,
  onReply,
  onOpenThread,
  activeThreadId,
}: {
  messages: ChatMessage[];
  roomCode?: string;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  activeThreadId?: string;
}) {
  return (
    <>
      {messages.map(message => (
        <MessageBubble
          key={message.clientMessageId || message.id}
          message={message}
          roomCode={roomCode}
          onOpenDecisions={onOpenDecisions}
          onReply={onReply}
          onOpenThread={onOpenThread}
          activeThreadId={activeThreadId}
          replyContent={messages.find(m => m.id === message.replyToId)?.content.slice(0, 150)}
        />
      ))}
    </>
  );
});
