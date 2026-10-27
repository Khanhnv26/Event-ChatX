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

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const result = [...previous];
  for (const message of incoming) {
    const index = result.findIndex(item => item.id === message.id ||
      Boolean(message.clientMessageId && (item.id === message.clientMessageId || item.clientMessageId === message.clientMessageId)));
    if (index === -1) result.push(message);
    else result[index] = message;
  }
  return result.sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER));
}

function mergePoll(previous: Poll | undefined, incoming: Poll): Poll {
  const options = incoming.options.map(option => {
    const old = previous?.options.find(item => item.id === option.id);
    return { ...option, votes: Math.max(option.votes, old?.votes ?? 0),
      votedByMe: Boolean(option.votedByMe || old?.votedByMe) };
  });
  return { ...incoming, isClosed: incoming.isClosed || Boolean(previous?.isClosed),
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0), options };
}

export function useEventChat(slug: string, session: UserSession | null) {
  const [roomTitle, setRoomTitle] = useState('Đang tải phòng...');
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('ACTIVE');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const activePoll = polls.find(poll => poll.id === selectedPollId) ?? polls[0];
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [wheels, setWheels] = useState<WheelItem[]>([]);
  const [currentWheel, setCurrentWheel] = useState<WheelResponse | null>(null);
  const [remoteWinner, setRemoteWinner] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const maxSequenceRef = useRef<number>(0);
  const generationRef = useRef(0);
  const votingRef = useRef(false);

  // 1. Convert Backend DTOs to Mockup types
  const mapMessage = useCallback((msg: MessageResponse): ChatMessage => {
    const isMe = Boolean(
      session?.slug === slug && session?.guestId && msg.senderGuestId === session.guestId
    );
    return {
      id: msg.id || msg.clientMessageId,
      clientMessageId: msg.clientMessageId,
      sequence: msg.sequence,
      senderId: msg.senderGuestId || 'system',
      senderName: isMe ? `${msg.senderNickname} (Bạn)` : msg.senderNickname,
      senderRole: isMe ? session!.role : 'PARTICIPANT',
      avatarColor: pickAvatarColor(msg.senderGuestId || 'system'),
      content: msg.body,
      createdAt: formatTime(msg.createdAt),
      type: msg.messageType === 'SYSTEM' ? 'SYSTEM' : 'TEXT',
      isMe,
    };
  }, [session, slug]);

  const mapPoll = useCallback((p: PollResponse): Poll => {
    const totalVotes = p.options.reduce((sum, o) => sum + o.voteCount, 0);
    return {
      id: String(p.id),
      question: p.question,
      totalVotes,
      isClosed: p.status === 'CLOSED',
      allowMultiple: p.allowMultiple,
      createdBy: 'Host',
      options: p.options.map((o) => ({
        id: String(o.id),
        text: o.label,
        votes: o.voteCount,
        votedByMe: p.votedOptionIds?.includes(o.id),
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
    const generation = generationRef.current;
    setIsLoading(true);
    setError(null);
    try {
      // Tools load independently: a slow wheel must not block chat or polls.
      const tools = [
        eventChatApi.getPolls(slug).then(pollList => {
          if (generation !== generationRef.current) return;
          setPolls(prev => {
            const snapshot = pollList.map(raw => mergePoll(prev.find(p => p.id === String(raw.id)), mapPoll(raw)));
            return [...prev.filter(p => !snapshot.some(item => item.id === p.id)), ...snapshot];
          });
        }),
        eventChatApi.getDecisions(slug).then(decList => {
          if (generation === generationRef.current) setDecisions(decList.map(mapDecision));
        }),
        eventChatApi.getWheels(slug).then(wheelList => {
          if (generation !== generationRef.current) return;
          const wheel = wheelList[0] ?? null;
          setCurrentWheel(wheel);
          setWheels(wheel?.entries.map((label, idx) => ({ id: String(idx + 1), label,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length] })) ?? []);
        }),
      ];
      void Promise.allSettled(tools).then(results => {
        if (generation === generationRef.current && results.some(result => result.status === 'rejected')) {
          setActionError('Một số công cụ chưa tải được. Bạn vẫn có thể trò chuyện; hãy kết nối lại để thử lại.');
        }
      });
      const [roomData, msgList] = await Promise.all([
        eventChatApi.getRoomDetails(slug),
        eventChatApi.getMessages(slug),
      ]);
      if (generation !== generationRef.current) return;

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
      setMessages(prev => mergeMessages(prev, msgList.map(mapMessage)));

    } catch (err: unknown) {
      if (generation !== generationRef.current) return;
      const e = err as Error;
      setError(e.message || 'Không thể tải thông tin phòng');
    } finally {
      if (generation === generationRef.current) setIsLoading(false);
    }
  }, [slug, mapMessage, mapPoll, mapDecision]);

  // 3. Sync Missed Messages (FR-05)
  const syncMissedMessages = useCallback(async () => {
    if (!slug) return;
    const generation = generationRef.current;
    try {
      let cursor = maxSequenceRef.current;
      while (generation === generationRef.current) {
        const newerMsgs = await eventChatApi.getMessages(slug, cursor);
        if (generation !== generationRef.current) return;
        setMessages(prev => mergeMessages(prev, newerMsgs.map(mapMessage)));
        const nextCursor = newerMsgs.reduce((max, msg) => Math.max(max, msg.sequence), cursor);
        maxSequenceRef.current = nextCursor;
        if (newerMsgs.length < 100 || nextCursor === cursor) break;
        cursor = nextCursor;
      }
    } catch (e) {
      console.warn('Failed to sync missed messages', e);
    }
  }, [slug, mapMessage]);

  // 4. WebSocket STOMP Connection Lifecycle
  useEffect(() => {
    if (!slug) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    maxSequenceRef.current = 0;
    setMessages([]);
    setPolls([]);
    setSelectedPollId(null);
    setDecisions([]);
    setWheels([]);
    setCurrentWheel(null);
    setRemoteWinner(null);
    setActionError(null);
    const initialData = loadInitialData();

    stompClient.connect(slug, {
      onConnect: async () => {
        await initialData;
        if (generation !== generationRef.current) return;
        await syncMissedMessages();
        // Recover non-message state after a reconnect as well.
        try {
          const [room, pollList, decisionList, wheelList] = await Promise.all([
            eventChatApi.getRoomDetails(slug), eventChatApi.getPolls(slug),
            eventChatApi.getDecisions(slug), eventChatApi.getWheels(slug),
          ]);
          if (generation !== generationRef.current) return;
          setRoomTitle(room.title);
          setRoomStatus(room.status);
          setExpiresAt(room.expiresAt);
          setCreatedAt(room.createdAt);
          setError(null);
          setParticipants(room.participants.map(p => ({ id: p.guestId, nickname: p.nickname,
            role: p.role, isOnline: true, avatarColor: pickAvatarColor(p.guestId) })));
          setPolls(prev => pollList.map(raw => mergePoll(prev.find(p => p.id === String(raw.id)), mapPoll(raw))));
          setDecisions(decisionList.map(mapDecision));
          const wheel = wheelList[0] ?? null;
          setCurrentWheel(wheel);
          setWheels(wheel?.entries.map((label, idx) => ({ id: String(idx + 1), label,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length] })) ?? []);
        } catch (err) {
          console.warn('Failed to refresh room after reconnect', err);
        }
      },
      onMessage: (msg: MessageResponse) => {
        setMessages(prev => mergeMessages(prev, [mapMessage(msg)]));

        if (msg.messageType === 'SYSTEM' && msg.metadata?.event === 'ROOM_CLOSED') {
          setRoomStatus('CLOSED');
        }
        if (msg.messageType === 'SYSTEM' && msg.metadata?.event === 'MEMBER_JOINED') {
          void eventChatApi.getRoomDetails(slug).then(room => {
            if (generation !== generationRef.current) return;
            setParticipants(room.participants.map(p => ({ id: p.guestId, nickname: p.nickname,
              role: p.role, isOnline: true, avatarColor: pickAvatarColor(p.guestId) })));
          }).catch(() => { /* The next reconnect refreshes presence. */ });
        }
      },
      onPoll: (p: PollResponse) => {
        setPolls((prev) => {
          const updated = mapPoll(p);
          const idx = prev.findIndex((item) => item.id === updated.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = mergePoll(prev[idx], updated);
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
        setRemoteWinner(w.spins[0]?.resultEntry ?? null);
        setCurrentWheel(w);
        setWheels(
          w.entries.map((entry, idx) => ({
            id: String(idx + 1),
            label: entry,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          }))
        );
      },
      onWheelSpin: spin => setRemoteWinner(spin.resultEntry),
    });

    return () => {
      generationRef.current += 1;
      stompClient.disconnect();
    };
  }, [slug, loadInitialData, mapMessage, mapPoll, mapDecision, syncMissedMessages]);

  useEffect(() => {
    if (!expiresAt || roomStatus !== 'ACTIVE') return;
    const update = () => {
      if (Date.now() >= new Date(expiresAt).getTime()) setRoomStatus('EXPIRED');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, roomStatus]);

  // 5. Actions with Optimistic UI
  const sendMessage = useCallback(
    async (text: string) => {
      if (!slug || !text.trim() || roomStatus !== 'ACTIVE' || session?.slug !== slug) return false;
      setActionError(null);

      const clientMessageId = crypto.randomUUID();
      const optimisticMsg: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
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
        const response = await eventChatApi.sendMessage(slug, clientMessageId, text.trim());
        setMessages(prev => mergeMessages(prev.filter(msg => msg.id !== clientMessageId), [mapMessage(response)]));
        return true;
      } catch (err) {
        setMessages(prev => prev.filter(msg => msg.id !== clientMessageId));
        setActionError(err instanceof Error ? err.message : 'Không thể gửi tin nhắn');
        return false;
      }
    },
    [slug, session, roomStatus, mapMessage]
  );

  const votePoll = useCallback(
    async (optionIdStr: string) => {
      if (!slug) return;
      const optionId = parseInt(optionIdStr, 10);
      if (!activePoll || activePoll.isClosed || roomStatus !== 'ACTIVE' || votingRef.current || session?.slug !== slug) return;
      if (!activePoll.options.some(opt => opt.id === optionIdStr) ||
        activePoll.options.some(opt => opt.votedByMe && (!activePoll.allowMultiple || opt.id === optionIdStr))) return;
      votingRef.current = true;
      setIsVoting(true);
      setActionError(null);

      try {
        const response = await eventChatApi.castVote(slug, parseInt(activePoll.id, 10), optionId);
        setPolls(prev => prev.map(p => {
          if (p.id !== activePoll.id) return p;
          const updated = mergePoll(p, mapPoll(response));
          return { ...updated, options: updated.options.map(opt => opt.id === optionIdStr ? { ...opt, votedByMe: true } : opt) };
        }));
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Không thể bỏ phiếu');
      } finally {
        votingRef.current = false;
        setIsVoting(false);
      }
    },
    [slug, activePoll, roomStatus, session, mapPoll]
  );

  const closePoll = useCallback(async () => {
    if (!slug || !activePoll || !session?.hostToken || roomStatus !== 'ACTIVE') return;
    setActionError(null);
    try {
      const response = await eventChatApi.closePoll(slug, Number(activePoll.id));
      setPolls(prev => prev.map(p => p.id === String(response.id) ? mergePoll(p, mapPoll(response)) : p));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đóng bình chọn');
    }
  }, [slug, activePoll, session, roomStatus, mapPoll]);

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
    if (session?.role !== 'HOST' && !session?.hostToken) {
      console.warn('Chỉ chủ phòng mới có quyền đóng phòng');
      return;
    }
    try {
      await eventChatApi.closeRoom(slug);
      setRoomStatus('CLOSED');
    } catch (err) {
      console.error('Close room failed', err);
    }
  }, [slug, session]);

  const createPoll = useCallback(
    async (question: string, options: string[], allowMultiple = false) => {
      if (!slug) return null;
      try {
        const res = await eventChatApi.createPoll(slug, question, options, allowMultiple);
        const mapped = mapPoll(res);
        setSelectedPollId(mapped.id);
        setPolls((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)]);
        return res;
      } catch (err) {
        console.error('Create poll failed', err);
        throw err;
      }
    },
    [slug, mapPoll]
  );

  const createWheel = useCallback(
    async (title: string, entries: string[], excludeWinner = false) => {
      if (!slug) return null;
      try {
        const res = await eventChatApi.createWheel(slug, title, entries, excludeWinner);
        setCurrentWheel(res);
        setWheels(
          res.entries.map((entry, idx) => ({
            id: String(idx + 1),
            label: entry,
            color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          }))
        );
        return res;
      } catch (err) {
        console.error('Create wheel failed', err);
        throw err;
      }
    },
    [slug]
  );

  const spinCurrentWheel = useCallback(async () => {
    if (!slug || !currentWheel || session?.role !== 'HOST' || roomStatus !== 'ACTIVE') return null;
    try {
      const spinRes = await eventChatApi.spinWheel(slug, currentWheel.id);
      setRemoteWinner(spinRes.resultEntry);
      return spinRes.resultEntry;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể quay');
      throw err;
    }
  }, [slug, currentWheel, session, roomStatus]);

  return {
    roomTitle,
    roomStatus,
    participants,
    messages,
    poll: activePoll || {
      id: '0',
      question: 'Chưa có bình chọn nào',
      options: [],
      totalVotes: 0,
      isClosed: true,
      createdBy: 'Hệ thống',
    },
    polls,
    selectPoll: setSelectedPollId,
    remoteWinner,
    decisions,
    wheels,
    currentWheel,
    expiresAt,
    createdAt,
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
    spinCurrentWheel,
    createPoll,
    createWheel,
    refreshData: loadInitialData,
  };
}
