import { memo, useEffect, useRef, useState } from 'react';
import { Download, FileText, ImageOff, LoaderCircle } from 'lucide-react';
import { MotionPresence } from '../common/MotionPresence';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import { attachmentApi, formatFileSize } from '../../services/attachmentApi';
import type { AttachmentResponse } from '../../types/backend.types';
import { ImagePreviewModal } from './ImagePreviewModal';

function ImageCard({ slug, attachment, onOpen }: { slug: string; attachment: AttachmentResponse; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const { url, error } = useAttachmentUrl(slug, attachment.publicId, true, visible);
  useEffect(() => {
    if (!ref.current || visible || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return <button ref={ref} type="button" onClick={onOpen} aria-label={`Xem ảnh ${attachment.filename}`}
    className="attachment-image group relative w-full max-w-72 overflow-hidden rounded-xl bg-card-muted border border-border focus-visible:outline-2 focus-visible:outline-primary"
    style={{ aspectRatio: `${attachment.width || 4} / ${attachment.height || 3}`, maxHeight: 280 }}>
    {url ? <img src={url} alt={attachment.filename} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      : <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">{error ? <ImageOff className="w-6 h-6" /> : <LoaderCircle className="w-5 h-5 animate-spin" />}</span>}
    <span className="absolute bottom-0 inset-x-0 truncate bg-slate-950/60 text-white text-[10px] p-2 text-left">{attachment.filename}</span>
  </button>;
}

export const MessageAttachments = memo(function MessageAttachments({ slug, attachments }: {
  slug?: string; attachments?: AttachmentResponse[];
}) {
  const [selected, setSelected] = useState<AttachmentResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!slug || !attachments?.length) return null;
  const download = async (attachment: AttachmentResponse) => {
    if (downloading) return;
    setDownloading(attachment.publicId);
    setError(null);
    try { await attachmentApi.download(slug, attachment); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể tải tệp.'); }
    finally { setDownloading(null); }
  };
  return <div className="mt-1.5 grid gap-2 w-full min-w-0">
    {attachments.map(attachment => attachment.contentType?.startsWith('image/')
      ? <ImageCard key={attachment.publicId} slug={slug} attachment={attachment} onOpen={() => { setSelected(attachment); setOpen(true); }} />
      : <button key={attachment.publicId} type="button" disabled={downloading !== null} onClick={() => void download(attachment)}
          className="attachment-file flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card text-foreground min-w-0 text-left hover:border-primary/50 disabled:opacity-60" aria-label={`Tải ${attachment.filename}`}>
          <FileText className="h-8 w-8 text-primary shrink-0" />
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{attachment.filename}</span><span className="block text-[11px] text-muted-foreground mt-0.5">{formatFileSize(attachment.sizeBytes)}</span></span>
          {downloading === attachment.publicId ? <LoaderCircle className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>)}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <MotionPresence open={open}>{selected && <ImagePreviewModal slug={slug} attachment={selected} onClose={() => setOpen(false)} />}</MotionPresence>
  </div>;
});
