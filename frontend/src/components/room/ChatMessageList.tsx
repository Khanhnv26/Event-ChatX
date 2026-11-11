import { memo } from 'react';
import { CheckCircle2, CornerUpLeft, MessageSquare, Pin, PinOff, Target } from 'lucide-react';
import type { ChatMessage, MessageInteractionControls } from '../../types/room';
import type { ReactionResponse } from '../../types/backend.types';
import { MessageAttachments } from '../attachments/MessageAttachments';
import { AiCoHostCard } from './AiCoHostCard';
import { MessageReactionButtons } from './MessageReactionButtons';
import { MessageText } from './MessageText';

const MessageBubble = memo(function MessageBubble({
  message: msg,
  onOpenDecisions,
  onReply,
  onOpenThread,
  onProposeDecision,
  activeThreadId,
  replyContent,
  roomCode,
  reactions,
  onReaction,
  onPin,
  pinned,
}: {
  message: ChatMessage;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onProposeDecision?: (message: ChatMessage) => void;
  activeThreadId?: string;
  replyContent?: string;
  roomCode?: string;
  reactions?: ReactionResponse[];
  onReaction?: MessageInteractionControls['onReaction'];
  onPin?: MessageInteractionControls['onPin'];
  pinned: boolean;
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

  const actions = <MessageActions message={msg} onReply={onReply} onOpenThread={onOpenThread}
    onProposeDecision={onProposeDecision} active={activeThreadId === msg.id} reactions={reactions}
    onReaction={onReaction} onPin={onPin} pinned={pinned} />;

  if (msg.type === 'AI_BOT' || msg.senderId === 'ai-cohost') {
    return <div className="max-w-xl">
      <AiCoHostCard message={msg} replyContent={replyContent} />
      {actions}
    </div>;
  }

  if (msg.isMe) {
    return (
      <div className={`chat-message chat-message-own flex justify-end rounded-xl focus:outline-2 focus:outline-primary ${activeThreadId === msg.id ? 'bg-primary/5 ring-1 ring-primary/20 p-2' : ''}`} data-message-id={msg.id} tabIndex={-1}>
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
            <MessageText text={msg.content} mentions={msg.mentions} />
          </div>}
          <MessageAttachments slug={roomCode} attachments={msg.attachments} />
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message flex justify-start rounded-xl focus:outline-2 focus:outline-primary ${activeThreadId === msg.id ? 'bg-primary/5 ring-1 ring-primary/20 p-2' : ''}`} data-message-id={msg.id} tabIndex={-1}>
      <div className="max-w-[90%] sm:max-w-[80%] flex items-start gap-2.5 min-w-0">
        <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-2xs"
            style={{ backgroundColor: msg.avatarColor }}
          >
            {msg.senderName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold break-words text-foreground">
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
          {msg.content && <div className="p-3 rounded-2xl rounded-tl-xs text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap break-words border bg-card-muted text-foreground border-border">
            <MessageText text={msg.content} mentions={msg.mentions} />
          </div>}
          <MessageAttachments slug={roomCode} attachments={msg.attachments} />
          {actions}
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

const MESSAGE_ACTION_CLASS = 'ws-icon-btn inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg sm:min-h-8 sm:min-w-8';

function MessageActions({ message, onReply, onOpenThread, onProposeDecision, active, reactions, onReaction, onPin, pinned }: {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onProposeDecision?: (message: ChatMessage) => void;
  active: boolean;
  reactions?: ReactionResponse[];
  onReaction?: MessageInteractionControls['onReaction'];
  onPin?: MessageInteractionControls['onPin'];
  pinned: boolean;
}) {
  const canReply = onReply && message.sequence != null;
  const canOpenThread = onOpenThread && message.sequence != null && !message.threadRootId && (!message.type || message.type === 'TEXT');
  const hasFiles = Boolean(message.attachments?.length);
  const canPropose = onProposeDecision && message.sequence != null && (!message.type || message.type === 'TEXT') && (Boolean(message.content?.trim()) || hasFiles);
  const canInteract = message.sequence != null && (!message.type || message.type === 'TEXT' || message.type === 'AI_BOT');
  const reaction = canInteract && onReaction ? (emoji: ReactionResponse['emoji'], value: boolean) => void onReaction(message.id, emoji, value) : undefined;
  if (!canReply && !canOpenThread && !canPropose && !(canInteract && (onPin || onReaction || reactions?.length))) return null;
  return <div className={`mt-1 flex max-w-full flex-wrap items-center gap-0.5 ${message.isMe ? 'justify-end' : ''}`}>
    <ThreadButton message={message} onOpen={onOpenThread} active={active} />
    {canPropose && <button type="button" onClick={() => onProposeDecision(message)}
      aria-label={hasFiles ? 'Đề xuất quyết định từ tệp này' : 'Đề xuất quyết định từ tin này'}
      title={hasFiles ? 'Chốt tệp' : 'Chốt việc'} className={MESSAGE_ACTION_CLASS}>
      <Target aria-hidden="true" className="size-4 text-accent" />
    </button>}
    {canReply && <button type="button" onClick={() => onReply(message)}
      aria-label={message.threadRootId ? 'Trích dẫn trong nhánh' : 'Trích dẫn vào kênh chính'}
      title="Trích dẫn" className={MESSAGE_ACTION_CLASS}>
      <CornerUpLeft aria-hidden="true" className="size-4" />
    </button>}
    {canInteract && onPin && <button type="button" className={MESSAGE_ACTION_CLASS}
      aria-label={pinned ? 'Bỏ ghim tin này' : 'Ghim tin này'} title={pinned ? 'Bỏ ghim' : 'Ghim tin'}
      onClick={() => void onPin(pinned ? null : message.id)}>
      {pinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
    </button>}
    {canInteract && <MessageReactionButtons reactions={reactions} onSetReaction={reaction} />}
  </div>;
}

function ThreadButton({ message, onOpen, active }: { message: ChatMessage; onOpen?: (message: ChatMessage) => void; active: boolean }) {
  if (!onOpen || message.sequence == null || message.threadRootId || message.type && message.type !== 'TEXT') return null;
  const count = message.threadReplyCount ?? 0;
  return <button type="button" onClick={() => onOpen(message)}
    aria-expanded={active} aria-controls={active ? 'room-thread-panel' : undefined}
    aria-label={`${count ? `${count} phản hồi trong nhánh` : 'Mở nhánh thảo luận'}: ${message.content || 'Tệp đính kèm'}`}
    title={active ? 'Đang mở nhánh' : count ? `${count} phản hồi trong nhánh` : 'Thảo luận nhánh'}
    className={`${MESSAGE_ACTION_CLASS} relative text-primary-text ${active ? 'bg-primary-soft' : ''}`}>
    <MessageSquare aria-hidden="true" className="size-4" />
    {count > 0 && <span className="absolute top-0 right-0 rounded-full bg-primary-soft px-1 text-[9px] leading-3 font-semibold tabular-nums" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
  </button>;
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  roomCode,
  onOpenDecisions,
  onReply,
  onOpenThread,
  onProposeDecision,
  activeThreadId,
  interactions,
}: {
  messages: ChatMessage[];
  roomCode?: string;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onProposeDecision?: (message: ChatMessage) => void;
  activeThreadId?: string;
  interactions?: MessageInteractionControls;
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
          onProposeDecision={onProposeDecision}
          activeThreadId={activeThreadId}
          reactions={interactions?.reactions?.[message.id]}
          onReaction={interactions?.onReaction}
          onPin={interactions?.onPin}
          pinned={interactions?.pinnedMessageId === message.id}
          replyContent={messages.find(m => m.id === message.replyToId)?.content.slice(0, 150)}
        />
      ))}
    </>
  );
});
