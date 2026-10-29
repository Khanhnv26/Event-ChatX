import React, { useRef, useState } from 'react';
import { Paperclip, Send, Smile, X } from 'lucide-react';
import type { ChatMessage, RoomStatus } from '../../types/room';
import type { AttachmentResponse } from '../../types/backend.types';
import { useAttachmentUploads } from '../../hooks/useAttachmentUploads';
import { AttachmentDraftList } from '../attachments/AttachmentDraftList';

interface ChatInputBarProps {
  roomStatus: RoomStatus;
  onSendMessage: (text: string, replyToId?: string, attachments?: AttachmentResponse[]) => Promise<boolean>;
  roomCode?: string;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(
  ({ roomStatus, roomCode, onSendMessage, replyTo, onCancelReply }) => {
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const uploads = useAttachmentUploads(roomCode, roomStatus === 'ACTIVE');
    const canSend = (Boolean(inputText.trim()) || uploads.ready)
      && (!uploads.drafts.length || uploads.ready) && roomStatus === 'ACTIVE' && !isSending;

    const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSend) return;
      setIsSending(true);
      try {
        const sent = uploads.drafts.length
          ? await onSendMessage(inputText, replyTo?.id, uploads.attachments)
          : await onSendMessage(inputText, replyTo?.id);
        if (sent) {
          setInputText('');
          uploads.clearSent();
          onCancelReply?.();
        }
      } finally {
        setIsSending(false);
      }
    };

    const isActive = roomStatus === 'ACTIVE';

    return (
      <div className={`w-full min-w-0 rounded-xl attachment-dropzone ${dragging ? 'attachment-dropzone-active' : ''}`}
        onDragOver={event => { if (roomCode && isActive && !isSending && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => { if (!roomCode || !isActive || isSending) return; event.preventDefault(); setDragging(false); uploads.add(Array.from(event.dataTransfer.files)); }}>
        <AttachmentDraftList drafts={uploads.drafts} disabled={isSending} onRemove={uploads.remove} onRetry={uploads.retry} />
        {uploads.selectionError && <p role="alert" className="text-xs text-danger mb-2">{uploads.selectionError}</p>}
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
            onPaste={event => { if (roomCode && isActive && !isSending && event.clipboardData.files.length) { event.preventDefault(); uploads.add(Array.from(event.clipboardData.files)); } }}
            className={`w-full ${roomCode ? 'pl-11' : 'pl-3.5'} pr-20 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-2xs disabled:opacity-60`}
          />
          {roomCode && <>
            <input ref={fileInput} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.pptx,.txt,.csv" className="hidden" aria-label="Chọn ảnh hoặc tệp"
              onChange={event => { uploads.add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!isActive || isSending || uploads.drafts.length >= 4}
              aria-label="Đính kèm ảnh hoặc tệp" title="Đính kèm ảnh hoặc tệp" className="ws-icon-btn absolute left-2 p-1.5 disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
          </>}

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
              disabled={!canSend}
              className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                canSend
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
        {roomCode && <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Ảnh ≤ 5 MB · Tệp ≤ 20 MB · Tối đa 4 tệp{uploads.drafts.length && !uploads.ready ? ' · Chờ tệp sẵn sàng để gửi' : ''}</p>}
      </div>
    );
  }
);
