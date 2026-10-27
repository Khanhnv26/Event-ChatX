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
    participants,
    messages,
    poll,
    decisions,
    wheels,
    isLoading,
    error,
    sendMessage,
    votePoll,
    addDecision,
    confirmDecision,
    closeRoom,
  } = useEventChat(slug || '', session);

  const handleCreatePoll = async (question: string, options: string[], allowMultiple: boolean) => {
    if (!slug) return;
    try {
      await eventChatApi.createPoll(slug, question, options, allowMultiple);
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Không thể tạo cuộc bình chọn');
    }
  };

  if (!slug) {
    navigate('/');
    return null;
  }

  if (isLoading && !isJoinModalOpen) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Đang kết nối tới phòng...</span>
        </div>
      </div>
    );
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
        participants={participants}
        poll={poll}
        decisions={decisions}
        messages={messages}
        onSendMessage={sendMessage}
        onVotePoll={votePoll}
        onOpenWheelModal={() => setIsWheelModalOpen(true)}
        onConfirmDecision={confirmDecision}
        onAddDecision={addDecision}
        onCloseRoom={closeRoom}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCreatePoll={() => setIsCreatePollOpen(true)}
      />

      {/* Wheel Spin Modal */}
      <WheelSpinModal
        isOpen={isWheelModalOpen}
        onClose={() => setIsWheelModalOpen(false)}
        items={wheels}
        onConfirmWinnerAsDecision={(winner) => addDecision(`Lựa chọn ngẫu nhiên: ${winner}`)}
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
