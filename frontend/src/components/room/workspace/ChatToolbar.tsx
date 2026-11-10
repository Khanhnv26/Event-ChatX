import React from 'react';
import { Disc, Plus, Vote } from 'lucide-react';
import type { RoomStatus } from '../../../types/room';

interface ChatToolbarProps {
  onScrollToPoll: () => void;
  onOpenWheelModal: () => void;
  onOpenAddDecision?: () => void;
  roomStatus: RoomStatus;
}

export const ChatToolbar: React.FC<ChatToolbarProps> = ({
  onScrollToPoll,
  onOpenWheelModal,
  onOpenAddDecision,
  roomStatus,
}) => {
  const isActive = roomStatus === 'ACTIVE';

  return (
    <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label="Công cụ tương tác">
      <button
        type="button"
        onClick={onScrollToPoll}
        className="ws-chip chat-tool-action min-h-8"
        title="Danh sách bình chọn"
        aria-label="Bình chọn"
      >
        <Vote className="w-3.5 h-3.5 text-primary" />
        <span className="chat-tool-label">Bình chọn</span>
      </button>

      <button
        type="button"
        onClick={onOpenWheelModal}
        disabled={!isActive}
        className="ws-chip chat-tool-action min-h-8"
        title="Quay thưởng may mắn"
        aria-label="Vòng quay"
      >
        <Disc className="size-3.5 text-warn-text" />
        <span className="chat-tool-label">Vòng quay</span>
      </button>

      {onOpenAddDecision && (
        <button
          type="button"
          onClick={onOpenAddDecision}
          disabled={!isActive}
          className="ws-chip chat-tool-action min-h-8"
          title="Đề xuất quyết định mới"
          aria-label="Đề xuất quyết định"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
          <span className="chat-tool-label">Đề xuất</span>
        </button>
      )}
    </div>
  );
};
