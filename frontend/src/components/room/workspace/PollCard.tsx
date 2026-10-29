import React, { useId, useRef, useState } from 'react';
import { CheckCircle2, Vote } from 'lucide-react';
import type { Poll, RoomStatus } from '../../../types/room';

interface PollCardProps {
  poll: Poll;
  polls?: Poll[];
  onSelectPoll?: (id: string) => void;
  onVotePoll: (optionIds: string[]) => void | Promise<boolean | void>;
  isVoting?: boolean;
  onClosePoll?: () => Promise<void>;
  roomStatus: RoomStatus;
  isHost?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, polls = [], onSelectPoll, onVotePoll,
  isVoting = false, onClosePoll, roomStatus, isHost = false }) => {
  const id = useId();
  const savedIds = poll.options.filter(option => option.votedByMe).map(option => option.id);
  const signature = JSON.stringify([poll.id, savedIds]);
  const [draft, setDraft] = useState<{ base: string; ids: string[] } | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const selectedIds = draft?.base === signature ? draft.ids : savedIds;
  const changed = savedIds.length !== selectedIds.length || savedIds.some(optionId => !selectedIds.includes(optionId));
  const busy = isVoting || sending;
  const canVote = roomStatus === 'ACTIVE' && !poll.isClosed;
  const highestVotes = Math.max(0, ...poll.options.map(option => option.votes));
  const instruction = !canVote ? 'Bình chọn đã kết thúc. Bạn có thể xem kết quả bên dưới.'
    : poll.allowMultiple ? 'Chọn một hoặc nhiều phương án rồi gửi. Bạn có thể bỏ chọn và cập nhật khi bình chọn còn mở.'
    : 'Chọn 1 phương án rồi gửi. Bạn có thể đổi hoặc rút phiếu khi bình chọn còn mở.';
  const send = async () => {
    if (!canVote || !changed || busy || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      if (await onVotePoll(selectedIds) !== false) setDraft(null);
    } finally { inFlight.current = false; setSending(false); }
  };

  return <div className="w-full max-w-xl mx-auto space-y-2">
    {polls.length > 1 && <label className="block text-xs font-medium text-muted-foreground">Đang xem bình chọn
      <select aria-label="Chọn cuộc bình chọn" value={poll.id} disabled={busy} onChange={event => onSelectPoll?.(event.target.value)}
        className="mt-1 w-full rounded-xl p-2.5 text-sm bg-card text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary">
        {polls.map(item => <option key={item.id} value={item.id}>{item.question} · {item.isClosed ? 'Đã kết thúc' : 'Đang mở'}</option>)}
      </select>
    </label>}
    <section data-poll-card="true" aria-label="Cuộc bình chọn" tabIndex={-1}
      className="p-4 rounded-2xl bg-card border border-primary/30 shadow-xs space-y-3 focus-visible:outline-2 focus-visible:outline-primary">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary-text"><Vote className="w-4 h-4" /> Bình chọn</span>
          <span className={`ws-badge ${canVote ? 'bg-accent-soft text-accent-text' : 'bg-card-muted text-muted-foreground'}`}>{canVote ? 'Đang nhận phiếu' : 'Đã kết thúc'}</span>
        </div>
        <h3 className="text-base font-bold text-foreground break-words [overflow-wrap:anywhere]">{poll.question}</h3>
        <p id={`${id}-instruction`} className="text-xs leading-relaxed text-muted-foreground">{instruction}</p>
      </header>
      <fieldset disabled={busy || !canVote} aria-describedby={`${id}-instruction`} className="space-y-2 min-w-0">
        <legend className="sr-only">{poll.question}</legend>
        {poll.options.map(option => {
          const pct = poll.totalVotes ? Math.round(option.votes / poll.totalVotes * 100) : 0;
          const checked = selectedIds.includes(option.id);
          return <label key={option.id} className={`block relative rounded-xl border overflow-hidden ${checked ? 'border-primary bg-primary-soft/30' : 'border-border bg-card-muted/40'} ${canVote && !busy ? 'cursor-pointer hover:border-primary/60' : 'cursor-default'}`}>
            <span aria-hidden="true" className="absolute inset-0 origin-left bg-primary/10 transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
            <span className="relative flex items-start gap-2.5 p-3">
              {canVote ? <input type={poll.allowMultiple ? 'checkbox' : 'radio'} name={`${id}-option`} aria-label={option.text}
                checked={checked} disabled={busy} onChange={() => setDraft({ base: signature, ids: poll.allowMultiple
                  ? checked ? selectedIds.filter(item => item !== option.id) : [...selectedIds, option.id] : [option.id] })}
                className="mt-0.5 w-4 h-4 shrink-0 accent-primary" />
                : option.votedByMe ? <CheckCircle2 aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-primary" /> : null}
              <span className="min-w-0 flex-1 text-sm text-foreground break-words [overflow-wrap:anywhere]">{option.text}
                {option.votedByMe && <span className="block text-xs font-semibold text-primary-text">Phiếu hiện tại của bạn</span>}
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground"><strong className="block text-sm text-primary-text">{pct}%</strong>{option.votes} phiếu</span>
            </span>
          </label>;
        })}
      </fieldset>
      <div role="status" className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span>{poll.totalVotes} phiếu · {canVote ? 'Kết quả trực tiếp' : 'Kết quả cuối cùng'}</span>
        {savedIds.length > 0 && <span className="text-primary-text font-semibold">✓ Bạn đã bỏ phiếu</span>}
      </div>
      {poll.allowMultiple && <p className="text-xs text-muted-foreground">Tỷ lệ tính trên tổng số phiếu cho các phương án, không phải số người tham gia.</p>}
      {canVote && <div className="space-y-2">
        <p aria-live="polite" className="text-xs text-muted-foreground break-words">{changed ? selectedIds.length
          ? `Sắp gửi: ${poll.options.filter(option => selectedIds.includes(option.id)).map(option => option.text).join(', ')}`
          : 'Sắp rút tất cả phiếu của bạn.' : savedIds.length ? 'Bạn có thể thay đổi lựa chọn rồi cập nhật phiếu.' : 'Bạn chưa chọn phương án.'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!changed || busy} onClick={() => void send()}
            className="flex-1 rounded-xl px-4 py-2.5 bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Đang gửi phiếu...' : savedIds.length ? 'Cập nhật phiếu' : 'Gửi phiếu'}
          </button>
          {selectedIds.length > 0 && <button type="button" disabled={busy} onClick={() => setDraft({ base: signature, ids: [] })}
            className="rounded-xl px-3 py-2 text-xs font-semibold border border-border text-muted-foreground disabled:opacity-50">{savedIds.length ? 'Rút phiếu' : 'Bỏ chọn'}</button>}
        </div>
      </div>}
      {!canVote && <p className="text-xs text-muted-foreground break-words">{highestVotes ? <>Dẫn đầu: <strong className="text-foreground">{poll.options.filter(option => option.votes === highestVotes).map(option => option.text).join(', ')}</strong> · {highestVotes} phiếu</> : 'Chưa có phiếu nào.'}</p>}
      {isHost && canVote && onClosePoll && <footer className="border-t border-border pt-3 space-y-2">
        <p className="text-xs text-muted-foreground">Dành cho host · Kết thúc để ngừng nhận thay đổi và giữ lại kết quả.</p>
        <button type="button" onClick={() => void onClosePoll()} disabled={busy} className="w-full rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-card-muted disabled:opacity-50">Kết thúc bình chọn</button>
      </footer>}
    </section>
  </div>;
};
