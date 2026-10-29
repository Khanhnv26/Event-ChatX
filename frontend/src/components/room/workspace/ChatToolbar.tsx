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
    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5" role="toolbar" aria-label="Công cụ tương tác">
      <button
        type="button"
        onClick={onScrollToPoll}
        className="ws-chip"
        title="Danh sách bình chọn"
      >
        <Vote className="w-3.5 h-3.5 text-primary" />
        <span>Bình chọn</span>
      </button>

      <button
        type="button"
        onClick={onOpenWheelModal}
        disabled={!isActive}
        className="ws-chip group"
        title="Quay thưởng may mắn"
      >
        <Disc
          className="w-3.5 h-3.5 text-amber-500 animate-spin group-hover:[animation-duration:1.5s] transition-all"
          style={{ animationDuration: '8s' }}
        />
        <span>Vòng quay</span>
      </button>

      {onOpenAddDecision && (
        <button
          type="button"
          onClick={onOpenAddDecision}
          disabled={!isActive}
          className="ws-chip"
          title="Đề xuất quyết định mới"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
          <span>Đề xuất quyết định</span>
        </button>
      )}
    </div>
  );
};
