import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { ChatInputBar } from './ChatInputBar';
import { RoomCountdown } from './RoomCountdown';
import { ChatMessageList } from './ChatMessageList';
import { MotionPresence } from '../../components/common/MotionPresence';
import { isMotionEnabled } from '../../services/motionPreference';
import {
  Users,
  Copy,
  Check,
  Vote,
  Disc,
  CheckCircle2,
  Lock,
  Unlock,
  UserMinus,
  Plus,
  FileText,
  HelpCircle,
  Sparkles,
  QrCode,
  PanelRightClose,
  PanelRightOpen,
  X,
  Hash,
} from 'lucide-react';
import type { Participant, Poll, DecisionCard, ChatMessage, RoomStatus } from '../types';
import { toast } from '../../stores/toastStore';

const RoomQrModal = lazy(() => import('./RoomQrModal').then(module => ({ default: module.RoomQrModal })));

interface RoomWorkspaceViewProps {
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
  maxParticipants?: number;
  poll: Poll;
  polls?: Poll[];
  onSelectPoll?: (id: string) => void;
  decisions: DecisionCard[];
  messages: ChatMessage[];
  isHost?: boolean;
  onSendMessage: (text: string, replyToId?: string) => Promise<boolean>;
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [isDecisionsDrawerOpen, setIsDecisionsDrawerOpen] = useState(false);
  const [showAddDecisionForm, setShowAddDecisionForm] = useState(false);
  const [newDecTitle, setNewDecTitle] = useState('');
  const [newDecDetails, setNewDecDetails] = useState('');
  const [justConfirmedId, setJustConfirmedId] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const openDecisions = useCallback(() => setIsDecisionsDrawerOpen(true), []);

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
    if (followLatestRef.current || messages.at(-1)?.isMe) scrollToBottom(previousCount > 0);
    else if (added) setUnreadCount(count => count + added);
  }, [messages, scrollToBottom]);

  const displayUrl = `${window.location.host}/rooms/${roomCode}`;

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/rooms/${roomCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    toast.success('Đã sao chép liên kết phòng vào bộ nhớ tạm');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecTitle.trim()) return;
    if (await onAddDecision(newDecTitle, newDecDetails) === false) return;
    setNewDecTitle('');
    setNewDecDetails('');
    setShowAddDecisionForm(false);
  };

  const handleConfirmWithAnimation = async (decisionId: string) => {
    if (await onConfirmDecision(decisionId) === false) return;
    setJustConfirmedId(decisionId);
    setTimeout(() => {
      setJustConfirmedId(null);
    }, 1500);
  };

  const confirmedCount = decisions.filter((d) => d.status === 'CONFIRMED').length;
  const proposedCount = decisions.filter((d) => d.status === 'PROPOSED').length;
  const onlineCount = participants.filter((p) => p.isOnline).length;
  const isPollClosed = poll.isClosed;
  const highestVotes = Math.max(0, ...poll.options.map(option => option.votes));
  const leadingOptions = poll.options.filter(option => option.votes === highestVotes);

  const hasActivePoll = Boolean(
    poll && poll.id && poll.id !== '0' && poll.id !== 'empty' && poll.options && poll.options.length > 0
  );

  return (
    <div className="workspace-page page-enter h-[calc(100dvh-4rem)] max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 flex flex-col gap-2 relative">
      {roomStatus === 'CLOSED' && (
        <div className="bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 px-4 py-2 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 shrink-0 animate-fade-slide-up">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Phiên thảo luận đã kết thúc. Quyết định đã được lưu trữ an toàn.</span>
          </div>
          <button
            onClick={onOpenExport}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 cursor-pointer shrink-0 transition-all hover:scale-105 active:scale-95"
          >
            Xuất biên bản
          </button>
        </div>
      )}

      <div className="workspace-layout flex-1 min-h-0" data-sidebar={isSidebarOpen ? 'open' : 'closed'}>
        <main
          className="workspace-chat-surface relative flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden min-h-0 min-w-0"
        >
          <header className="px-4 py-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center justify-center shadow-2xs">
                <Hash className="w-4 h-4 stroke-[2.5]" />
              </div>

              <div className="min-w-0 flex-1">
                <h1
                  className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title={roomTitle}
                >
                  {roomTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsDecisionsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0"
                title="Mở bảng quyết định"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="whitespace-nowrap">
                  <strong>{confirmedCount}</strong> đã chốt
                </span>
              </button>

              <button
                onClick={onOpenExport}
                disabled={!isHost}
                title={isHost ? 'Xuất biên bản' : 'Chỉ Host được xuất biên bản'}
                className="relative overflow-hidden px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/25 transition-all duration-200 cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 group/btn shrink-0"
              >
                <FileText className="w-3.5 h-3.5 group-hover/btn:rotate-6 transition-transform" />
                <span className="hidden sm:inline whitespace-nowrap">Xuất biên bản</span>
              </button>

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-expanded={isSidebarOpen}
                aria-controls="room-sidebar"
                className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 shrink-0 ${
                  isSidebarOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                }`}
                title={isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở rộng thông tin phòng'}
              >
                {isSidebarOpen ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
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
            className="chat-stream flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3.5 min-h-0"
          >
            {polls.length > 1 && <select aria-label="Chọn cuộc bình chọn" value={poll.id}
              onChange={event => onSelectPoll?.(event.target.value)} disabled={isVoting}
              className="w-full max-w-xl block mx-auto rounded-xl p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              {polls.map(item => <option key={item.id} value={item.id}>{item.question}{item.isClosed ? ' (Đã đóng)' : ''}</option>)}
            </select>}
            {hasActivePoll && (
              <div
                data-poll-card="true"
                className="my-2 w-full max-w-xl mx-auto scroll-mt-6 animate-fade-slide-up"
              >
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-medium">
                  <Vote className="w-3.5 h-3.5 text-indigo-500" />
                  <span><strong>{poll.createdBy || 'Host'}</strong> đã mở cuộc bình chọn</span>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-900/90 border border-indigo-200/80 dark:border-indigo-900/60 shadow-sm space-y-3 transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {poll.question}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {poll.totalVotes} phiếu
                      </span>
                      {isPollClosed ? (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300/80 dark:border-emerald-800 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Đã đóng</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 animate-pulse">
                          Đang mở
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">{poll.allowMultiple ? 'Có thể chọn nhiều phương án' : 'Mỗi người chọn một phương án'}</p>
                  <div className="space-y-1.5">
                    {poll.options.map((opt) => {
                      const pct =
                        poll.totalVotes > 0
                          ? Math.round((opt.votes / poll.totalVotes) * 100)
                          : 0;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => onVotePoll(opt.id)}
                          disabled={roomStatus !== 'ACTIVE' || isPollClosed || isVoting || opt.votedByMe ||
                            (!poll.allowMultiple && poll.options.some(option => option.votedByMe))}
                          className={`w-full group/poll relative p-2.5 rounded-xl text-left text-xs font-medium border transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.99] ${
                            opt.votedByMe
                              ? 'border-indigo-600 bg-white dark:bg-slate-900 shadow-xs ring-1 ring-indigo-500/30'
                              : 'border-slate-200/90 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div
                            className="absolute top-0 left-0 bottom-0 bg-indigo-500/20 dark:bg-indigo-500/35 transition-all duration-700 ease-out overflow-hidden"
                            style={{ width: `${pct}%` }}
                          >
                            {pct > 0 && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
                            )}
                          </div>
                          <div className="relative flex items-center justify-between z-10">
                            <div className="flex items-center gap-1.5">
                              {opt.votedByMe && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 animate-stamp-check" />
                              )}
                              <span className="text-slate-800 dark:text-slate-200 text-xs font-medium">
                                {opt.text}
                              </span>
                            </div>
                            <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono text-xs">
                              {pct}% ({opt.votes})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isHost && highestVotes > 0 && roomStatus === 'ACTIVE' && (
                    <button type="button" onClick={() => onAddDecision(
                      `Kết quả bình chọn: ${poll.question}`,
                      `${leadingOptions.length > 1 ? 'Các phương án đồng hạng' : 'Phương án dẫn đầu'}: ${leadingOptions.map(option => option.text).join(', ')} (${highestVotes} phiếu)`
                    )} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                      Tạo đề xuất quyết định từ kết quả
                    </button>
                  )}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Dẫn đầu: <strong className="text-indigo-600 dark:text-indigo-400">{highestVotes > 0 ? leadingOptions.map(option => option.text).join(', ') : 'Chưa có'}</strong> ({highestVotes} phiếu)
                    </span>
                    {isPollClosed ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã ngừng nhận phiếu</span>
                      </span>
                    ) : (
                      isHost && (
                        <button
                          onClick={onClosePoll}
                          disabled={roomStatus !== 'ACTIVE' || !onClosePoll}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đóng bình chọn</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && !hasActivePoll && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 animate-fade-slide-up">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-500 mb-3">
                  <Vote className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chưa có tin nhắn hoặc bình chọn</p>
                <p className="text-[11px] text-slate-400 mt-1">Hãy gửi tin nhắn đầu tiên hoặc mở cuộc bình chọn để bắt đầu!</p>
              </div>
            )}

              <ChatMessageList messages={messages} onOpenDecisions={openDecisions} onReply={roomStatus === 'ACTIVE' ? setReplyTo : undefined} />
          </div>

          {unreadCount > 0 && <button type="button" onClick={() => scrollToBottom()}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 rounded-full px-4 py-2 text-xs font-semibold bg-indigo-600 text-white shadow-lg cursor-pointer">
            {unreadCount} tin nhắn mới ↓
          </button>}
          <div className="px-4 py-2 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 space-y-1.5 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  const pollEl = document.querySelector('[data-poll-card="true"]');
                  if (pollEl) {
                    pollEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer shadow-2xs text-[11px] font-semibold active:scale-95"
              >
                <Vote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Bình chọn</span>
              </button>

              {isHost && onOpenCreatePoll && (
                <button
                  type="button"
                  onClick={onOpenCreatePoll}
                  disabled={roomStatus !== 'ACTIVE'}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer shadow-2xs text-[11px] font-semibold disabled:opacity-50 active:scale-95"
                >
                  <Vote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Tạo bình chọn</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenWheelModal}
                disabled={roomStatus !== 'ACTIVE'}
                className="group/wheel px-2.5 py-1 rounded-lg bg-amber-50/80 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/80 flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer shadow-2xs text-[11px] font-semibold disabled:opacity-50 active:scale-95"
              >
                <Disc
                  className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin group-hover/wheel:[animation-duration:1.5s] transition-all"
                  style={{ animationDuration: '8s' }}
                />
                <span>Vòng quay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddDecisionForm(true);
                  setIsDecisionsDrawerOpen(true);
                }}
                disabled={roomStatus !== 'ACTIVE'}
                className="px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer shadow-2xs text-[11px] font-semibold disabled:opacity-50 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đề xuất quyết định</span>
              </button>
            </div>

            <div className="w-full min-w-0">
              <ChatInputBar roomStatus={roomStatus} onSendMessage={onSendMessage} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
            </div>
          </div>
        </main>

        <MotionPresence open={isSidebarOpen} duration={400}>
          <button type="button" aria-label="Đóng thông tin phòng" onClick={() => setIsSidebarOpen(false)}
            className="motion-overlay fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />
          <aside id="room-sidebar" data-native-scroll className="motion-sidebar fixed top-20 bottom-3 right-2 z-40 w-[min(88vw,360px)] p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl lg:static lg:z-auto lg:w-auto lg:p-0 lg:bg-transparent lg:dark:bg-transparent lg:border-0 lg:shadow-none flex flex-col gap-3 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="lg:hidden self-end p-2 rounded-lg text-slate-500" aria-label="Thu gọn thông tin phòng"><X className="w-4 h-4" /></button>
            <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Thông tin phòng
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Xem mã QR để quét vào phòng"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Quét mã QR</span>
                </button>
              </div>

              <RoomCountdown expiresAt={expiresAt} createdAt={createdAt} roomStatus={roomStatus} onExpired={onRoomExpired} />

              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-xs">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                    #{roomCode}
                  </span>
                  <span className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {displayUrl}
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500 animate-stamp-check" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Danh sách thành viên ({participants.length}/{maxParticipants})</span>
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {onlineCount} online
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 relative shadow-xs"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {p.nickname.charAt(0)}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            p.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.nickname}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {p.isOnline ? 'Đang online' : 'Vừa rời đi'}
                        </p>
                      </div>
                    </div>

                    {p.role === 'HOST' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                        HOST
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium">Thành viên</span>
                        {isHost && roomStatus === 'ACTIVE' && onKickParticipant && (
                          <button
                            type="button"
                            onClick={() => void onKickParticipant(p.id)}
                            disabled={kickingGuestId !== null}
                            aria-label={`Loại ${p.nickname} khỏi phòng`}
                            aria-busy={kickingGuestId === p.id}
                            title={`Loại ${p.nickname} khỏi phòng`}
                            className="flex items-center gap-1 rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            {kickingGuestId === p.id && <span className="text-[10px]">Đang loại...</span>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isHost && roomStatus === 'ACTIVE' && onToggleJoinLock && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void onToggleJoinLock()}
                    disabled={isUpdatingJoinLock}
                    aria-pressed={joinLocked}
                    aria-busy={isUpdatingJoinLock}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 px-3 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950 transition-colors"
                  >
                    {joinLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {isUpdatingJoinLock ? 'Đang cập nhật...' : joinLocked ? 'Mở lại lượt tham gia' : 'Khóa lượt tham gia mới'}
                  </button>
                  <p role="status" className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {joinLocked ? 'Đang khóa người mới. Thành viên hiện tại vẫn sử dụng phòng.' : 'Người có liên kết có thể tham gia khi phòng còn chỗ.'}
                  </p>
                </div>
              )}

              {((isHost && roomStatus === 'ACTIVE') || roomStatus !== 'ACTIVE') && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 shrink-0">
                  {roomStatus === 'ACTIVE' ? (
                    <button
                      onClick={onCloseRoom}
                      className="w-full relative overflow-hidden py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 group/btn"
                    >
                      <Lock className="w-3.5 h-3.5 group-hover/btn:rotate-6 transition-transform" />
                      <span>Đóng phòng & Khóa kết quả</span>
                    </button>
                  ) : (
                    <button
                      onClick={onOpenExport}
                      className="w-full relative overflow-hidden py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 group/btn"
                    >
                      <FileText className="w-3.5 h-3.5 group-hover/btn:rotate-6 transition-transform" />
                      <span>Mở Biên Bản Quyết Định</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </MotionPresence>
      </div>

      <MotionPresence open={isDecisionsDrawerOpen} duration={320}>
        <div className="motion-overlay fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setIsDecisionsDrawerOpen(false)}
          />

          <div role="dialog" aria-modal="true" aria-label="Bảng Quyết Định" className="motion-drawer w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200/90 dark:border-slate-800 flex flex-col z-10">
            <div className="p-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Bảng Quyết Định
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {confirmedCount} đã chốt • {proposedCount} đang chờ duyệt
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {roomStatus === 'ACTIVE' && (
                  <button
                    onClick={() => setShowAddDecisionForm(!showAddDecisionForm)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDecisionsDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showAddDecisionForm && (
                <form
                  onSubmit={handleCreateDecision}
                  className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-2.5 shadow-xs animate-fade-slide-up"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles
                        className="w-3.5 h-3.5 text-indigo-500 animate-spin"
                        style={{ animationDuration: '6s' }}
                      />
                      Đề xuất quyết định mới
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddDecisionForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Tiêu đề quyết định..."
                    value={newDecTitle}
                    onChange={(e) => setNewDecTitle(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Ghi chú thêm hoặc bằng chứng (tùy chọn)..."
                    value={newDecDetails}
                    onChange={(e) => setNewDecDetails(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddDecisionForm(false)}
                      className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition-all hover:scale-105 active:scale-95"
                    >
                      Ghim quyết định
                    </button>
                  </div>
                </form>
              )}

              {decisions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Chưa có quyết định nào được chốt trong phòng.
                </div>
              ) : (
                decisions.map((dec) => {
                  const isConfirmed = dec.status === 'CONFIRMED';
                  const isJustConfirmed = justConfirmedId === dec.id;

                  return (
                    <div
                      key={dec.id}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 relative group/card ${
                        isJustConfirmed
                          ? 'animate-emerald-pop ring-2 ring-emerald-500/70 bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-400'
                          : isConfirmed
                          ? 'bg-white dark:bg-slate-900 border-emerald-300/80 dark:border-emerald-800/80 shadow-xs hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/10 hover:-translate-y-0.5'
                          : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-800/60 hover:border-amber-400 hover:shadow-md hover:shadow-amber-500/10 hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-start gap-2 min-w-0">
                          {isJustConfirmed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 animate-stamp-check" />
                          ) : isConfirmed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 group-hover/card:scale-110 transition-transform duration-200" />
                          ) : (
                            <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 group-hover/card:scale-110 transition-transform duration-200" />
                          )}
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">
                              {dec.title}
                            </h3>
                            {dec.details && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                {dec.details}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-all ${
                            isJustConfirmed
                              ? 'animate-badge-pop bg-emerald-500 text-white shadow-xs'
                              : isConfirmed
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {dec.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                        <span className="truncate max-w-[200px]">
                          {dec.evidenceRef || 'Đồng thuận nhóm'}
                        </span>
                        <span>{dec.approveCount ?? 0} tán thành · {dec.rejectCount ?? 0} phản đối</span>
                        {dec.status === 'PROPOSED' && roomStatus === 'ACTIVE' && (
                          <button
                            onClick={() => handleConfirmWithAnimation(dec.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] cursor-pointer shadow-xs hover:shadow-md hover:shadow-emerald-500/30 transition-all duration-200 flex items-center gap-1 group/btn"
                          >
                            <Check className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                            <span>{isHost ? 'Chốt quyết định' : 'Tán thành'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
              <button
                onClick={() => {
                  setIsDecisionsDrawerOpen(false);
                  onOpenExport();
                }}
                className="relative overflow-hidden w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] group/btn"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-sweep pointer-events-none" />
                <FileText className="w-3.5 h-3.5 group-hover/btn:rotate-6 transition-transform" />
                <span>Xuất biên bản {confirmedCount > 0 && `(${confirmedCount} quyết định)`}</span>
              </button>
            </div>
          </div>
        </div>
      </MotionPresence>

      <Suspense fallback={null}>
      <MotionPresence open={isQrModalOpen}><RoomQrModal
        isOpen
        onClose={() => setIsQrModalOpen(false)}
        roomTitle={roomTitle}
        roomCode={roomCode}
      /></MotionPresence>
      </Suspense>
    </div>
  );
};
