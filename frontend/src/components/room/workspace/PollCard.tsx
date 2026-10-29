import React from 'react';
import { Vote } from 'lucide-react';
import type { Poll, RoomStatus } from '../../../types/room';

interface PollCardProps {
  poll: Poll;
  polls?: Poll[];
  onSelectPoll?: (id: string) => void;
  onVotePoll: (optionId: string) => void;
  isVoting?: boolean;
  onClosePoll?: () => Promise<void>;
  roomStatus: RoomStatus;
  isHost?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  polls = [],
  onSelectPoll,
  onVotePoll,
  isVoting = false,
  onClosePoll,
  roomStatus,
  isHost = false,
}) => {
  const isPollClosed = poll.isClosed;
  const highestVotes = Math.max(0, ...poll.options.map(option => option.votes));
  const leadingOptions = poll.options.filter(option => option.votes === highestVotes);
  const isActive = roomStatus === 'ACTIVE';

  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      {polls.length > 1 && (
        <select
          aria-label="Chọn cuộc bình chọn"
          value={poll.id}
          onChange={e => onSelectPoll?.(e.target.value)}
          disabled={isVoting}
          className="w-full block rounded-xl p-2 text-xs bg-card text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          {polls.map(item => (
            <option key={item.id} value={item.id}>
              {item.question}{item.isClosed ? ' (Đã đóng)' : ''}
            </option>
          ))}
        </select>
      )}

      <section
        data-poll-card="true"
        aria-label="Cuộc bình chọn"
        className="p-3.5 rounded-2xl bg-card border border-primary/30 shadow-xs space-y-2.5 animate-fade-slide-up"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Vote className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {poll.question}
            </h3>
          </div>
          <span
            className={`ws-badge text-xs py-0.5 ${
              isPollClosed
                ? 'bg-card-muted text-muted-foreground'
                : 'bg-accent-soft text-accent-text animate-pulse'
            }`}
          >
            {isPollClosed ? 'Đã đóng' : 'Đang mở'}
          </span>
        </div>

        <div className="space-y-1.5">
          {poll.options.map(opt => {
            const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
            const canVote =
              isActive &&
              !isPollClosed &&
              !isVoting &&
              !opt.votedByMe &&
              (poll.allowMultiple || !poll.options.some(o => o.votedByMe));

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onVotePoll(opt.id)}
                disabled={!canVote}
                className={`w-full relative p-2.5 rounded-xl text-left text-xs font-medium border transition-colors duration-200 overflow-hidden ${
                  opt.votedByMe
                    ? 'border-primary bg-primary-soft/30 ring-1 ring-primary/40'
                    : 'border-border bg-card-muted/60 hover:bg-card-muted'
                } ${canVote ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className="absolute inset-0 origin-left bg-primary/15 transition-transform duration-500 ease-out"
                  style={{ transform: `scaleX(${pct / 100})` }}
                />
                <div className="relative flex items-center justify-between gap-2 z-10">
                  <span className="text-foreground text-xs font-medium break-words">
                    {opt.text} {opt.votedByMe && <span className="text-primary font-bold">(Bạn)</span>}
                  </span>
                  <span className="font-bold text-primary-text font-mono text-xs shrink-0">
                    {pct}% ({opt.votes})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span className="truncate">
            Dẫn đầu:{' '}
            <strong className="text-primary-text font-semibold">
              {highestVotes > 0 ? leadingOptions.map(o => o.text).join(', ') : 'Chưa có'}
            </strong>{' '}
            ({highestVotes} phiếu)
          </span>
          {isHost && !isPollClosed && onClosePoll && (
            <button
              type="button"
              onClick={() => void onClosePoll()}
              disabled={!isActive}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-accent text-white hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer shrink-0 disabled:opacity-50"
            >
              Đóng bình chọn
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
