import { useState } from 'react';
import { X } from 'lucide-react';
import { ModalPortal } from '../../../components/common/ModalPortal';
import type { Poll } from '../../types';

interface Props {
  polls: Poll[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate?: () => void;
}

export function PollListModal({ polls, selectedId, onSelect, onClose, onCreate }: Props) {
  const [filter, setFilter] = useState('all');
  const visible = polls.filter(p => filter === 'all' || (filter === 'closed' ? p.isClosed : !p.isClosed));
  return <ModalPortal onClose={onClose}>
    <div className="motion-overlay fixed inset-0 z-[100] bg-slate-950/70 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="poll-list-heading"
        className="motion-dialog w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl bg-card text-foreground border border-border p-5 shadow-xl">
        <header className="flex items-center justify-between gap-3">
          <h2 id="poll-list-heading" className="font-bold">Bình chọn · {polls.length}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng danh sách bình chọn" className="tool-interactive p-2 rounded-xl hover:bg-primary/5"><X className="w-5 h-5" /></button>
        </header>
        <div className="flex justify-between gap-3 my-3">
          <select aria-label="Lọc bình chọn" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-border bg-card p-2 text-sm">
            <option value="all">Tất cả</option><option value="open">Đang mở</option><option value="closed">Đã đóng</option>
          </select>
          {onCreate && <button type="button" onClick={onCreate} className="tool-interactive rounded-xl bg-primary px-3 py-2 text-sm text-white">Tạo bình chọn</button>}
        </div>
        <div key={filter} data-native-scroll className="tool-view min-h-0 overflow-y-auto space-y-2 p-1">
          {visible.length === 0 && <p className="p-4 text-sm text-muted-foreground">Chưa có bình chọn trong danh sách này.</p>}
          {visible.map((p, index) => <button key={p.id} type="button" aria-pressed={p.id === selectedId}
            style={{ animationDelay: `${Math.min(index, 7) * 24}ms` }}
            onClick={() => onSelect(p.id)} className="tool-list-item tool-interactive w-full rounded-2xl border border-border p-3 text-left hover:bg-primary/5 aria-pressed:border-primary">
            <span className="block font-semibold break-words">{p.question}</span>
            <span className="block mt-1 text-xs text-muted-foreground">{p.isClosed ? 'Đã đóng' : 'Đang mở'} · {p.totalVotes} phiếu</span>
          </button>)}
        </div>
      </section>
    </div>
  </ModalPortal>;
}
