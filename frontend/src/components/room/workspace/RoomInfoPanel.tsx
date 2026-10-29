import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, QrCode, X } from 'lucide-react';
import { RoomCountdown } from '../RoomCountdown';
import { toast } from '../../../stores/toastStore';
import type { RoomStatus } from '../../../types/room';

interface RoomInfoPanelProps {
  roomTitle: string;
  roomCode: string;
  roomStatus: RoomStatus;
  expiresAt?: string | null;
  createdAt?: string | null;
  onRoomExpired?: () => void;
  onOpenQr: () => void;
  /** Rendered as a close button when the panel lives inside a mobile drawer. */
  onClose?: () => void;
}

export const RoomInfoPanel: React.FC<RoomInfoPanelProps> = ({
  roomTitle,
  roomCode,
  roomStatus,
  expiresAt,
  createdAt,
  onRoomExpired,
  onOpenQr,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomCode}`);
      setCopied(true);
      toast.success('Đã sao chép liên kết phòng vào bộ nhớ tạm');
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép liên kết, hãy thử lại');
    }
  };

  const isActive = roomStatus === 'ACTIVE';

  return (
    <div className="space-y-3 shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`}
            />
            <h2 className="text-[15px] font-bold text-primary-text truncate" title={roomTitle}>
              # {roomTitle}
            </h2>
          </div>
          <div className="flex items-center gap-0.5 mt-1 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground mr-1">#{roomCode}</span>
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="ws-icon-btn"
              aria-label="Sao chép liên kết phòng"
              title="Sao chép liên kết phòng"
            >
              {copied ? (
                <Check className="w-4 h-4 text-accent-text animate-stamp-check" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenQr}
              className="ws-icon-btn"
              aria-label="Hiện mã QR của phòng"
              title="Hiện mã QR của phòng"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="ws-icon-btn" aria-label="Đóng thông tin phòng">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <RoomCountdown
        expiresAt={expiresAt}
        createdAt={createdAt}
        roomStatus={roomStatus}
        onExpired={onRoomExpired}
      />
    </div>
  );
};
