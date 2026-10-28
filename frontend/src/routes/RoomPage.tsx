import React, { useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoomWorkspaceView } from '../mockup/components/RoomWorkspaceView';
import { JoinRoomModal } from '../mockup/components/JoinRoomModal';
import { CreatePollModal } from '../mockup/components/CreatePollModal';
import { useRoomSession } from '../hooks/useRoomSession';
import { useEventChat } from '../hooks/useEventChat';
import { eventChatApi } from '../services/eventChatApi';
import { useLoadingOverlay } from '../components/common/PreloaderContext';
import { MotionPresence } from '../components/common/MotionPresence';
import { toast } from '../stores/toastStore';

const WheelSpinModal = lazy(() => import('../mockup/components/WheelSpinModal').then(module => ({ default: module.WheelSpinModal })));
const ExportSummaryModal = lazy(() => import('../mockup/components/ExportSummaryModal').then(module => ({ default: module.ExportSummaryModal })));

export const RoomPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, saveSession } = useRoomSession();

  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const isJoinModalOpen = Boolean(slug && (!session || session.slug !== slug || !session.sessionToken));

  const handleModalJoin = async (nickname: string) => {
    if (!slug) return;
    try {
      const res = await eventChatApi.joinRoom(slug, nickname);
      saveSession({
        slug: res.slug,
        guestId: res.guestId,
        nickname: res.nickname,
        role: res.role,
        sessionToken: res.sessionToken,
        hostToken: null,
      });
      toast.success(`Chào mừng ${res.nickname} đã tham gia phòng!`);
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Không thể tham gia phòng');
    }
  };

  const {
    roomTitle,
    roomStatus,
    expiresAt,
    createdAt,
    participants,
    maxParticipants,
    messages,
    poll,
    polls,
    selectPoll,
    remoteWinner,
    decisions,
    wheels,
    isLoading,
    error,
    actionError,
    isVoting,
    closePoll,
    sendMessage,
    votePoll,
    addDecision,
    confirmDecision,
    closeRoom,
    joinLocked,
    isUpdatingJoinLock,
    updateJoinLock,
    kickingGuestId,
    kickParticipant,
    createPoll,
    createWheel,
    spinCurrentWheel,
  } = useEventChat(slug || '', session);
  useLoadingOverlay(isLoading && !isJoinModalOpen);

  const isHost =
    session?.role === 'HOST' ||
    Boolean(session?.hostToken) ||
    participants.some((p) => p.id === session?.guestId && p.role === 'HOST');

  const handleCloseRoom = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đóng phòng và khóa kết quả thảo luận không?')) {
      return;
    }
    if (await closeRoom()) toast.info('Phòng thảo luận đã được đóng và khóa kết quả.');
  };

  const handleToggleJoinLock = async () => {
    const nextLocked = !joinLocked;
    if (await updateJoinLock(nextLocked)) {
      toast.success(nextLocked ? 'Đã khóa lượt tham gia mới.' : 'Đã mở lại lượt tham gia.');
    }
  };

  const handleKickParticipant = async (guestId: string) => {
    const target = participants.find(p => p.id === guestId);
    if (!target || !window.confirm(`Loại "${target.nickname}" khỏi phòng? Phiên hiện tại của thành viên này sẽ bị thu hồi.`)) return;
    if (await kickParticipant(guestId)) {
      toast.success(`Đã loại ${target.nickname} khỏi phòng.`);
    }
  };

  const handleCreatePoll = async (question: string, options: string[], allowMultiple: boolean) => {
    if (!slug) return;
    try {
      const result = await createPoll(question, options, allowMultiple);
      toast.success('Đã tạo bình chọn mới thành công!');
      return result;
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Không thể tạo bình chọn');
      throw err;
    }
  };

  const handleCreateWheel = async (title: string, entries: string[], excludeWinner: boolean) => {
    if (!slug) return;
    try {
      const result = await createWheel(title, entries, excludeWinner);
      toast.success('Đã tạo vòng quay may mắn!');
      return result;
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Không thể tạo vòng quay');
      throw err;
    }
  };

  if (!slug) {
    navigate('/');
    return null;
  }

  if (error && !isJoinModalOpen) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Không thể tải phòng</h2>
          <p className="text-xs text-rose-500 font-medium">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {actionError && <div role="alert" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-rose-100 text-rose-800 px-4 py-3 shadow-lg">{actionError}</div>}
      <RoomWorkspaceView
        roomTitle={roomTitle}
        roomCode={slug}
        roomStatus={roomStatus}
        joinLocked={joinLocked}
        isUpdatingJoinLock={isUpdatingJoinLock}
        onToggleJoinLock={session?.hostToken ? handleToggleJoinLock : undefined}
        kickingGuestId={kickingGuestId}
        onKickParticipant={session?.hostToken ? handleKickParticipant : undefined}
        expiresAt={expiresAt}
        createdAt={createdAt}
        participants={participants}
        maxParticipants={maxParticipants}
        poll={poll}
        polls={polls}
        onSelectPoll={selectPoll}
        decisions={decisions}
        messages={messages}
        isHost={isHost}
        onSendMessage={sendMessage}
        onVotePoll={async (optId) => {
          if (await votePoll(optId)) toast.success('Đã ghi nhận phiếu bình chọn của bạn!');
        }}
        isVoting={isVoting}
        onClosePoll={async () => {
          if (await closePoll()) toast.info('Bình chọn đã được kết thúc.');
        }}
        onOpenWheelModal={() => setIsWheelModalOpen(true)}
        onConfirmDecision={async (id) => {
          const succeeded = await confirmDecision(id);
          if (succeeded) toast.success(isHost
            ? 'Đã xác nhận chốt quyết định!' : 'Đã ghi nhận ý kiến tán thành của bạn.');
          return succeeded;
        }}
        onAddDecision={async (title, details) => {
          const succeeded = await addDecision(title, details);
          if (succeeded) toast.success('Đã tạo đề xuất quyết định mới!');
          return succeeded;
        }}
        onCloseRoom={handleCloseRoom}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCreatePoll={() => setIsCreatePollOpen(true)}
      />

      <Suspense fallback={<div role="status" className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center text-white text-sm">Đang tải công cụ...</div>}>
      <MotionPresence open={isWheelModalOpen}><WheelSpinModal
        isOpen
        onClose={() => setIsWheelModalOpen(false)}
        items={wheels}
        isHost={isHost}
        participants={participants}
        onConfirmWinnerAsDecision={async (winner) => {
          const succeeded = await addDecision(`Lựa chọn ngẫu nhiên: ${winner}`);
          if (succeeded) {
            toast.success(`Đã thêm lựa chọn "${winner}" vào danh sách quyết định!`);
          }
          return succeeded;
        }}
        onCreateWheel={handleCreateWheel}
        onSpinRemote={spinCurrentWheel}
        roomStatus={roomStatus}
        remoteWinner={remoteWinner}
      /></MotionPresence>

      <MotionPresence open={isExportModalOpen && isHost}><ExportSummaryModal
        isOpen
        onClose={() => setIsExportModalOpen(false)}
        roomCode={slug}
      /></MotionPresence>
      </Suspense>

      <MotionPresence open={isCreatePollOpen}><CreatePollModal
        isOpen
        onClose={() => setIsCreatePollOpen(false)}
        onCreatePoll={handleCreatePoll}
      /></MotionPresence>

      <MotionPresence open={isJoinModalOpen}><JoinRoomModal
        isOpen
        slug={slug}
        onJoin={handleModalJoin}
      /></MotionPresence>
    </>
  );
};
