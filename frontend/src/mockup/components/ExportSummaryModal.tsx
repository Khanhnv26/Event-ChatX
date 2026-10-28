import { useEffect, useRef, useState } from 'react';
import { eventChatApi } from '../../services/eventChatApi';
import type { RoomExportResponse } from '../../types/backend.types';
import { toast } from '../../stores/toastStore';

interface Props {
  isOpen: boolean;
  roomCode: string;
  onClose: () => void;
}

export function ExportSummaryModal({ isOpen, roomCode, onClose }: Props) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${roomCode}:${attempt}`;
  const [result, setResult] = useState<{
    key: string; report: RoomExportResponse | null; error: string | null;
  } | null>(null);
  const report = result?.key === requestKey ? result.report : null;
  const error = result?.key === requestKey ? result.error : null;
  const loading = result?.key !== requestKey;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const previous = document.activeElement;
    closeRef.current?.focus();
    void eventChatApi.exportSummary(roomCode).then(data => {
      if (active) setResult({ key: requestKey, report: data, error: null });
    }).catch(err => {
      if (active) setResult({ key: requestKey, report: null,
        error: err instanceof Error ? err.message : 'Không thể xuất biên bản' });
    });
    return () => { active = false; if (previous instanceof HTMLElement) previous.focus(); };
  }, [isOpen, roomCode, requestKey]);

  if (!isOpen) return null;
  const copy = async () => {
    if (!report) return;
    try { await navigator.clipboard.writeText(report.markdownSummary); toast.success('Đã sao chép biên bản.'); }
    catch { toast.error('Không thể sao chép. Bạn có thể tải file Markdown.'); }
  };
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.markdownSummary], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `EventChat_${roomCode}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    if (!report) return;
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: report.roomTitle, text: report.markdownSummary }); }
    catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) toast.error('Không thể chia sẻ biên bản.');
    }
  };
  return <div className="motion-overlay fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center">
    <section role="dialog" aria-modal="true" aria-labelledby="export-title"
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
      className="motion-dialog max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <h2 id="export-title" className="font-bold text-lg">Biên bản phòng</h2>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border px-3 py-2">Đóng</button>
      </div>
      {loading && <p role="status">Đang tải biên bản từ máy chủ...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
      {report && <>
        <p className="text-xs text-slate-500">Xuất lúc {new Date(report.exportedAt).toLocaleString('vi-VN')} · {report.participantCount} thành viên</p>
        <pre className="whitespace-pre-wrap break-words text-sm bg-slate-50 dark:bg-slate-800 rounded-xl p-4">{report.markdownSummary}</pre>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void copy()} className="rounded-xl bg-indigo-600 text-white px-4 py-2">Sao chép Markdown</button>
          <button type="button" onClick={download} className="rounded-xl border px-4 py-2">Tải Markdown</button>
          <button type="button" onClick={() => void share()} className="rounded-xl border px-4 py-2">Chia sẻ</button>
        </div>
      </>}
    </section>
  </div>;
}
