import { useState, useEffect, useRef, useCallback } from 'react';
import { eventChatApi } from '../services/eventChatApi';
import { stompClient } from '../services/stompClient';
import type {
  MessageResponse,
  PollResponse,
  DecisionResponse,
  WheelResponse,
  RoomStatus,
} from '../types/backend.types';
import type { Participant, Poll, DecisionCard, ChatMessage, WheelItem } from '../mockup/types';
import type { UserSession } from './useRoomSession';

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#14B8A6'];

function pickAvatarColor(idStr: string): string {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

export function useEventChat(slug: string, session: UserSession | null) {
  const [roomTitle, setRoomTitle] = useState('Đang tải phòng...');
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('ACTIVE');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [wheels, setWheels] = useState<WheelItem[]>([]);
  const [currentWheel, setCurrentWheel] = useState<WheelResponse | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const maxSequenceRef = useRef<number>(0);

  // 1. Convert Backend DTOs to Mockup types
  const mapMessage = useCallback((msg: MessageResponse): ChatMessage => {
    const isMe = Boolean(
      (session?.guestId && msg.senderGuestId === session.guestId) ||
      (session?.nickname && msg.senderNickname === session.nickname)
    );
    return {
      id: msg.id || msg.clientMessageId,
      senderId: msg.senderGuestId || 'system',
      senderName: isMe ? `${msg.senderNickname} (Bạn)` : msg.senderNickname,
      senderRole: (msg.senderGuestId ? 'PARTICIPANT' : 'HOST'),
      avatarColor: pickAvatarColor(msg.senderGuestId || 'system'),
      content: msg.body,
      createdAt: formatTime(msg.createdAt),
      type: msg.messageType === 'SYSTEM' ? 'SYSTEM' : 'TEXT',
      isMe,
    };
  }, [session]);

  const mapPoll = useCallback((p: PollResponse): Poll => {
    const totalVotes = p.options.reduce((sum, o) => sum + o.voteCount, 0);
    return {
      id: String(p.id),
      question: p.question,
      totalVotes,
      isClosed: p.status === 'CLOSED',
      createdBy: 'Host',
      options: p.options.map((o) => ({
        id: String(o.id),
        text: o.label,
        votes: o.voteCount,
      })),
    };
  }, []);

  const mapDecision = useCallback((d: DecisionResponse): DecisionCard => {
    return {
      id: String(d.id),
      title: d.text,
      status: d.status,
      confirmedAt: d.confirmedAt ? formatTime(d.confirmedAt) : undefined,
      confirmedBy: d.creatorNickname || 'Host',
      evidenceType: 'CONSENSUS',
      evidenceRef: d.evidenceRefs && d.evidenceRefs.length > 0 ? d.evidenceRefs[0] : undefined,
    };
  }, []);

  // 2. Fetch Initial Room Data
  const loadInitialData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roomData, msgList, pollList, decList, wheelList] = await Promise.all([
        eventChatApi.getRoomDetails(slug),
        eventChatApi.getMessages(slug),
        eventChatApi.getPolls(slug),
        eventChatApi.getDecisions(slug),
        eventChatApi.getWheels(slug),
      ]);

      setRoomTitle(roomData.title);
      setRoomStatus(roomData.status);
      setExpiresAt(roomData.expiresAt);
      setCreatedAt(roomData.createdAt);

      // Participants
      setParticipants(
        roomData.participants.map((p) => ({
          id: p.guestId,
          nickname: p.nickname,
          role: p.role,
          isOnline: true,
          avatarColor: pickAvatarColor(p.guestId),
        }))
      );

      // Messages & track maxSequence
      let highestSeq = 0;
      msgList.forEach((m) => {
        if (m.sequence > highestSeq) highestSeq = m.sequence;
      });
      maxSequenceRef.current = highestSeq;
      setMessages(msgList.map(mapMessage));

      // Polls
      setPolls(pollList.map(mapPoll));

      // Decisions
      setDecisions(decList.map(mapDecision));

      // Wheels
      if (wheelList.length > 0) {
        setCurrentWheel(wheelList[0]);
        setWheels(
          wheelList[0].entries.map((entry, idx) => ({
            id: String(idx + 1),
            label: entry,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          }))
        );
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Không thể tải thông tin phòng');
    } finally {
      setIsLoading(false);
    }
  }, [slug, mapMessage, mapPoll, mapDecision]);

  // 3. Sync Missed Messages (FR-05)
  const syncMissedMessages = useCallback(async () => {
    if (!slug || maxSequenceRef.current === 0) return;
    try {
      const newerMsgs = await eventChatApi.getMessages(slug, maxSequenceRef.current);
      if (newerMsgs.length > 0) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          newerMsgs.forEach((raw) => {
            if (raw.sequence > maxSequenceRef.current) {
              maxSequenceRef.current = raw.sequence;
            }
            const uiMsg = mapMessage(raw);
            map.set(uiMsg.id, uiMsg);
          });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.warn('Failed to sync missed messages', e);
    }
  }, [slug, mapMessage]);

  // 4. WebSocket STOMP Connection Lifecycle
  useEffect(() => {
    if (!slug) return;

    loadInitialData();

    stompClient.connect(slug, {
      onConnect: () => {
        syncMissedMessages();
      },
      onMessage: (msg: MessageResponse) => {
        if (msg.sequence > maxSequenceRef.current) {
          maxSequenceRef.current = msg.sequence;
        }
        setMessages((prev) => {
          const uiMsg = mapMessage(msg);
          // Deduplicate by id or clientMessageId
          const idx = prev.findIndex((m) => m.id === uiMsg.id || (msg.clientMessageId && m.id === msg.clientMessageId));
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = uiMsg;
            return next;
          }
          return [...prev, uiMsg];
        });

        if (msg.messageType === 'SYSTEM' && msg.body.includes('đóng')) {
          setRoomStatus('CLOSED');
        }
      },
      onPoll: (p: PollResponse) => {
        setPolls((prev) => {
          const updated = mapPoll(p);
          const idx = prev.findIndex((item) => item.id === updated.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [updated, ...prev];
        });
      },
      onDecision: (d: DecisionResponse) => {
        setDecisions((prev) => {
          const updated = mapDecision(d);
          const idx = prev.findIndex((item) => item.id === updated.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [updated, ...prev];
        });
      },
      onWheel: (w: WheelResponse) => {
        setCurrentWheel(w);
        setWheels(
          w.entries.map((entry, idx) => ({
            id: String(idx + 1),
            label: entry,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          }))
        );
      },
    });

    return () => {
      stompClient.disconnect();
    };
  }, [slug, loadInitialData, mapMessage, mapPoll, mapDecision, syncMissedMessages]);

  // 5. Actions with Optimistic UI
  const sendMessage = useCallback(
    async (text: string) => {
      if (!slug || !text.trim()) return;

      const clientMessageId = crypto.randomUUID();
      const optimisticMsg: ChatMessage = {
        id: clientMessageId,
        senderId: session?.guestId || 'me',
        senderName: session?.nickname ? `${session.nickname} (Bạn)` : 'Bạn',
        senderRole: session?.role || 'PARTICIPANT',
        avatarColor: pickAvatarColor(session?.guestId || 'me'),
        content: text,
        createdAt: formatTime(new Date().toISOString()),
        type: 'TEXT',
        isMe: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        await eventChatApi.sendMessage(slug, clientMessageId, text);
      } catch (err) {
        console.error('Send message failed', err);
      }
    },
    [slug, session]
  );

  const votePoll = useCallback(
    async (optionIdStr: string) => {
      if (!slug) return;
      const optionId = parseInt(optionIdStr, 10);
      const activePoll = polls[0];
      if (!activePoll) return;

      // Optimistic update
      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== activePoll.id) return p;
          return {
            ...p,
            totalVotes: p.totalVotes + 1,
            options: p.options.map((opt) =>
              opt.id === optionIdStr
                ? { ...opt, votes: opt.votes + 1, votedByMe: true }
                : opt.votedByMe
                ? { ...opt, votes: Math.max(0, opt.votes - 1), votedByMe: false }
                : opt
            ),
          };
        })
      );

      try {
        await eventChatApi.castVote(slug, parseInt(activePoll.id, 10), optionId);
      } catch (err) {
        console.error('Vote failed', err);
      }
    },
    [slug, polls]
  );

  const addDecision = useCallback(
    async (title: string, details?: string) => {
      if (!slug) return;
      try {
        await eventChatApi.createDecision(slug, title, true, details ? [details] : []);
      } catch (err) {
        console.error('Add decision failed', err);
      }
    },
    [slug]
  );

  const confirmDecision = useCallback(
    async (decisionIdStr: string) => {
      if (!slug) return;
      const decisionId = parseInt(decisionIdStr, 10);
      try {
        if (session?.role === 'HOST') {
          await eventChatApi.updateDecisionStatus(slug, decisionId, 'CONFIRMED');
        } else {
          await eventChatApi.confirmDecision(slug, decisionId, 'APPROVE');
        }
      } catch (err) {
        console.error('Confirm decision failed', err);
      }
    },
    [slug, session]
  );

  const closeRoom = useCallback(async () => {
    if (!slug) return;
    try {
      await eventChatApi.closeRoom(slug);
      setRoomStatus('CLOSED');
    } catch (err) {
      console.error('Close room failed', err);
    }
  }, [slug]);

  const spinCurrentWheel = useCallback(async () => {
    if (!slug || !currentWheel) return null;
    try {
      const spinRes = await eventChatApi.spinWheel(slug, currentWheel.id);
      return spinRes.resultEntry;
    } catch (err) {
      console.error('Spin wheel failed', err);
      return null;
    }
  }, [slug, currentWheel]);

  return {
    roomTitle,
    roomStatus,
    participants,
    messages,
    poll: polls[0] || {
      id: '0',
      question: 'Chưa có bình chọn nào',
      options: [],
      totalVotes: 0,
      isClosed: true,
      createdBy: 'Hệ thống',
    },
    polls,
    decisions,
    wheels,
    currentWheel,
    expiresAt,
    createdAt,
    isLoading,
    error,
    sendMessage,
    votePoll,
    addDecision,
    confirmDecision,
    closeRoom,
    spinCurrentWheel,
    refreshData: loadInitialData,
  };
}
