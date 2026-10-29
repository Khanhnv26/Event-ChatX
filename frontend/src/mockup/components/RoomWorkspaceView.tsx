import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { CheckCircle2, Hash, Lock, Users } from 'lucide-react';
import { ChatInputBar } from './ChatInputBar';
import { ChatMessageList } from './ChatMessageList';
import { PollListModal } from './workspace/PollListModal';
import { MobileRoomPanel, type MobileRoomTab } from './workspace/MobileRoomPanel';
import {
  RoomInfoPanel,
  DecisionPanel,
  PollCard,
  ChatToolbar,
  ParticipantPanel,
  isActivePoll,
  POLL_CARD_SELECTOR,
} from './workspace';
import { MotionPresence } from '../../components/common/MotionPresence';
import { isMotionEnabled } from '../../services/motionPreference';
import type { Participant, Poll, DecisionCard, ChatMessage, RoomStatus } from '../types';

const RoomQrModal = lazy(() =>
  import('./RoomQrModal').then(module => ({ default: module.RoomQrModal }))
);

export interface RoomWorkspaceViewProps {
  roomTitle: string;
  roomCode: string;
  roomStatus: RoomStatus;
  joinLocked?: boolean;
  isUpdatingJoinLock?: boolean;
  onToggleJoinLock?: () => Promise<void>;
  kickingGuestId?: string | null;
  onKickParticipant?: (guestId: string) => Promise<void>;
  expiresAt?: string | null;
  createdAt?: string | null;
  participants: Participant[];
  presenceKnown?: boolean;
  maxParticipants?: number;
  poll: Poll;
  polls?: Poll[];
  onSelectPoll?: (id: string) => void;
  decisions: DecisionCard[];
  messages: ChatMessage[];
  isHost?: boolean;
  onSendMessage: (text: string, replyToId?: string, attachments?: import('../../types/backend.types').AttachmentResponse[]) => Promise<boolean>;
  onVotePoll: (optionId: string) => void;
  isVoting?: boolean;
  onClosePoll?: () => Promise<void>;
  onOpenWheelModal: () => void;
  onConfirmDecision: (decisionId: string) => Promise<boolean> | boolean | void;
  onAddDecision: (title: string, details: string) => Promise<boolean> | boolean | void;
  onCloseRoom: () => void;
  onOpenExport: () => void;
  onOpenCreatePoll?: () => void;
  onRoomExpired?: () => void;
}

