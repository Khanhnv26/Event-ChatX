import React from 'react';
import { Crown, FileText, Lock, ShieldCheck, Unlock, UserMinus, Users, X } from 'lucide-react';
import type { Participant, RoomStatus } from '../../types';

interface ParticipantPanelProps {
  participants: Participant[];
  maxParticipants?: number;
  presenceKnown?: boolean;
  isHost?: boolean;
  mobile?: boolean;
  roomStatus: RoomStatus;
  joinLocked?: boolean;
  isUpdatingJoinLock?: boolean;
  onToggleJoinLock?: () => Promise<void>;
  kickingGuestId?: string | null;
  onKickParticipant?: (guestId: string) => Promise<void>;
  onOpenExport: () => void;
  onCloseRoom: () => void;
  onClose?: () => void;
}

export const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  participants,
  maxParticipants = 50,
  presenceKnown = true,
  isHost = false,
  mobile = false,
  roomStatus,
  joinLocked = false,
  isUpdatingJoinLock = false,
  onToggleJoinLock,
  kickingGuestId = null,
  onKickParticipant,
  onOpenExport,
  onCloseRoom,
  onClose,
}) => {
  const onlineCount = participants.filter(p => p.isOnline).length;
  const isActive = roomStatus === 'ACTIVE';
  const HostControls = mobile ? 'details' : 'div';

  return (
    <div className={`${mobile ? '' : 'flex-1 min-h-0'} flex flex-col justify-between gap-3`}>
      <div className={`space-y-3 flex flex-col ${mobile ? '' : 'min-h-0 flex-1'}`}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <button
            type="button"
            role={mobile ? undefined : 'tab'}
            aria-selected={mobile ? undefined : true}
            className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 cursor-default"
          >
            <Users className="w-4 h-4 text-primary" />
            <span>Thành viên ({participants.length}/{maxParticipants})</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-accent-text">
              {onlineCount} online
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="ws-icon-btn p-1"
                aria-label="Đóng bảng thành viên"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isHost && isActive && onToggleJoinLock && (
          <HostControls className={`p-2.5 rounded-2xl bg-warn-soft/50 border border-amber-300/60 dark:border-amber-800/60 space-y-2 ${mobile ? 'order-2' : ''}`}>
            {mobile && <summary className="cursor-pointer text-xs font-bold text-warn-text">Quản trị phòng</summary>}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-warn-text flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Bảng điều khiển Host
              </span>
              <span className="ws-badge text-xs bg-warn-soft text-warn-text">
                HOST
              </span>
            </div>

            <div>
              <button
                type="button"
                onClick={() => void onToggleJoinLock()}
                disabled={isUpdatingJoinLock}
                aria-pressed={joinLocked}
                aria-busy={isUpdatingJoinLock}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
              >
                {joinLocked ? <Unlock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                {isUpdatingJoinLock
                  ? 'Đang cập nhật...'
                  : joinLocked
                  ? 'Mở lại lượt tham gia'
                  : 'Khóa lượt tham gia mới'}
              </button>
              <p role="status" className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {joinLocked
                  ? 'Đang khóa người mới. Thành viên hiện tại vẫn sử dụng phòng.'
                  : 'Người có liên kết có thể tham gia khi phòng còn chỗ.'}
              </p>
            </div>
          </HostControls>
        )}

        <ul
          className={`space-y-1.5 ${mobile ? '' : 'flex-1 overflow-y-auto min-h-0 pr-0.5'}`}
          aria-label="Danh sách người tham gia"
        >
          {participants.map(p => {
            const presenceLabel = !presenceKnown
              ? 'Đang cập nhật…'
              : p.isOnline
              ? 'Đang online'
              : 'Không kết nối';

            return (
              <li
                key={p.id}
                className="group flex items-center justify-between p-2 rounded-xl bg-card-muted/40 hover:bg-card-muted border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {p.role === 'HOST' ? (
                    <div
                      className="w-7 h-7 rounded-lg bg-warn-soft flex items-center justify-center shrink-0"
                      title="Chủ phòng"
                    >
                      <Crown className="w-4 h-4 text-amber-500" />
                    </div>
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.nickname.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {p.nickname} {p.role === 'HOST' ? '(Host)' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {presenceLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isHost && isActive && p.role !== 'HOST' && onKickParticipant && (
                    <button
                      type="button"
                      onClick={() => void onKickParticipant(p.id)}
                      disabled={kickingGuestId !== null}
                      aria-label={`Loại ${p.nickname} khỏi phòng`}
                      aria-busy={kickingGuestId === p.id}
                      title={`Loại ${p.nickname} khỏi phòng`}
                      className="ws-icon-btn p-1 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 opacity-80 group-hover:opacity-100 focus:opacity-100"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      p.isOnline ? 'bg-accent animate-pulse' : 'bg-border'
                    }`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 shrink-0 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onOpenExport}
          className="ws-btn ws-btn-primary shadow-xs"
        >
          <FileText className="w-4 h-4" />
          <span>Xuất biên bản PDF</span>
        </button>

        {isHost && isActive && (
          <button
            type="button"
            onClick={onCloseRoom}
            className="ws-btn ws-btn-danger"
          >
            <Lock className="w-4 h-4" />
            <span>Đóng phòng</span>
          </button>
        )}
      </div>
    </div>
  );
};
