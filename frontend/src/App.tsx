import { useState, useEffect } from 'react';
import { Navbar } from './mockup/components/Navbar';
import { LandingView } from './mockup/components/LandingView';
import { RoomWorkspaceView } from './mockup/components/RoomWorkspaceView';
import { WheelSpinModal } from './mockup/components/WheelSpinModal';
import { ExportSummaryModal } from './mockup/components/ExportSummaryModal';
import { InteractiveBackground } from './mockup/components/InteractiveBackground';
import {
  INITIAL_PARTICIPANTS,
  INITIAL_POLL,
  INITIAL_DECISIONS,
  INITIAL_MESSAGES,
  INITIAL_WHEEL_ITEMS,
} from './mockup/mockData';
import type { Participant, Poll, DecisionCard, ChatMessage, WheelItem } from './mockup/types';

export function App() {
  const [currentView, setCurrentView] = useState<'LANDING' | 'ROOM' | 'WHEEL' | 'EXPORT'>('LANDING');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eventchat_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [roomStatus, setRoomStatus] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');

  // Room State
  const [roomTitle, setRoomTitle] = useState('Kèo Teambuilding & Chốt Đồ Án Cuối Tuần');
  const [roomCode] = useState('EVT-9824');
  const [participants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [poll, setPoll] = useState<Poll>(INITIAL_POLL);
  const [decisions, setDecisions] = useState<DecisionCard[]>(INITIAL_DECISIONS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [wheelItems] = useState<WheelItem[]>(INITIAL_WHEEL_ITEMS);
  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);

  // Sync dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('eventchat_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('eventchat_theme', 'light');
    }
  }, [isDarkMode]);

  // Handlers
  const handleEnterRoom = (title?: string) => {
    if (title) setRoomTitle(title);
    setCurrentView('ROOM');
  };

  const handleSendMessage = (text: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'current-user',
      senderName: 'Bạn (Participant)',
      senderRole: 'PARTICIPANT',
      avatarColor: '#10B981',
      content: text,
      createdAt: timeStr,
      type: 'TEXT',
    };

    setMessages((prev) => [...prev, newMessage]);
  };

  const handleVotePoll = (optionId: string) => {
    setPoll((prev) => {
      const alreadyVoted = prev.options.some((o) => o.id === optionId && o.votedByMe);
      if (alreadyVoted) return prev;

      const updatedOptions = prev.options.map((opt) => {
        if (opt.id === optionId) {
          return { ...opt, votes: opt.votes + 1, votedByMe: true };
        }
        if (opt.votedByMe) {
          return { ...opt, votes: Math.max(0, opt.votes - 1), votedByMe: false };
        }
        return opt;
      });

      return {
        ...prev,
        options: updatedOptions,
        totalVotes: prev.totalVotes + 1,
      };
    });
  };

  const handleConfirmWinnerAsDecision = (winnerLabel: string) => {
    const newDecision: DecisionCard = {
      id: `dec-${Date.now()}`,
      title: `Lựa chọn ngẫu nhiên: ${winnerLabel}`,
      details: 'Được chốt tự động từ Vòng quay may mắn với kết quả đồng thuận toàn phòng.',
      status: 'CONFIRMED',
      confirmedAt: 'Vừa xong',
      confirmedBy: 'Hệ thống EventChat',
      evidenceType: 'WHEEL',
      evidenceRef: 'Vòng quay may mắn',
    };

    setDecisions((prev) => [...prev, newDecision]);

    // Send a celebratory notif to chat
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-wheel-${Date.now()}`,
        senderId: 'system',
        senderName: 'Hệ thống EventChat',
        senderRole: 'HOST',
        avatarColor: '#F59E0B',
        content: `🎉 Vòng quay đã dừng lại ở: [${winnerLabel}]. Kết quả đã được tự động thêm vào Bảng Quyết Định!`,
        createdAt: timeStr,
        type: 'DECISION_NOTIF',
      },
    ]);
  };

  const handleConfirmDecision = (decisionId: string) => {
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? { ...d, status: 'CONFIRMED', confirmedAt: 'Vừa xong' } : d))
    );
  };

  const handleAddDecision = (title: string, details: string) => {
    const newDec: DecisionCard = {
      id: `dec-${Date.now()}`,
      title,
      details,
      status: 'PROPOSED',
      confirmedBy: 'Bạn',
      evidenceType: 'CONSENSUS',
    };
    setDecisions((prev) => [...prev, newDec]);
  };

  const handleCloseRoom = () => {
    setRoomStatus('CLOSED');
    setCurrentView('EXPORT');
  };

  const handleToggleRoomStatus = () => {
    setRoomStatus((prev) => (prev === 'ACTIVE' ? 'CLOSED' : 'ACTIVE'));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative selection:bg-indigo-500 selection:text-white">
      {/* Abstract Interactive Mouse & Aurora Background */}
      <InteractiveBackground mode={currentView === 'LANDING' ? 'landing' : 'workspace'} />

      {/* Top Application Bar */}
      <div className="relative z-30">
        <Navbar
          currentView={currentView}
          setCurrentView={(view) => {
            if (view === 'WHEEL') {
              setIsWheelModalOpen(true);
            } else {
              setCurrentView(view);
            }
          }}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          roomStatus={roomStatus}
        />
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col relative z-10">
        {currentView === 'LANDING' && (
          <LandingView onEnterRoom={handleEnterRoom} />
        )}

        {currentView === 'ROOM' && (
          <RoomWorkspaceView
            roomTitle={roomTitle}
            roomCode={roomCode}
            roomStatus={roomStatus}
            participants={participants}
            poll={poll}
            decisions={decisions}
            messages={messages}
            onSendMessage={handleSendMessage}
            onVotePoll={handleVotePoll}
            onOpenWheelModal={() => setIsWheelModalOpen(true)}
            onConfirmDecision={handleConfirmDecision}
            onAddDecision={handleAddDecision}
            onCloseRoom={handleCloseRoom}
            onOpenExport={() => setCurrentView('EXPORT')}
          />
        )}

        {currentView === 'EXPORT' && (
          <ExportSummaryModal
            roomTitle={roomTitle}
            roomCode={roomCode}
            decisions={decisions}
            poll={poll}
            participants={participants}
            onBackToRoom={() => setCurrentView('ROOM')}
            onToggleRoomStatus={handleToggleRoomStatus}
            roomStatus={roomStatus}
          />
        )}
      </div>

      {/* Wheel Modal Overlay (can be opened from any view or Room Workspace) */}
      <WheelSpinModal
        isOpen={isWheelModalOpen}
        onClose={() => setIsWheelModalOpen(false)}
        items={wheelItems}
        onConfirmWinnerAsDecision={handleConfirmWinnerAsDecision}
      />
    </div>
  );
}

export default App;
