import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoomWorkspaceView } from '../components/room/RoomWorkspaceView';
import { JoinRoomModal } from '../components/room/JoinRoomModal';
import { CreatePollModal } from '../components/room/CreatePollModal';
import { CloseRoomConfirmModal } from '../components/room/CloseRoomConfirmModal';
import { useRoomSession } from '../hooks/useRoomSession';
import { useEventChat } from '../hooks/useEventChat';
import { eventChatApi } from '../services/eventChatApi';
import { useLoadingOverlay } from '../components/common/PreloaderContext';
import { MotionPresence } from '../components/common/MotionPresence';
import { toast } from '../stores/toastStore';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const WheelSpinModal = lazy(() => import('../components/room/WheelSpinModal').then(module => ({ default: module.WheelSpinModal })));
const ExportSummaryModal = lazy(() => import('../components/room/ExportSummaryModal').then(module => ({ default: module.ExportSummaryModal })));

export const RoomPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, saveSession } = useRoomSession();

  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ id: string; nickname: string } | null>(null);
  const [isKickConfirmOpen, setIsKickConfirmOpen] = useState(false);
  const [isClosePollConfirmOpen, setIsClosePollConfirmOpen] = useState(false);
  const [isClosingPoll, setIsClosingPoll] = useState(false);
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
      throw err;
    }
  };

  const {
    roomTitle,
    roomStatus,
    expiresAt,
    createdAt,
    participants,
    presenceKnown,
    maxParticipants,
    messages,
    poll,
    polls,
    selectPoll,
    remoteWinner,
    decisions,
    wheels,
    wheelList,
    currentWheel,
    selectWheel,
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

  useEffect(() => {
    if (actionError) {
      toast.error(actionError);
    }
  }, [actionError]);

  const isHost =
    session?.role === 'HOST' ||
    Boolean(session?.hostToken) ||
    participants.some((p) => p.id === session?.guestId && p.role === 'HOST');

  const handleOpenCloseConfirm = () => {
    setIsCloseConfirmOpen(true);
  };

  const handleConfirmCloseRoom = async () => {
    setIsClosingRoom(true);
    try {
      const ok = await closeRoom();
      if (ok) {
        setIsCloseConfirmOpen(false);
        toast.info('Phòng thảo luận đã được đóng và khóa kết quả.');
        setIsExportModalOpen(true);
      }
    } finally {
      setIsClosingRoom(false);
    }
  };

  const handleToggleJoinLock = async () => {
    const nextLocked = !joinLocked;
    if (await updateJoinLock(nextLocked)) {
      toast.success(nextLocked ? 'Đã khóa lượt tham gia mới.' : 'Đã mở lại lượt tham gia.');
    }
  };

  const handleConfirmClosePoll = async () => {
    if (isClosingPoll) return;
    setIsClosingPoll(true);
    try {
      if (await closePoll()) {
        setIsClosePollConfirmOpen(false);
        toast.info('Bình chọn đã được kết thúc.');
      }
    } finally { setIsClosingPoll(false); }
  };

  const handleKickParticipant = async (guestId: string) => {
    const target = participants.find(p => p.id === guestId);
    if (target) { setKickTarget({ id: target.id, nickname: target.nickname }); setIsKickConfirmOpen(true); }
  };

  const handleConfirmKick = async () => {
    if (!kickTarget || kickingGuestId) return;
    if (await kickParticipant(kickTarget.id)) {
      toast.success(`Đã loại ${kickTarget.nickname} khỏi phòng.`);
      setIsKickConfirmOpen(false);
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
        presenceKnown={presenceKnown}
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
          setIsClosePollConfirmOpen(true);
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
        onCloseRoom={handleOpenCloseConfirm}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCreatePoll={() => setIsCreatePollOpen(true)}
      />

      <Suspense fallback={<div role="status" className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center text-white text-sm">Đang tải công cụ...</div>}>
      <MotionPresence open={isWheelModalOpen}><WheelSpinModal
        isOpen
        onClose={() => setIsWheelModalOpen(false)}
        items={wheels}
        wheelList={wheelList}
        currentWheelId={currentWheel?.id}
        onSelectWheel={selectWheel}
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

      <MotionPresence open={isExportModalOpen && (isHost || roomStatus === 'CLOSED')}><ExportSummaryModal
        isOpen
        onClose={() => setIsExportModalOpen(false)}
        roomCode={slug}
      /></MotionPresence>
      </Suspense>

      <MotionPresence open={isCloseConfirmOpen}>
        <CloseRoomConfirmModal
          isOpen
          onClose={() => setIsCloseConfirmOpen(false)}
          onConfirm={handleConfirmCloseRoom}
          isClosing={isClosingRoom}
        />
      </MotionPresence>

      <MotionPresence open={isKickConfirmOpen}>
        <ConfirmModal title={`Loại “${kickTarget?.nickname ?? ''}” khỏi phòng?`}
          description="Phiên tham gia hiện tại của thành viên sẽ bị thu hồi. Tin nhắn trước đó vẫn được giữ trong cuộc thảo luận."
          confirmLabel="Loại thành viên" pendingLabel="Đang loại thành viên…" pending={kickingGuestId !== null}
          onClose={() => setIsKickConfirmOpen(false)} onConfirm={() => void handleConfirmKick()} />
      </MotionPresence>

      <MotionPresence open={isClosePollConfirmOpen}>
        <ConfirmModal title="Kết thúc bình chọn?" description={`“${poll.question}” sẽ dừng nhận phiếu mới. Kết quả hiện tại vẫn được giữ lại.`}
          confirmLabel="Kết thúc bình chọn" pendingLabel="Đang kết thúc…" pending={isClosingPoll}
          onClose={() => setIsClosePollConfirmOpen(false)} onConfirm={() => void handleConfirmClosePoll()} />
      </MotionPresence>

      <MotionPresence open={isCreatePollOpen}><CreatePollModal
        isOpen
        onClose={() => setIsCreatePollOpen(false)}
        onCreatePoll={handleCreatePoll}
      /></MotionPresence>

      <MotionPresence open={isJoinModalOpen}><JoinRoomModal
        isOpen
        slug={slug}
        onJoin={handleModalJoin}
        onClose={() => navigate('/')}
      /></MotionPresence>
    </>
  );
};
