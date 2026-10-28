import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useId } from 'react';
import { ModalPortal } from '../common/ModalPortal';

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ title, description, confirmLabel, pendingLabel = 'Đang xử lý…', pending = false, onClose, onConfirm }: Props) {
  const id = useId();
  return <ModalPortal onClose={onClose} dismissible={!pending}>
    <div className="motion-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70">
      <section role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
        aria-busy={pending} data-native-scroll className="motion-dialog relative w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card text-foreground p-5 sm:p-6 shadow-2xl">
        <button type="button" aria-label="Đóng cửa sổ xác nhận" disabled={pending} onClick={onClose} className="ws-icon-btn absolute top-4 right-4"><X className="w-5 h-5" /></button>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6" /></div>
        <h2 id={`${id}-title`} className="pr-6 text-lg font-bold break-words">{title}</h2>
        <p id={`${id}-description`} className="mt-2 text-sm leading-relaxed text-muted-foreground break-words">{description}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <button data-modal-autofocus type="button" disabled={pending} onClick={onClose} className="tool-interactive flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Hủy bỏ</button>
          <button type="button" disabled={pending} onClick={onConfirm} className="tool-interactive flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}{pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  </ModalPortal>;
}
