import { Check, FileText, LoaderCircle, RotateCcw, X } from 'lucide-react';
import type { AttachmentDraft } from '../../../hooks/useAttachmentUploads';
import { formatFileSize } from '../../../services/attachmentApi';

const labels = { queued: 'Đang chờ', uploading: 'Đang tải', ready: 'Sẵn sàng', error: 'Chưa tải được' };

export function AttachmentDraftList({ drafts, disabled, onRemove, onRetry }: {
  drafts: AttachmentDraft[]; disabled: boolean; onRemove: (id: string) => void; onRetry: (id: string) => void;
}) {
  if (!drafts.length) return null;
  return <ul aria-label="Tệp đính kèm đang soạn" className="attachment-drafts grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 mb-2">
    {drafts.map(draft => <li key={draft.id} className="attachment-draft flex gap-2.5 min-w-0 rounded-xl border border-border bg-card-muted p-2.5">
      <div className="h-12 w-12 rounded-lg bg-card border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {draft.previewUrl ? <img src={draft.previewUrl} alt="" className="w-full h-full object-cover" /> : <FileText className="h-5 w-5 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground" title={draft.file.name}>{draft.file.name}</p>
        <p className="text-[11px] text-muted-foreground">{formatFileSize(draft.file.size)}</p>
        <span className={`flex items-center gap-1 text-[11px] ${draft.state === 'error' ? 'text-danger' : draft.state === 'ready' ? 'text-accent-text' : 'text-muted-foreground'}`}>
          {draft.state === 'ready' ? <Check className="w-3 h-3" /> : draft.state === 'uploading' ? <LoaderCircle className="w-3 h-3 animate-spin" /> : null}
          {labels[draft.state]}{draft.state === 'uploading' ? ` ${draft.progress}%` : ''}
        </span>
        {draft.state === 'uploading' && <div role="progressbar" aria-label={`Đang tải ${draft.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={draft.progress}
          className="h-1 rounded-full overflow-hidden bg-border mt-1.5"><div className="attachment-progress h-full bg-primary origin-left" style={{ transform: `scaleX(${draft.progress / 100})` }} /></div>}
        {draft.error && draft.state !== 'ready' && <p className="text-[11px] text-danger mt-1 break-words" role={draft.state === 'error' ? 'alert' : undefined}>{draft.error}</p>}
      </div>
      <div className="flex flex-col shrink-0 gap-1">
        <button type="button" disabled={disabled} onClick={() => onRemove(draft.id)} className="ws-icon-btn p-1" aria-label={`Bỏ ${draft.file.name}`}><X className="w-3.5 h-3.5" /></button>
        {draft.state === 'error' && <button type="button" disabled={disabled} onClick={() => onRetry(draft.id)} className="ws-icon-btn p-1 text-primary" aria-label={`Thử lại ${draft.file.name}`}><RotateCcw className="w-3.5 h-3.5" /></button>}
      </div>
    </li>)}
  </ul>;
}
