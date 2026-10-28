import React, { useState } from 'react';
import { Send, Smile, X } from 'lucide-react';
import type { ChatMessage, RoomStatus } from '../types';

interface ChatInputBarProps {
  roomStatus: RoomStatus;
  onSendMessage: (text: string, replyToId?: string) => Promise<boolean>;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(
  ({ roomStatus, onSendMessage, replyTo, onCancelReply }) => {
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

    const isActive = roomStatus === 'ACTIVE';

    return (
      <div className="w-full">
        {replyTo && (
          <div className="flex items-center justify-between gap-2 border-l-2 border-primary px-3 py-1.5 text-xs bg-primary-soft/50 mb-2 rounded-lg">
            <p className="truncate text-foreground">
              Trả lời {replyTo.senderName}: {replyTo.content}
            </p>
            <button
              type="button"
              disabled={isSending}
              onClick={onCancelReply}
              aria-label="Hủy trả lời"
              className="ws-icon-btn p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={!isActive || isSending}
            maxLength={2048}
            placeholder={isActive ? 'Nhập tin nhắn thảo luận...' : 'Phòng đã kết thúc'}
            className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-2xs disabled:opacity-60"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            <button
              type="button"
              disabled={!isActive || isSending}
              onClick={() => setInputText(prev => prev + (prev ? ' 😊' : '😊'))}
              className="p-1 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-card-muted transition-colors cursor-pointer disabled:opacity-40"
              title="Thêm biểu tượng cảm xúc"
              aria-label="Thêm biểu tượng cảm xúc"
            >
              <Smile className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={!inputText.trim() || !isActive || isSending}
              className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                inputText.trim() && isActive
                  ? 'bg-primary text-white hover:opacity-90 active:scale-95 cursor-pointer shadow-xs'
                  : 'bg-card-muted text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
              title="Gửi tin nhắn"
              aria-label="Gửi tin nhắn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }
);