export const RoomWorkspaceView: React.FC<RoomWorkspaceViewProps> = ({
  roomTitle,
  roomCode,
  roomStatus,
  joinLocked = false,
  isUpdatingJoinLock = false,
  onToggleJoinLock,
  kickingGuestId = null,
  onKickParticipant,
  expiresAt,
  createdAt,
  participants,
  presenceKnown = true,
  maxParticipants = 50,
  poll,
  polls = [],
  onSelectPoll,
  decisions,
  messages,
  isHost = false,
  onSendMessage,
  onVotePoll,
  isVoting = false,
  onClosePoll,
  onOpenWheelModal,
  onConfirmDecision,
  onAddDecision,
  onCloseRoom,
  onOpenExport,
  onOpenCreatePoll,
  onRoomExpired,
}) => {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileRoomTab>('decisions');
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => { setIsDesktop(media.matches); if (media.matches) setIsMobilePanelOpen(false); };
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  const [showAddDecisionForm, setShowAddDecisionForm] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPollListOpen, setIsPollListOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const previousCountRef = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth && isMotionEnabled()) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    followLatestRef.current = true;
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const previousCount = previousCountRef.current;
    const added = Math.max(0, messages.length - previousCount);
    previousCountRef.current = messages.length;
    if (followLatestRef.current || messages.at(-1)?.isMe) {
      scrollToBottom(previousCount > 0);
    } else if (added) {
      setUnreadCount(count => count + added);
    }
  }, [messages, scrollToBottom]);

  const scrollToPoll = useCallback(() => {
    const el = document.querySelector(POLL_CARD_SELECTOR);
    if (el) {
      el.scrollIntoView({ behavior: isMotionEnabled() ? 'smooth' : 'auto', block: 'center' });
    }
  }, []);

  const openDecisions = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      document.querySelector<HTMLElement>('[aria-label="Danh sách quyết định"]')?.focus();
    } else {
      setMobileTab('decisions');
      setIsMobilePanelOpen(true);
    }
  }, []);

  const toggleRightPanel = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileTab('participants');
      setIsMobilePanelOpen(true);
    } else {
      setIsRightSidebarOpen(prev => !prev);
    }
  }, []);

  const onlineCount = participants.filter(p => p.isOnline).length;
  const confirmedCount = decisions.filter(d => d.status === 'CONFIRMED').length;
  const hasPoll = isActivePoll(poll);

  return (
    <div className="workspace-page page-enter h-[calc(100dvh-4rem)] max-w-7xl mx-auto px-2 sm:px-4 py-2 flex flex-col gap-2 relative">
      {roomStatus === 'CLOSED' && (
        <div className="bg-danger-soft border border-danger/30 px-4 py-2 rounded-2xl flex items-center justify-between text-xs text-danger shrink-0 animate-fade-slide-up">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-danger shrink-0" />
            <span>Phiên thảo luận đã kết thúc. Quyết định đã được lưu trữ an toàn.</span>
          </div>
          <button
            type="button"
            onClick={onOpenExport}
            className="px-3 py-1 bg-danger text-white rounded-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer shrink-0"
          >
            Xuất biên bản
          </button>
        </div>
      )}

      <div
        className="workspace-layout-3col flex-1 min-h-0"
        data-right-sidebar={isRightSidebarOpen ? 'open' : 'closed'}
      >
        {/* ============ DESKTOP LEFT COLUMN ============ */}
        {isDesktop && <aside
          className="hidden lg:flex flex-col ws-panel p-3.5 overflow-hidden min-h-0 gap-3"
          aria-label="Thông tin phòng và quyết định"
        >
          <RoomInfoPanel
            roomTitle={roomTitle}
            roomCode={roomCode}
            roomStatus={roomStatus}
            expiresAt={expiresAt}
            createdAt={createdAt}
            onRoomExpired={onRoomExpired}
            onOpenQr={() => setIsQrModalOpen(true)}
          />
          <div className="h-px bg-border shrink-0" />
          <DecisionPanel
            decisions={decisions}
            roomStatus={roomStatus}
            isHost={isHost}
            showForm={showAddDecisionForm}
            onToggleForm={setShowAddDecisionForm}
            onConfirmDecision={onConfirmDecision}
            onAddDecision={onAddDecision}
          />
        </aside>}

        {/* ============ MAIN CHAT COLUMN ============ */}
        <main
          className="workspace-chat-surface relative flex flex-col ws-panel overflow-hidden min-h-0 min-w-0"
          aria-label="Kênh thảo luận"
        >
          <header className="px-4 py-3 border-b border-border bg-card/90 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 relative overflow-hidden shadow-2xs">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={openDecisions}
                className="lg:hidden ws-icon-btn p-1.5 border border-border"
                title="Mở thông tin & quyết định"
                aria-label="Mở thông tin và quyết định"
              >
                <Hash className="w-4 h-4 text-primary" />
              </button>

              <div className="min-w-0 flex-1">
                <h1
                  className="text-xs sm:text-sm font-bold text-foreground tracking-tight truncate hover:text-primary transition-colors"
                  title={roomTitle}
                >
                  Kênh thảo luận trực tiếp
                </h1>
                <p className="text-xs text-muted-foreground truncate">
                  {onlineCount} người đang trực tuyến
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openDecisions}
                className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-border bg-card-muted text-foreground transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="Mở bảng quyết định"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span>
                  <strong>{confirmedCount}</strong> đã chốt
                </span>
              </button>

              <button
                type="button"
                onClick={toggleRightPanel}
                className="ws-icon-btn p-1.5 border border-border"
                title="Ẩn/Hiện thành viên & quản trị"
                aria-label="Ẩn hoặc hiện danh sách thành viên"
              >
                <Users className="w-4 h-4 text-primary" />
              </button>
            </div>
          </header>

          <div
            ref={messagesContainerRef}
            data-native-scroll
            aria-label="Tin nhắn trong phòng"
            onScroll={event => {
              const el = event.currentTarget;
              followLatestRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
              if (followLatestRef.current) setUnreadCount(0);
            }}
            className="chat-stream flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 min-h-0"
          >
            {hasPoll && (
              <PollCard
                poll={poll}
                polls={polls}
                onSelectPoll={onSelectPoll}
                onVotePoll={onVotePoll}
                isVoting={isVoting}
                onClosePoll={onClosePoll}
                roomStatus={roomStatus}
                isHost={isHost}
              />
            )}

            {messages.length === 0 && !hasPoll && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground animate-fade-slide-up">
                <div className="w-12 h-12 rounded-2xl bg-card-muted border border-border flex items-center justify-center text-primary mb-3 shadow-2xs">
                  <Hash className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Chưa có tin nhắn hoặc bình chọn
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hãy gửi tin nhắn đầu tiên hoặc mở cuộc bình chọn để bắt đầu!
                </p>
              </div>
            )}

            <ChatMessageList
              roomCode={roomCode}
              messages={messages}
              onOpenDecisions={openDecisions}
              onReply={roomStatus === 'ACTIVE' ? setReplyTo : undefined}
            />
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 rounded-full px-4 py-2 text-xs font-semibold bg-primary text-white shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
            >
              {unreadCount} tin nhắn mới ↓
            </button>
          )}

          <div className="px-3 sm:px-4 py-2 border-t border-border bg-card-muted/60 space-y-2 shrink-0">
            <ChatToolbar
              hasPoll={hasPoll}
              onScrollToPoll={() => setIsPollListOpen(true)}
              isHost={isHost}
              onOpenCreatePoll={onOpenCreatePoll}
              onOpenWheelModal={onOpenWheelModal}
              onOpenAddDecision={() => { setShowAddDecisionForm(true); openDecisions(); }}
              roomStatus={roomStatus}
            />

            <div className="w-full min-w-0">
              <ChatInputBar
                roomCode={roomCode}
                roomStatus={roomStatus}
                onSendMessage={onSendMessage}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          </div>
        </main>

        {/* ============ DESKTOP RIGHT COLUMN ============ */}
        {isDesktop && <aside
          id="room-sidebar"
          className={`hidden lg:flex flex-col ws-panel p-3.5 overflow-hidden min-h-0 ${
            !isRightSidebarOpen ? 'lg:hidden' : ''
          }`}
          aria-label="Thành viên và quản trị phòng"
        >
          <ParticipantPanel
            participants={participants}
            maxParticipants={maxParticipants}
            presenceKnown={presenceKnown}
            isHost={isHost}
            roomStatus={roomStatus}
            joinLocked={joinLocked}
            isUpdatingJoinLock={isUpdatingJoinLock}
            onToggleJoinLock={onToggleJoinLock}
            kickingGuestId={kickingGuestId}
            onKickParticipant={onKickParticipant}
            onOpenExport={onOpenExport}
            onCloseRoom={onCloseRoom}
          />
        </aside>}
      </div>

      <MotionPresence open={isMobilePanelOpen && !isDesktop} duration={300}>
        <MobileRoomPanel tab={mobileTab} onTabChange={setMobileTab} onClose={() => setIsMobilePanelOpen(false)}
          roomTitle={roomTitle} confirmedCount={confirmedCount} participantCount={participants.length}
          roomInfo={<RoomInfoPanel roomTitle={roomTitle} roomCode={roomCode} roomStatus={roomStatus}
            expiresAt={expiresAt} createdAt={createdAt} onRoomExpired={onRoomExpired} onOpenQr={() => setIsQrModalOpen(true)} />}
          decisions={<DecisionPanel mobile decisions={decisions} roomStatus={roomStatus} isHost={isHost}
            showForm={showAddDecisionForm} onToggleForm={setShowAddDecisionForm}
            onConfirmDecision={onConfirmDecision} onAddDecision={onAddDecision} />}
          participants={<ParticipantPanel mobile participants={participants} maxParticipants={maxParticipants}
            presenceKnown={presenceKnown} isHost={isHost} roomStatus={roomStatus} joinLocked={joinLocked}
            isUpdatingJoinLock={isUpdatingJoinLock} onToggleJoinLock={onToggleJoinLock}
            kickingGuestId={kickingGuestId} onKickParticipant={onKickParticipant}
            onOpenExport={() => { setIsMobilePanelOpen(false); onOpenExport(); }}
            onCloseRoom={() => { setIsMobilePanelOpen(false); onCloseRoom(); }} />}
        />
      </MotionPresence>

      <MotionPresence open={isPollListOpen}>
        <PollListModal polls={polls} selectedId={poll.id} onClose={() => setIsPollListOpen(false)}
          onSelect={id => { onSelectPoll?.(id); setIsPollListOpen(false); scrollToPoll(); }}
          onCreate={isHost && roomStatus === 'ACTIVE' && onOpenCreatePoll ? () => { setIsPollListOpen(false); onOpenCreatePoll(); } : undefined} />
      </MotionPresence>
      <Suspense fallback={null}>
        <MotionPresence open={isQrModalOpen}>
          <RoomQrModal
            isOpen
            onClose={() => setIsQrModalOpen(false)}
            roomTitle={roomTitle}
            roomCode={roomCode}
          />
        </MotionPresence>
      </Suspense>
    </div>
  );
};
