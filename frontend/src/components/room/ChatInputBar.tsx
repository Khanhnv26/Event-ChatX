import React, { useRef, useState } from 'react';
import { Paperclip, Send, Smile, Sparkles, X } from 'lucide-react';
import type { AiActivity, ChatMessage, RoomStatus } from '../../types/room';
import type { AttachmentResponse } from '../../types/backend.types';
import { useAttachmentUploads } from '../../hooks/useAttachmentUploads';
import { AttachmentDraftList } from '../attachments/AttachmentDraftList';
import { AiActivityNotice, AiSummaryButton } from './AiActivityNotice';

interface ChatInputBarProps {
  roomStatus: RoomStatus;
  onSendMessage: (text: string, replyToId?: string, attachments?: AttachmentResponse[]) => Promise<boolean>;
  roomCode?: string;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  messages?: ChatMessage[];
  aiActivity?: AiActivity[];
  onDismissAiActivity?: (id: string) => void;
  toolbar?: React.ReactNode;
  typingMembers?: { id: string; nickname: string }[];
  onTyping?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = React.memo(
  ({ roomStatus, roomCode, onSendMessage, replyTo, onCancelReply,
    messages = [], aiActivity = [], onDismissAiActivity, toolbar, typingMembers = [], onTyping }) => {
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const textInput = useRef<HTMLInputElement>(null);
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
    const visibleTypers = typingMembers.slice(0, 2).map(member => member.nickname);
    const typingLabel = visibleTypers.length > 0
      ? `${visibleTypers.join(', ')}${typingMembers.length > 2 ? ` và ${typingMembers.length - 2} người khác` : ''} đang soạn tin`
      : '';
    const sendAiPrompt = async (prompt: string) => {
      if (!isActive || isSending) return false;
      setIsSending(true);
      try { return await onSendMessage(prompt); }
      finally { setIsSending(false); }
    };

    return (
      <div className={`w-full min-w-0 rounded-xl attachment-dropzone ${dragging ? 'attachment-dropzone-active' : ''}`}
        onDragOver={event => { if (roomCode && isActive && !isSending && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => { if (!roomCode || !isActive || isSending) return; event.preventDefault(); setDragging(false); uploads.add(Array.from(event.dataTransfer.files)); }}>
        <div className="chat-typing-row" data-active={Boolean(typingLabel)} role="status" aria-live="polite" aria-atomic="true">
          <div className="min-h-0 overflow-hidden">
            <p className="chat-typing-content flex items-center gap-2 px-1 pb-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="flex shrink-0 items-center gap-0.5 text-primary">
                <span className="size-1 rounded-full bg-current animate-chat-dot-1" />
                <span className="size-1 rounded-full bg-current animate-chat-dot-2" />
                <span className="size-1 rounded-full bg-current animate-chat-dot-3" />
              </span>
              <span className="truncate">{typingLabel || '\u00a0'}</span>
            </p>
          </div>
        </div>
        {aiActivity.length > 0 && <div className="mb-2 space-y-2">
          <AiActivityNotice activities={aiActivity} messages={messages} disabled={!isActive || isSending}
            onRetry={sendAiPrompt} onDismiss={onDismissAiActivity} />
        </div>}
        {(toolbar || roomCode && isActive) && (
          <div className="chat-composer-tools mb-2 flex min-w-0 items-center gap-2" role="group" aria-label="Công cụ thảo luận">
            {toolbar}
            {roomCode && isActive && <div className="ml-auto flex shrink-0">
              <AiSummaryButton onSend={sendAiPrompt} compact={Boolean(toolbar)}
                disabled={isSending || aiActivity.some(activity => !activity.error)} />
            </div>}
          </div>
        )}
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
            ref={textInput}
            type="text"
            value={inputText}
            onChange={event => {
              const text = event.target.value;
              setInputText(text);
              if (text.trim()) onTyping?.();
            }}
            disabled={!isActive || isSending}
            maxLength={2048}
            placeholder={isActive ? 'Nhập tin nhắn thảo luận...' : 'Phòng đã kết thúc'}
            onPaste={event => { if (roomCode && isActive && !isSending && event.clipboardData.files.length) { event.preventDefault(); uploads.add(Array.from(event.clipboardData.files)); } }}
            className={`w-full ${roomCode ? 'pl-11' : 'pl-3.5'} pr-26 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-2xs disabled:opacity-60`}
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
              onClick={() => {
                setInputText(prev => {
                  const trimmed = prev.trim();
                  if (!trimmed) return '@ai ';
                  if (/^[@/]ai(?:\s|$)/i.test(trimmed)) return prev;
                  return `@ai ${prev}`;
                });
                textInput.current?.focus();
              }}
              className="p-1 rounded-lg text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer disabled:opacity-40"
              title="Gọi AI Co-Host (@ai)"
              aria-label="Gọi AI Co-Host"
            >
              <Sparkles className="w-4 h-4" />
            </button>

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
