import React, { useEffect, useRef, useState } from 'react';

export const EMOJI_CATEGORIES = [
  {
    id: 'frequent',
    name: 'Phổ biến',
    emojis: ['👍', '❤️', '👏', '😂', '🎉', '🔥', '✨', '🙋‍♂️', '🙏', '💯', '😊', '😍']
  },
  {
    id: 'faces',
    name: 'Cảm xúc',
    emojis: ['😁', '🤣', '😅', '😆', '😉', '🥰', '😘', '😋', '😎', '🥳', '🤔', '🤨', '😐', '🙄', '😬', '😮', '😴', '🥺', '😭', '🤯']
  },
  {
    id: 'hands',
    name: 'Cử chỉ',
    emojis: ['👋', '🤝', '✌️', '🤞', '🤟', '🤙', '👌', '🤌', '👈', '👉', '👆', '👇', '✋', '💪', '🫡', '👎', '🙌', '👐', '🤲', '👀']
  },
  {
    id: 'work',
    name: 'Biểu tượng',
    emojis: ['💡', '🎯', '📌', '🚀', '⏳', '⏰', '💬', '📢', '🔔', '❓', '❗', '✅', '❌', '⚠️', '⭐', '☕', '💻', '📝', '📊', '🏆']
  }
];

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji, triggerRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && !triggerRef?.current?.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const displayedCategories = activeTab === 'all'
    ? EMOJI_CATEGORIES
    : EMOJI_CATEGORIES.filter(c => c.id === activeTab);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 z-50 mb-2 flex max-h-[min(22rem,50dvh)] w-[340px] max-w-full flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xl backdrop-blur-md page-enter"
      role="dialog"
      aria-label="Bảng chọn biểu tượng cảm xúc"
    >
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-border/60 pb-2.5 pt-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`h-8 px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all flex items-center justify-center ${
            activeTab === 'all'
              ? 'bg-primary text-white shadow-2xs font-semibold'
              : 'text-muted-foreground hover:bg-card-muted hover:text-foreground'
          }`}
        >
          Tất cả
        </button>
        {EMOJI_CATEGORIES.map(category => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveTab(category.id)}
            className={`h-8 px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all flex items-center justify-center ${
              activeTab === category.id
                ? 'bg-primary text-white shadow-2xs font-semibold'
                : 'text-muted-foreground hover:bg-card-muted hover:text-foreground'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="min-h-0 max-h-60 space-y-3 overflow-y-auto pr-1 select-none" data-native-scroll>
        {displayedCategories.map(category => (
          <div key={category.id}>
            {activeTab === 'all' && (
              <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground/80 mb-1.5 px-1">
                {category.name}
              </p>
            )}
            <div className="grid grid-cols-7 gap-1.5 justify-items-center">
              {category.emojis.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="flex h-9 w-full min-w-0 max-w-9 cursor-pointer items-center justify-center rounded-xl text-lg transition-all hover:scale-115 hover:bg-primary-soft active:scale-95"
                  title={emoji}
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
