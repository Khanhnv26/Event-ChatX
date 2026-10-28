import React, { useState } from 'react';
import { Send, Smile } from 'lucide-react';
import type { RoomStatus } from '../types';
import type { ChatMessage } from '../types';

interface ChatInputBarProps {
  roomStatus: RoomStatus;
  onSendMessage: (text: string, replyToId?: string) => Promise<boolean>;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(({ roomStatus, onSendMessage, replyTo, onCancelReply }) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || roomStatus !== 'ACTIVE' || isSending) return;
    setIsSending(true);
    try {
      if (await onSendMessage(inputText, replyTo?.id)) {
        setInputText('');
        onCancelReply?.();
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
    {replyTo && <div className="flex justify-between gap-2 border-l-2 border-indigo-500 px-3 py-2 text-xs bg-indigo-50 dark:bg-slate-800 mb-2 rounded-lg">
      <p className="truncate">Trả lời {replyTo.senderName}: {replyTo.content}</p>
      <button type="button" disabled={isSending} onClick={onCancelReply} aria-label="Hủy trả lời">×</button>
    </div>}
    <form onSubmit={handleSend} className="relative flex items-center">
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        disabled={roomStatus !== 'ACTIVE' || isSending}
        maxLength={2048}
        placeholder={roomStatus === 'ACTIVE' ? 'Nhập tin nhắn thảo luận...' : 'Phòng đã kết thúc'}
        className="w-full pl-3.5 pr-18 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-xs"
      />

      <div className="absolute right-1.5 flex items-center gap-1">
        <button
          type="button"
          disabled={roomStatus !== 'ACTIVE' || isSending}
          onClick={() => setInputText((prev) => prev + (prev ? ' 🥳' : '🥳'))}
          className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          title="Thêm biểu tượng cảm xúc"
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={!inputText.trim() || roomStatus !== 'ACTIVE' || isSending}
          className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
            inputText.trim() && roomStatus === 'ACTIVE'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/30 scale-105 active:scale-95 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
          }`}
          title="Gửi tin nhắn"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
    </div>
  );
});
