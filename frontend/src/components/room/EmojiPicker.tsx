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
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayedCategories = activeTab === 'all'
    ? EMOJI_CATEGORIES
    : EMOJI_CATEGORIES.filter(c => c.id === activeTab);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 mb-2 w-72 sm:w-80 max-h-80 rounded-2xl border border-border bg-card p-3 shadow-xl backdrop-blur-md z-50 flex flex-col gap-2 page-enter"
      role="dialog"
      aria-label="Bảng chọn biểu tượng cảm xúc"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-border/60 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-2xs'
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
              className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeTab === category.id
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:bg-card-muted hover:text-foreground'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto max-h-56 pr-1 space-y-2.5 select-none custom-scrollbar">
        {displayedCategories.map(category => (
          <div key={category.id}>
            {activeTab === 'all' && (
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 px-1">
                {category.name}
              </p>
            )}
            <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
              {category.emojis.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="h-9 w-9 rounded-xl hover:bg-primary-soft/60 hover:scale-110 active:scale-95 transition-all flex items-center justify-center text-lg cursor-pointer"
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
