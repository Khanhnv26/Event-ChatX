import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoomWorkspaceView } from '../mockup/components/RoomWorkspaceView';
import { WheelSpinModal } from '../mockup/components/WheelSpinModal';
import { ExportSummaryModal } from '../mockup/components/ExportSummaryModal';
import { JoinRoomModal } from '../mockup/components/JoinRoomModal';
import { CreatePollModal } from '../mockup/components/CreatePollModal';
import { useRoomSession } from '../hooks/useRoomSession';
import { useEventChat } from '../hooks/useEventChat';
import { eventChatApi } from '../services/eventChatApi';
import { Preloader } from '../components/common/Preloader';

export const RoomPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, saveSession } = useRoomSession();

  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(() => {
    if (!slug) return false;
    const curSlug = sessionStorage.getItem('eventchat_slug');
    const token = sessionStorage.getItem('eventchat_session_token');
    return !token || curSlug !== slug;
  });

  // If user entered via link directly and has no session for this room
  useEffect(() => {
    if (slug && (!session || session.slug !== slug)) {
      setIsJoinModalOpen(true);
    } else {
      setIsJoinModalOpen(false);
    }
  }, [slug, session]);

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
      setIsJoinModalOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Không thể tham gia phòng');
    }
  };

  const {
    roomTitle,
    roomStatus,
    expiresAt,
    createdAt,
    participants,
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
    createPoll,
    createWheel,
    spinCurrentWheel,
  } = useEventChat(slug || '', session);

  const isHost =
    session?.role === 'HOST' ||
    Boolean(session?.hostToken) ||
    participants.some((p) => p.id === session?.guestId && p.role === 'HOST');

  const handleCloseRoom = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đóng phòng và khóa kết quả thảo luận không?')) {
      return;
    }
    await closeRoom();
  };

  const handleCreatePoll = async (question: string, options: string[], allowMultiple: boolean) => {
    if (!slug) return;
    return createPoll(question, options, allowMultiple);
  };

  const handleCreateWheel = async (title: string, entries: string[]) => {
    if (!slug) return;
    return createWheel(title, entries);
  };

  if (!slug) {
    navigate('/');
    return null;
  }

  if (isLoading && !isJoinModalOpen) {
    return <Preloader fullScreen={true} isLoading={true} minDuration={1200} />;
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
        expiresAt={expiresAt}
        createdAt={createdAt}
        participants={participants}
        poll={poll}
        polls={polls}
        onSelectPoll={selectPoll}
        decisions={decisions}
        messages={messages}
        isHost={isHost}
        onSendMessage={sendMessage}
        onVotePoll={votePoll}
        isVoting={isVoting}
        onClosePoll={closePoll}
        onOpenWheelModal={() => setIsWheelModalOpen(true)}
        onConfirmDecision={confirmDecision}
        onAddDecision={addDecision}
        onCloseRoom={handleCloseRoom}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCreatePoll={() => setIsCreatePollOpen(true)}
      />

      {/* Wheel Spin Modal */}
      <WheelSpinModal
        isOpen={isWheelModalOpen}
        onClose={() => setIsWheelModalOpen(false)}
        items={wheels}
        isHost={isHost}
        participants={participants}
        onConfirmWinnerAsDecision={(winner) => addDecision(`Lựa chọn ngẫu nhiên: ${winner}`)}
        onCreateWheel={handleCreateWheel}
        onSpinRemote={spinCurrentWheel}
        roomStatus={roomStatus}
        remoteWinner={remoteWinner}
      />

      {/* Export Summary Modal */}
      <ExportSummaryModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        roomTitle={roomTitle}
        roomCode={slug}
        roomStatus={roomStatus}
        participants={participants}
        decisions={decisions}
        poll={poll}
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onCreatePoll={handleCreatePoll}
      />

      {/* Join Room Modal if no session */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        slug={slug}
        onJoin={handleModalJoin}
      />
    </>
  );
};
