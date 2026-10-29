import { Download, LoaderCircle, X } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import type { AttachmentResponse } from '../../types/backend.types';
import { attachmentApi } from '../../services/attachmentApi';
import { toast } from '../../stores/toastStore';

export function ImagePreviewModal({ slug, attachment, onClose }: {
  slug: string; attachment: AttachmentResponse; onClose: () => void;
}) {
  const { url, error } = useAttachmentUrl(slug, attachment.publicId, false);
  return <ModalPortal onClose={onClose}>
    <div className="motion-overlay fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`Xem ảnh ${attachment.filename}`} onClick={event => event.stopPropagation()}
        className="motion-dialog relative w-full max-w-4xl max-h-[90dvh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center gap-2 p-3 border-b border-border">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{attachment.filename}</p>
          <button type="button" className="ws-icon-btn p-2" aria-label="Tải ảnh xuống" onClick={() => void attachmentApi.download(slug, attachment).catch(() => toast.error('Không thể tải ảnh xuống.'))}><Download className="w-4 h-4" /></button>
          <button type="button" className="ws-icon-btn p-2" aria-label="Đóng xem ảnh" onClick={onClose}><X className="w-4 h-4" /></button>
        </header>
        <div className="min-h-40 min-w-0 overflow-auto p-2 flex justify-center items-center bg-card-muted">
          {url ? <img src={url} alt={attachment.filename} className="max-w-full max-h-[75dvh] object-contain rounded-lg" />
            : error ? <p role="alert" className="text-sm text-danger p-6">{error}</p>
              : <LoaderCircle role="status" aria-label="Đang tải ảnh" className="w-7 h-7 text-primary animate-spin" />}
        </div>
      </section>
    </div>
  </ModalPortal>;
}
