import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { eventChatApi } from '../services/eventChatApi';
import { stompClient } from '../services/stompClient';
import type {
  MessageResponse,
  PollResponse,
  DecisionResponse,
  WheelResponse,
  RoomStatus,
  AttachmentResponse,
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
  const [maxParticipants, setMaxParticipants] = useState(50);
  const onlineGuestsRef = useRef(new Set<string>());
  const [presenceKnown, setPresenceKnown] = useState(false);
  const presenceRequestRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const activePoll = polls.find(poll => poll.id === selectedPollId) ?? polls[0];
  const [decisions, setDecisions] = useState<DecisionCard[]>([]);
  const [wheelList, setWheelList] = useState<WheelResponse[]>([]);
  const [selectedWheelId, setSelectedWheelId] = useState<number | null>(null);
  const currentWheel = wheelList.find(w => w.id === selectedWheelId) ?? wheelList[0] ?? null;
  const wheels = useMemo<WheelItem[]>(() => currentWheel?.entries.map((label, index) => ({
    id: String(index + 1), label, color: AVATAR_COLORS[index % AVATAR_COLORS.length],
  })) ?? [], [currentWheel]);
  const remoteWinner = currentWheel?.spins[0]?.resultEntry ?? null;
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [joinLocked, setJoinLocked] = useState(false);
  const [isUpdatingJoinLock, setIsUpdatingJoinLock] = useState(false);
  const joinLockRequestRef = useRef<symbol | null>(null);
  const [kickingGuestId, setKickingGuestId] = useState<string | null>(null);
  const kickRequestRef = useRef<symbol | null>(null);
  const kickedGuestsRef = useRef(new Set<string>());

  const maxSequenceRef = useRef<number>(0);
  const generationRef = useRef(0);
  const votingRef = useRef(false);

  const mapMessage = useCallback((msg: MessageResponse): ChatMessage => {
    const isMe = Boolean(
      session?.slug === slug && session?.guestId && msg.senderGuestId === session.guestId
    );
    return {
      id: msg.id || msg.clientMessageId,
      clientMessageId: msg.clientMessageId,
      attachments: msg.attachments,
      sequence: msg.sequence,
      senderId: msg.senderGuestId || 'system',
      senderName: isMe ? `${msg.senderNickname} (Bạn)` : msg.senderNickname,
      senderRole: isMe ? session!.role : 'PARTICIPANT',
      avatarColor: pickAvatarColor(msg.senderGuestId || 'system'),
      content: msg.body,
      replyToId: msg.replyToId,
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
      approveCount: d.approveCount,
      rejectCount: d.rejectCount,
      confirmedAt: d.confirmedAt ? formatTime(d.confirmedAt) : undefined,
      confirmedBy: d.creatorNickname || 'Host',
      evidenceType: 'CONSENSUS',
      evidenceRef: d.evidenceRefs && d.evidenceRefs.length > 0 ? d.evidenceRefs[0] : undefined,
    };
  }, []);

  const loadInitialData = useCallback(async (onAuthorized?: () => void) => {
    if (!slug || session?.slug !== slug || !session.sessionToken) return false;
    const generation = generationRef.current;
    setIsLoading(true);
    setError(null);
    try {
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
          setWheelList(wheelList);
          setSelectedWheelId(previous => previous ?? wheelList[0]?.id ?? null);
        }),
      ];
      void Promise.allSettled(tools).then(results => {
        if (generation === generationRef.current && results.some(result => result.status === 'rejected')) {
          setActionError('Một số công cụ chưa tải được. Bạn vẫn có thể trò chuyện; hãy kết nối lại để thử lại.');
        }
      });
      const [roomData, msgList] = await Promise.all([
        eventChatApi.getRoomDetails(slug).then(room => {
          if (generation === generationRef.current) onAuthorized?.();
          return room;
        }),
        eventChatApi.getMessages(slug),
      ]);
      if (generation !== generationRef.current) return;

      setRoomTitle(roomData.title);
      setRoomStatus(roomData.status);
      setMaxParticipants(roomData.maxParticipants);
      setJoinLocked(roomData.joinLocked);
      setExpiresAt(roomData.expiresAt);
      setCreatedAt(roomData.createdAt);

      setParticipants(
        roomData.participants.filter(p => !kickedGuestsRef.current.has(p.guestId)).map((p) => ({
          id: p.guestId,
          nickname: p.nickname,
          role: p.role,
          isOnline: onlineGuestsRef.current.has(p.guestId),
          avatarColor: pickAvatarColor(p.guestId),
        }))
      );

      let highestSeq = 0;
      msgList.forEach((m) => {
        if (m.sequence > highestSeq) highestSeq = m.sequence;
      });
      maxSequenceRef.current = highestSeq;
      setMessages(prev => mergeMessages(prev, msgList.map(mapMessage)));
      return true;

    } catch (err: unknown) {
      if (generation !== generationRef.current) return;
      const e = err as Error;
      setError(e.message || 'Không thể tải thông tin phòng');
      return false;
    } finally {
      if (generation === generationRef.current) setIsLoading(false);
    }
  }, [slug, session, mapMessage, mapPoll, mapDecision]);

  const syncMissedMessages = useCallback(async () => {
    if (!slug || session?.slug !== slug || !session.sessionToken) return;
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
  }, [slug, session, mapMessage]);

  const refreshPresence = useCallback(async () => {
    if (!slug || session?.slug !== slug || !session.sessionToken) return;
    const generation = generationRef.current;
    const request = ++presenceRequestRef.current;
    try {
      const online = await eventChatApi.getPresence(slug);
      if (generation !== generationRef.current || request !== presenceRequestRef.current) return;
      onlineGuestsRef.current = new Set(online);
      setParticipants(previous => previous.map(p => ({ ...p, isOnline: onlineGuestsRef.current.has(p.id) })));
      setPresenceKnown(true);
    } catch {
      if (generation === generationRef.current && request === presenceRequestRef.current) {
        setPresenceKnown(false);
      }
    }
  }, [slug, session]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    maxSequenceRef.current = 0;
    setMessages([]);
    setParticipants([]);
    onlineGuestsRef.current.clear();
    setPresenceKnown(false);
    setRoomTitle('Đang tải phòng...');
    setRoomStatus('ACTIVE');
    setExpiresAt(null);
    setCreatedAt(null);
    setError(null);
    setPolls([]);
    setSelectedPollId(null);
    setDecisions([]);
    setWheelList([]);
    setSelectedWheelId(null);
    setActionError(null);
    setJoinLocked(false);
    setIsUpdatingJoinLock(false);
    joinLockRequestRef.current = null;
    kickRequestRef.current = null;
    kickedGuestsRef.current.clear();
    setKickingGuestId(null);
    if (!slug || session?.slug !== slug || !session.sessionToken) {
      setIsLoading(false);
      return;
    }
    const initialData = loadInitialData(() => {
      if (generation !== generationRef.current) return;
      stompClient.connect(slug, {
        onAccessDenied: () => {
          if (generation !== generationRef.current) return;
          setError('Kết nối bị từ chối. Hãy kiểm tra quyền tham gia hoặc tải lại phòng.');
          setMessages([]); setParticipants([]); setPolls([]); setDecisions([]); setWheelList([]);
          generationRef.current += 1;
          setIsLoading(false);
        },
        onRoomEvent: event => {
          if (generation !== generationRef.current) return;
          if (event.type === 'PRESENCE_CHANGED') void refreshPresence();
          if (event.type === 'MEMBER_KICKED' && event.guestId) {
            kickedGuestsRef.current.add(event.guestId);
            setParticipants(previous => previous.filter(p => p.id !== event.guestId));
          }
          if (event.type === 'JOIN_LOCK_CHANGED') {
            void eventChatApi.getRoomDetails(slug).then(room => {
              if (generation === generationRef.current) setJoinLocked(room.joinLocked);
            }).catch(() => {});
          }
        },
        onConnect: async () => {
          if (generation !== generationRef.current) return;
          void refreshPresence();
          await initialData;
          if (generation !== generationRef.current) return;
          await syncMissedMessages();
          try {
            const [room, pollList, decisionList, wheelList] = await Promise.all([
              eventChatApi.getRoomDetails(slug), eventChatApi.getPolls(slug),
              eventChatApi.getDecisions(slug), eventChatApi.getWheels(slug),
            ]);
            if (generation !== generationRef.current) return;
            setRoomTitle(room.title);
            setRoomStatus(room.status);
            setJoinLocked(room.joinLocked);
            setExpiresAt(room.expiresAt);
            setCreatedAt(room.createdAt);
            setError(null);
            setParticipants(room.participants.filter(p => !kickedGuestsRef.current.has(p.guestId)).map(p => ({ id: p.guestId, nickname: p.nickname,
            role: p.role, isOnline: onlineGuestsRef.current.has(p.guestId), avatarColor: pickAvatarColor(p.guestId) })));
            setPolls(prev => pollList.map(raw => mergePoll(prev.find(p => p.id === String(raw.id)), mapPoll(raw))));
            setDecisions(decisionList.map(mapDecision));
            setWheelList(wheelList);
            setSelectedWheelId(previous => previous ?? wheelList[0]?.id ?? null);
          } catch (err) {
            console.warn('Failed to refresh room after reconnect', err);
          }
        },
        onMessage: (msg: MessageResponse) => {
          if (generation !== generationRef.current) return;
          setMessages(prev => mergeMessages(prev, [mapMessage(msg)]));

          if (msg.messageType === 'SYSTEM' && msg.metadata?.event === 'ROOM_CLOSED') {
            setRoomStatus('CLOSED');
          }
          if (msg.messageType === 'SYSTEM' && msg.metadata?.event === 'MEMBER_JOINED') {
            void eventChatApi.getRoomDetails(slug).then(room => {
              if (generation !== generationRef.current) return;
              setParticipants(room.participants.filter(p => !kickedGuestsRef.current.has(p.guestId)).map(p => ({ id: p.guestId, nickname: p.nickname,
              role: p.role, isOnline: onlineGuestsRef.current.has(p.guestId), avatarColor: pickAvatarColor(p.guestId) })));
            }).catch(() => {  });
          }
        },
        onPoll: (p: PollResponse) => {
          if (generation !== generationRef.current) return;
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
          if (generation !== generationRef.current) return;
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
          if (generation !== generationRef.current) return;
          setWheelList(previous => [w, ...previous.filter(item => item.id !== w.id)]);
          setSelectedWheelId(previous => previous ?? w.id);
        },
        onWheelSpin: spin => {
          if (generation !== generationRef.current) return;
          setWheelList(previous => previous.map(wheel => {
            if (wheel.id !== spin.wheelId || wheel.spins.some(item => item.id === spin.id)) return wheel;
            const winnerIndex = wheel.entries.indexOf(spin.resultEntry);
            return { ...wheel,
              entries: wheel.excludeWinner ? wheel.entries.filter((_, index) => index !== winnerIndex) : wheel.entries,
              spins: [spin, ...wheel.spins],
            };
          }));
        },
      }, session.sessionToken);
    });

    return () => {
      generationRef.current += 1;
      stompClient.disconnect();
    };
  }, [slug, session, loadInitialData, mapMessage, mapPoll, mapDecision, syncMissedMessages, refreshPresence]);

  useEffect(() => {
    if (!slug || session?.slug !== slug || !session.sessionToken) return;
    const generation = generationRef.current;
    const timer = setInterval(() => {
      if (generation === generationRef.current) void refreshPresence();
    }, 10000);
    return () => clearInterval(timer);
  }, [slug, session, refreshPresence]);

  useEffect(() => {
    if (!expiresAt || roomStatus !== 'ACTIVE') return;
    const update = () => {
      if (Date.now() >= new Date(expiresAt).getTime()) setRoomStatus('EXPIRED');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, roomStatus]);

  const pendingSend = useRef<{ payload: string; id: string } | null>(null);
  const sendMessage = useCallback(
    async (text: string, replyToId?: string, attachments?: AttachmentResponse[]) => {
      if (!slug || (!text.trim() && !attachments?.length) || roomStatus !== 'ACTIVE' || session?.slug !== slug) return false;
      setActionError(null);

      const payload = JSON.stringify([slug, session.guestId, text.trim(), replyToId, attachments?.map(item => item.publicId)]);
      if (pendingSend.current?.payload !== payload) pendingSend.current = { payload, id: crypto.randomUUID() };
      const clientMessageId = pendingSend.current.id;
      const optimisticMsg: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        senderId: session?.guestId || 'me',
        senderName: session?.nickname ? `${session.nickname} (Bạn)` : 'Bạn',
        senderRole: session?.role || 'PARTICIPANT',
        avatarColor: pickAvatarColor(session?.guestId || 'me'),
        content: text,
        attachments,
        replyToId,
        createdAt: formatTime(new Date().toISOString()),
        type: 'TEXT',
        isMe: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const response = attachments?.length
          ? await eventChatApi.sendMessage(slug, clientMessageId, text.trim(), replyToId, attachments.map(item => item.publicId))
          : await eventChatApi.sendMessage(slug, clientMessageId, text.trim(), replyToId);
        if (pendingSend.current?.id === clientMessageId) pendingSend.current = null;
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
      if (!slug) return false;
      const optionId = parseInt(optionIdStr, 10);
      if (!activePoll || activePoll.isClosed || roomStatus !== 'ACTIVE' || votingRef.current || session?.slug !== slug) return false;
      if (!activePoll.options.some(opt => opt.id === optionIdStr) ||
        activePoll.options.some(opt => opt.votedByMe && (!activePoll.allowMultiple || opt.id === optionIdStr))) return false;
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
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Không thể bỏ phiếu');
        return false;
      } finally {
        votingRef.current = false;
        setIsVoting(false);
      }
    },
    [slug, activePoll, roomStatus, session, mapPoll]
  );

  const closePoll = useCallback(async () => {
    if (!slug || !activePoll || !session?.hostToken || roomStatus !== 'ACTIVE') return false;
    setActionError(null);
    try {
      const response = await eventChatApi.closePoll(slug, Number(activePoll.id));
      setPolls(prev => prev.map(p => p.id === String(response.id) ? mergePoll(p, mapPoll(response)) : p));
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đóng bình chọn');
      return false;
    }
  }, [slug, activePoll, session, roomStatus, mapPoll]);

  const addDecision = useCallback(
    async (title: string, details?: string) => {
      if (!slug) return false;
      setActionError(null);
      try {
        await eventChatApi.createDecision(slug, title, true, details ? [details] : []);
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Không thể tạo đề xuất');
        return false;
      }
    },
    [slug]
  );

  const confirmDecision = useCallback(
    async (decisionIdStr: string) => {
      if (!slug) return false;
      setActionError(null);
      const decisionId = parseInt(decisionIdStr, 10);
      try {
        if (session?.role === 'HOST') {
          await eventChatApi.updateDecisionStatus(slug, decisionId, 'CONFIRMED');
        } else {
          await eventChatApi.confirmDecision(slug, decisionId, 'APPROVE');
        }
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Không thể xác nhận quyết định');
        return false;
      }
    },
    [slug, session]
  );

  const closeRoom = useCallback(async () => {
    if (!slug) return false;
    if (session?.role !== 'HOST' && !session?.hostToken) {
      console.warn('Chỉ chủ phòng mới có quyền đóng phòng');
      return false;
    }
    setActionError(null);
    try {
      await eventChatApi.closeRoom(slug);
      setRoomStatus('CLOSED');
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đóng phòng');
      return false;
    }
  }, [slug, session]);

  const kickParticipant = useCallback(async (guestId: string) => {
    const target = participants.find(p => p.id === guestId);
    if (!slug || session?.slug !== slug || !session.hostToken ||
        roomStatus !== 'ACTIVE' || isLoading || kickRequestRef.current ||
        !target || target.role === 'HOST' || guestId === session.guestId) return false;
    const generation = generationRef.current;
    const request = Symbol('kick');
    kickRequestRef.current = request;
    setKickingGuestId(guestId);
    setActionError(null);
    try {
      await eventChatApi.kickParticipant(slug, guestId);
      if (generation !== generationRef.current) return false;
      kickedGuestsRef.current.add(guestId);
      setParticipants(previous => previous.filter(p => p.id !== guestId));
      return true;
    } catch (err) {
      if (generation === generationRef.current) {
        setActionError(err instanceof Error ? err.message : 'Không thể loại thành viên khỏi phòng');
      }
      return false;
    } finally {
      if (kickRequestRef.current === request) {
        kickRequestRef.current = null;
        if (generation === generationRef.current) setKickingGuestId(null);
      }
    }
  }, [slug, session, roomStatus, isLoading, participants]);

  const updateJoinLock = useCallback(async (locked: boolean) => {
    if (!slug || session?.slug !== slug || !session.hostToken ||
        roomStatus !== 'ACTIVE' || isLoading || joinLockRequestRef.current) return false;
    const generation = generationRef.current;
    const request = Symbol('join-lock');
    joinLockRequestRef.current = request;
    setIsUpdatingJoinLock(true);
    setActionError(null);
    try {
      await eventChatApi.updateJoinLock(slug, locked);
      if (generation !== generationRef.current) return false;
      setJoinLocked(locked);
      return true;
    } catch (err) {
      if (generation === generationRef.current) {
        setActionError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái tham gia');
      }
      return false;
    } finally {
      if (joinLockRequestRef.current === request) {
        joinLockRequestRef.current = null;
        if (generation === generationRef.current) setIsUpdatingJoinLock(false);
      }
    }
  }, [slug, session, roomStatus, isLoading]);

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
        setWheelList(previous => [res, ...previous.filter(w => w.id !== res.id)]);
        setSelectedWheelId(res.id);
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
      setWheelList(previous => previous.map(wheel => {
        if (wheel.id !== spinRes.wheelId || wheel.spins.some(spin => spin.id === spinRes.id)) return wheel;
        const winnerIndex = wheel.entries.indexOf(spinRes.resultEntry);
        return { ...wheel,
          entries: wheel.excludeWinner ? wheel.entries.filter((_, index) => index !== winnerIndex) : wheel.entries,
          spins: [spinRes, ...wheel.spins],
        };
      }));
      return spinRes.resultEntry;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể quay');
      throw err;
    }
  }, [slug, currentWheel, session, roomStatus]);

  return {
    roomTitle,
    maxParticipants,
    joinLocked,
    isUpdatingJoinLock,
    updateJoinLock,
    kickingGuestId,
    kickParticipant,
    roomStatus,
    participants,
    presenceKnown,
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
    wheelList,
    selectWheel: setSelectedWheelId,
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
