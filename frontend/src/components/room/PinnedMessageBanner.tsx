import { useState } from 'react';
import { Pin, PinOff, X } from 'lucide-react';
import type { ChatMessage } from '../../types/room';
import { isMotionEnabled } from '../../services/motionPreference';
import { MessageAttachments } from '../attachments/MessageAttachments';
import { ModalPortal } from '../common/ModalPortal';

interface PinnedMessageBannerProps {
  message: ChatMessage;
  roomCode: string;
  onUnpin?: () => void;
}

export function PinnedMessageBanner({ message, roomCode, onUnpin }: PinnedMessageBannerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const openOriginal = () => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find(element => element.dataset.messageId === message.id);
    if (!target) {
      setPreviewOpen(true);
      return;
    }
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'center', behavior: isMotionEnabled() ? 'smooth' : 'auto' });
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 sm:px-4">
        <Pin aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <button type="button" onClick={openOriginal} aria-label="Mở tin nhắn đã ghim"
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary">
          <span className="block text-xs font-semibold text-primary-text">Tin nhắn đã ghim</span>
          <span className="block truncate text-xs text-muted-foreground">{message.content || 'Tệp đính kèm'}</span>
        </button>
        {onUnpin && <button type="button" className="ws-icon-btn min-h-8 min-w-8" onClick={onUnpin}
          aria-label="Bỏ ghim tin nhắn" title="Bỏ ghim tin nhắn"><PinOff aria-hidden="true" className="size-4" /></button>}
      </div>
      {previewOpen && <ModalPortal onClose={() => setPreviewOpen(false)}>
        <div className="motion-overlay fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="pinned-message-title" data-native-scroll
            className="motion-dialog max-h-[80dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl">
            <header className="flex items-center justify-between gap-3">
              <h2 id="pinned-message-title" className="text-sm font-bold">Tin nhắn đã ghim</h2>
              <button type="button" data-modal-autofocus className="ws-icon-btn" onClick={() => setPreviewOpen(false)}
                aria-label="Đóng tin nhắn ghim"><X aria-hidden="true" className="size-4" /></button>
            </header>
            <p className="text-xs text-muted-foreground">{message.senderName} · {message.createdAt}</p>
            {message.content && <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{message.content}</p>}
            <MessageAttachments slug={roomCode} attachments={message.attachments} />
          </section>
        </div>
      </ModalPortal>}
    </>
  );
}
