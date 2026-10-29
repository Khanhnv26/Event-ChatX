import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChatMessage } from '../../types/room';
import { MessageAttachments } from '../attachments/MessageAttachments';

const MessageBubble = memo(function MessageBubble({
  message: msg,
  onOpenDecisions,
  onReply,
  replyContent,
  roomCode,
}: {
  message: ChatMessage;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
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
      <div className="chat-message chat-message-own flex justify-end" data-message-id={msg.id}>
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
          {onReply && msg.sequence != null && (
            <button
              type="button"
              onClick={() => onReply(msg)}
              className="text-xs text-primary mt-1 hover:underline cursor-pointer"
            >
              Trả lời
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-message flex justify-start" data-message-id={msg.id}>
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
          {onReply && msg.sequence != null && (
            <button
              type="button"
              onClick={() => onReply(msg)}
              className="text-xs text-primary mt-1 hover:underline cursor-pointer"
            >
              Trả lời
            </button>
          )}
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

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  roomCode,
  onOpenDecisions,
  onReply,
}: {
  messages: ChatMessage[];
  roomCode?: string;
  onOpenDecisions: () => void;
  onReply?: (message: ChatMessage) => void;
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
          replyContent={messages.find(m => m.id === message.replyToId)?.content.slice(0, 150)}
        />
      ))}
    </>
  );
});
