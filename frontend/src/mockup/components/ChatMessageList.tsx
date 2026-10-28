import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChatMessage } from '../types';

const MessageBubble = memo(function MessageBubble({ message: msg, onOpenDecisions, onReply, replyContent }: {
  message: ChatMessage; onOpenDecisions: () => void; onReply?: (message: ChatMessage) => void; replyContent?: string;
}) {
  if (msg.type === 'SYSTEM') return <div className="chat-message chat-message-system text-center text-[11px] text-slate-400 py-1" data-message-id={msg.id}>
    {msg.content}
  </div>;
  if (msg.isMe) return <div className="chat-message chat-message-own flex justify-end" data-message-id={msg.id}>
    <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-end min-w-0">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
        <span>{msg.createdAt}</span><span className="font-bold text-indigo-600 dark:text-indigo-400">Bạn</span>
      </div>
      {msg.replyToId && <p className="text-xs border-l-2 border-indigo-400 pl-2 mb-1 text-slate-500">↳ {replyContent || 'Tin nhắn trước đó'}</p>}
      <div className="p-3 rounded-2xl rounded-tr-xs bg-indigo-600 text-white text-xs sm:text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words max-w-full">{msg.content}</div>
      {onReply && msg.sequence != null && <button type="button" onClick={() => onReply(msg)} className="text-[11px] text-indigo-500 mt-1">Trả lời</button>}
    </div>
  </div>;
  return <div className="chat-message flex justify-start" data-message-id={msg.id}>
    <div className="max-w-[90%] sm:max-w-[80%] flex items-start gap-2.5 min-w-0">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-xs"
        style={{ backgroundColor: msg.avatarColor }}>{msg.senderName.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white break-words">{msg.senderName}</span>
          {msg.senderRole === 'HOST' && <span className="text-[9px] font-bold px-1.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">HOST</span>}
          <span className="text-[10px] text-slate-400">{msg.createdAt}</span>
        </div>
        {msg.replyToId && <p className="text-xs border-l-2 border-indigo-400 pl-2 mb-1 text-slate-500">↳ {replyContent || 'Tin nhắn trước đó'}</p>}
        <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-100/90 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs whitespace-pre-wrap break-words">{msg.content}</div>
        {onReply && msg.sequence != null && <button type="button" onClick={() => onReply(msg)} className="text-[11px] text-indigo-500 mt-1">Trả lời</button>}
        {msg.type === 'DECISION_NOTIF' && <div className="animate-fade-slide-up mt-2.5 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Đã chốt quyết định vào biên bản
          </span>
          <button type="button" onClick={onOpenDecisions} className="text-emerald-700 dark:text-emerald-300 underline text-[11px] cursor-pointer shrink-0">Xem chi tiết</button>
        </div>}
      </div>
    </div>
  </div>;
});

export const ChatMessageList = memo(function ChatMessageList({ messages, onOpenDecisions, onReply }: {
  messages: ChatMessage[]; onOpenDecisions: () => void; onReply?: (message: ChatMessage) => void;
}) {
  return <>{messages.map(message => <MessageBubble key={message.clientMessageId || message.id} message={message}
    onOpenDecisions={onOpenDecisions} onReply={onReply}
    replyContent={messages.find(original => original.id === message.replyToId)?.content.slice(0, 150)} />)}</>;
});
