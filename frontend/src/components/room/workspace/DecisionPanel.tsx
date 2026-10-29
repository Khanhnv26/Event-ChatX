import React, { useState, useEffect, useRef } from 'react';
import { Check, CheckCircle2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { DecisionCard, RoomStatus } from '../../../types/room';
import { DecisionMetadata } from './DecisionMetadata';

interface DecisionPanelProps {
  decisions: DecisionCard[];
  roomStatus: RoomStatus;
  isHost?: boolean;
  currentGuestId?: string;
  onRemoveDecision?: (id: string) => Promise<boolean>;
  mobile?: boolean;
  showForm?: boolean;
  onToggleForm?: (show: boolean) => void;
  onConfirmDecision: (decisionId: string) => Promise<boolean> | boolean | void;
  onAddDecision: (title: string, details: string) => Promise<boolean> | boolean | void;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({
  decisions,
  roomStatus,
  isHost = false,
  currentGuestId,
  onRemoveDecision,
  mobile = false,
  showForm: externalShowForm,
  onToggleForm: externalOnToggleForm,
  onConfirmDecision,
  onAddDecision,
}) => {
  const [internalShowForm, setInternalShowForm] = useState(false);
  const showForm = externalShowForm !== undefined ? externalShowForm : internalShowForm;
  const setShowForm = externalOnToggleForm || setInternalShowForm;

  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [justConfirmedId, setJustConfirmedId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const removePending = useRef(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const ok = await onAddDecision(newTitle, newDetails);
    if (ok === false) return;
    setNewTitle('');
    setNewDetails('');
    setShowForm(false);
  };

  const handleConfirm = async (id: string) => {
    const ok = await onConfirmDecision(id);
    if (ok === false) return;
    setJustConfirmedId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setJustConfirmedId(null), 1500);
  };

  const confirmedCount = decisions.filter(d => d.status === 'CONFIRMED').length;
  const isActive = roomStatus === 'ACTIVE';
  const visible = decisions.filter(d => d.status !== 'DELETED' && d.status !== 'WITHDRAWN' && d.status !== 'REJECTED');
  const archived = decisions.filter(d => !visible.includes(d));
  const handleRemove = async (id: string) => {
    if (!onRemoveDecision || removePending.current) return;
    removePending.current = true;
    setRemoving(true);
    try { if (await onRemoveDecision(id)) setRemoveId(null); }
    finally { removePending.current = false; setRemoving(false); }
  };

  return (
    <div className={`${mobile ? '' : 'flex-1 min-h-0'} flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-foreground">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <span>Quyết định</span>
        </span>
        <span className="text-xs font-semibold text-accent-text">
          {confirmedCount} đã chốt
        </span>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="tool-view p-3 rounded-2xl bg-primary-soft/40 border border-primary/30 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary-text flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Đề xuất quyết định
            </span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="ws-icon-btn p-1"
              aria-label="Đóng biểu mẫu đề xuất"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Tiêu đề quyết định..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Ghi chú thêm hoặc bằng chứng (tùy chọn)..."
            value={newDetails}
            onChange={e => setNewDetails(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-card-muted transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90 cursor-pointer shadow-xs active:opacity-80 transition-opacity"
            >
              Ghim quyết định
            </button>
          </div>
        </form>
      )}

      <div data-native-scroll className={`decision-list space-y-2 p-1 ${mobile ? '' : 'flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]'}`} tabIndex={0} aria-label="Danh sách quyết định">
        {visible.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            Chưa có đề xuất hoặc quyết định nào
          </div>
        ) : (
          visible.map(dec => {
            const isConfirmed = dec.status === 'CONFIRMED';
            const isJustConfirmed = justConfirmedId === dec.id;

            return (
              <article
                key={dec.id}
                data-highlighted={isJustConfirmed}
                className={`decision-card tool-list-item min-w-0 p-2.5 rounded-xl border text-xs ${
                  isConfirmed
                    ? 'bg-card border-border'
                    : 'bg-warn-soft/50 border-amber-300/60 dark:border-amber-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="min-w-0 flex-1 font-bold text-foreground leading-snug break-words">
                    {dec.title}
                  </span>
                  <span
                    className={`ws-badge text-[12px] py-0.5 ${
                      isConfirmed
                        ? 'bg-accent-soft text-accent-text'
                        : 'bg-warn-soft text-warn-text'
                    }`}
                  >
                    {isConfirmed ? 'Đã chốt' : 'Đề xuất'}
                  </span>
                </div>
                {dec.details && (
                  <p className="text-xs text-muted-foreground mb-1.5 break-words">
                    {dec.details}
                  </p>
                )}
                <DecisionMetadata decision={dec} />
                {isActive && onRemoveDecision && (isHost || (!isConfirmed && currentGuestId === dec.creatorGuestId && Boolean(currentGuestId))) && (
                  removeId === dec.id ? <div className="mt-2 rounded-lg border border-border p-2 space-y-2">
                    <p className="text-xs text-muted-foreground">{isConfirmed ? 'Thu hồi quyết định này? Kết quả cũ vẫn được giữ trong lịch sử.' : 'Xóa đề xuất này khỏi danh sách?'}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={removing} onClick={() => void handleRemove(dec.id)} className="rounded-lg bg-danger px-2.5 py-1.5 text-white disabled:opacity-50">{removing ? 'Đang xử lý...' : isConfirmed ? 'Xác nhận thu hồi' : 'Xác nhận xóa'}</button>
                      <button type="button" disabled={removing} onClick={() => setRemoveId(null)} className="rounded-lg border border-border px-2.5 py-1.5">Hủy</button>
                    </div>
                  </div> : <button type="button" onClick={() => setRemoveId(dec.id)} className="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground hover:text-danger hover:bg-danger-soft" aria-label={`${isConfirmed ? 'Thu hồi quyết định' : 'Xóa đề xuất'}: ${dec.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />{isConfirmed ? 'Thu hồi' : 'Xóa đề xuất'}
                  </button>
                )}
                {dec.status === 'PROPOSED' && isActive && (
                  <div className="flex justify-end pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => void handleConfirm(dec.id)}
                      className="px-2.5 py-1 rounded-lg bg-accent text-white font-bold text-xs cursor-pointer flex items-center gap-1 hover:opacity-90 active:opacity-80 transition-opacity"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isHost ? 'Chốt quyết định' : 'Tán thành'}</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
        {archived.length > 0 && <details className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold">Lịch sử đã xóa / thu hồi ({archived.length})</summary>
          <div className="mt-2 space-y-2">{archived.map(dec => <article key={dec.id} className="rounded-xl border border-border p-2.5 break-words">
            <span className="block font-semibold">{dec.title}</span>
            <span className="block mt-1">{dec.status === 'WITHDRAWN' ? 'Đã thu hồi' : dec.status === 'REJECTED' ? 'Đã từ chối' : 'Đã xóa đề xuất'}</span>
            <DecisionMetadata decision={dec} />
          </article>)}</div>
        </details>}
      </div>

      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={!isActive}
        className="ws-btn ws-btn-soft shrink-0"
      >
        <Plus className="w-4 h-4 text-primary group-hover:text-white" />
        <span>Thêm quyết định</span>
      </button>
    </div>
  );
};
