import React, { useState } from 'react';
import { Send, Smile } from 'lucide-react';
import type { RoomStatus } from '../types';

interface ChatInputBarProps {
  roomStatus: RoomStatus;
  onSendMessage: (text: string) => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(({ roomStatus, onSendMessage }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || roomStatus === 'CLOSED') return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <form onSubmit={handleSend} className="relative flex items-center">
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        disabled={roomStatus === 'CLOSED'}
        placeholder={roomStatus === 'ACTIVE' ? 'Nhập tin nhắn thảo luận...' : 'Phòng đã kết thúc'}
        className="w-full pl-3.5 pr-18 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-xs"
      />

      <div className="absolute right-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setInputText((prev) => prev + (prev ? ' 🥳' : '🥳'))}
          className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          title="Thêm biểu tượng cảm xúc"
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={!inputText.trim() || roomStatus === 'CLOSED'}
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
  );
});
