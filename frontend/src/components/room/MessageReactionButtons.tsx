import { useId, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { ReactionEmoji, ReactionResponse } from '../../types/backend.types';

const emojis: { key: ReactionEmoji; symbol: string; label: string }[] = [
  { key: 'HEART', symbol: '❤️', label: 'Yêu thích' },
  { key: 'THUMBS_UP', symbol: '👍', label: 'Đồng ý' },
  { key: 'LAUGH', symbol: '😂', label: 'Buồn cười' },
  { key: 'CLAP', symbol: '👏', label: 'Vỗ tay' },
  { key: 'RAISED_HAND', symbol: '🙋‍♂️', label: 'Giơ tay' },
];

interface MessageReactionButtonsProps {
  reactions?: ReactionResponse[];
  onSetReaction?: (emoji: ReactionEmoji, active: boolean) => void;
}

export function MessageReactionButtons({ reactions = [], onSetReaction }: MessageReactionButtonsProps) {
  const pickerId = useId();
  const pickerButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  if (!onSetReaction && !reactions.length) return null;

  const closePicker = () => {
    setOpen(false);
    pickerButton.current?.focus();
  };
  return <div className="flex max-w-full flex-wrap items-center gap-1.5" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      closePicker();
    }
  }}>
    {emojis.map(emoji => {
      const reaction = reactions.find(item => item.emoji === emoji.key);
      if (!reaction) return null;
      const content = <><span aria-hidden="true">{emoji.symbol}</span><span>{reaction.count}</span></>;
      return onSetReaction
        ? <button key={emoji.key} type="button" aria-label={`${emoji.label}, ${reaction.count} lượt`}
            aria-pressed={reaction.reactedByMe} className="ws-chip gap-1 aria-pressed:border-primary/50 aria-pressed:bg-primary-soft"
            onClick={() => onSetReaction(emoji.key, !reaction.reactedByMe)}>{content}</button>
        : <span key={emoji.key} aria-label={`${emoji.label}, ${reaction.count} lượt`}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs">{content}</span>;
    })}
    {onSetReaction && <button ref={pickerButton} type="button" className="ws-icon-btn min-h-8 min-w-8"
      aria-label="Thả cảm xúc" title="Thả cảm xúc" aria-expanded={open} aria-controls={open ? pickerId : undefined}
      onClick={() => setOpen(previous => !previous)}>
      <SmilePlus aria-hidden="true" className="size-4" />
    </button>}
    {open && onSetReaction && <div id={pickerId} role="group" aria-label="Chọn cảm xúc"
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-xs">
      {emojis.map(emoji => {
        const reacted = reactions.some(item => item.emoji === emoji.key && item.reactedByMe);
        return <button key={emoji.key} type="button" className="ws-icon-btn min-h-9 min-w-9 text-base"
          aria-label={`${reacted ? 'Gỡ' : 'Thả'} ${emoji.label}`} aria-pressed={reacted}
          onClick={() => { closePicker(); onSetReaction(emoji.key, !reacted); }}>
          <span aria-hidden="true">{emoji.symbol}</span>
        </button>;
      })}
    </div>}
  </div>;
}
