import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventChat } from '../src/hooks/useEventChat';
import { eventChatApi } from '../src/services/eventChatApi';
import { stompClient, type RoomSubscriptions } from '../src/services/stompClient';
import type { MessageResponse, PollResponse, WheelResponse } from '../src/types/backend.types';

vi.mock('../src/services/eventChatApi', () => ({ eventChatApi: {
  getRoomDetails: vi.fn(), getMessages: vi.fn(), getPolls: vi.fn(), getDecisions: vi.fn(),
  getWheels: vi.fn(), sendMessage: vi.fn(), castVote: vi.fn(), closePoll: vi.fn(),
  createDecision: vi.fn(), confirmDecision: vi.fn(), updateDecisionStatus: vi.fn(), closeRoom: vi.fn(),
  updateJoinLock: vi.fn(), getPresence: vi.fn(),
  kickParticipant: vi.fn(), spinWheel: vi.fn(), createWheel: vi.fn(),
} }));
vi.mock('../src/services/stompClient', () => ({ stompClient: { connect: vi.fn(), disconnect: vi.fn() } }));

const session = { slug: 'room', guestId: 'me', nickname: 'Same name', role: 'PARTICIPANT' as const,
  sessionToken: 'token', hostToken: null };
const message = (sequence = 1): MessageResponse => ({ id: `msg-${sequence}`, clientMessageId: `client-${sequence}`,
  sequence, senderGuestId: 'me', senderNickname: 'Same name', messageType: 'TEXT', body: 'Hello',
  replyToId: null, createdAt: '2026-10-27T00:00:00Z' });
const poll = (allowMultiple = false): PollResponse => ({ id: 1, question: 'Choose', status: 'OPEN', allowMultiple,
  createdAt: '2026-10-27T00:00:00Z', closedAt: null,
  options: [{ id: 10, label: 'A', voteCount: 0, displayOrder: 0 }, { id: 11, label: 'B', voteCount: 0, displayOrder: 1 }] });
let callbacks: RoomSubscriptions;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ slug: 'room', title: 'Room', status: 'ACTIVE',
    maxParticipants: 50, joinLocked: false, settings: null, expiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-10-27T00:00:00Z', closedAt: null, participants: [] });
  vi.mocked(eventChatApi.getMessages).mockResolvedValue([]);
  vi.mocked(eventChatApi.getPresence).mockResolvedValue([]);
  vi.mocked(eventChatApi.getPolls).mockResolvedValue([poll()]);
  vi.mocked(eventChatApi.getDecisions).mockResolvedValue([]);
  vi.mocked(eventChatApi.getWheels).mockResolvedValue([]);
  vi.mocked(stompClient.connect).mockImplementation((_slug, handlers) => { callbacks = handlers; });
});
afterEach(cleanup);
async function mount() {
  const hook = renderHook(() => useEventChat('room', session));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('multiple wheels', () => {
  const wheel = (id: number): WheelResponse => ({ id, title: `Wheel ${id}`, entries: ['A', 'B'],
    excludeWinner: true, createdAt: '2026-10-28T00:00:00Z', spins: [] });

  it('preserves the selected wheel when another wheel is updated', async () => {
    vi.mocked(eventChatApi.getWheels).mockResolvedValue([wheel(2), wheel(1)]);
    const { result } = await mount();
    act(() => result.current.selectWheel(1));
    act(() => callbacks.onWheel?.({ ...wheel(2), title: 'Updated elsewhere' }));
    expect(result.current.currentWheel?.id).toBe(1);
    expect(result.current.wheelList.find(w => w.id === 2)?.title).toBe('Updated elsewhere');
  });

  it('applies a spin once when realtime and the HTTP response both arrive', async () => {
    vi.mocked(eventChatApi.getWheels).mockResolvedValue([wheel(1)]);
    const spin = { id: 7, wheelId: 1, actorNickname: 'Host', idempotencyKey: 'key',
      resultEntry: 'A', entriesSnapshot: ['A', 'B'], createdAt: '2026-10-28T00:00:00Z' };
    vi.mocked(eventChatApi.spinWheel).mockImplementation(async () => {
      callbacks.onWheelSpin?.(spin);
      return spin;
    });
    const hostSession = { ...session, role: 'HOST' as const };
    const { result } = renderHook(() => useEventChat('room', hostSession));
    await waitFor(() => expect(result.current.currentWheel?.id).toBe(1));
    await act(async () => { await result.current.spinCurrentWheel(); });
    expect(result.current.currentWheel?.entries).toEqual(['B']);
    expect(result.current.currentWheel?.spins).toHaveLength(1);
    expect(result.current.remoteWinner).toBe('A');
  });
});

describe('presence after connecting', () => {
  async function withParticipant() {
    const details = await eventChatApi.getRoomDetails('room');
    vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ ...details, participants: [
      { guestId: 'me', nickname: 'Same name', role: 'PARTICIPANT', joinedAt: '', lastSeenAt: '' },
    ] });
    return mount();
  }

  it('refreshes immediately after CONNECT instead of waiting for the next poll', async () => {
    const { result } = await withParticipant();
    expect(result.current.presenceKnown).toBe(false);
    expect(eventChatApi.getPresence).not.toHaveBeenCalled();
    vi.mocked(eventChatApi.getPresence).mockResolvedValue(['me']);
    await act(async () => { await callbacks.onConnect?.(); });
    await waitFor(() => expect(result.current.participants[0].isOnline).toBe(true));
    expect(result.current.presenceKnown).toBe(true);
  });

  it('reports unknown presence when the presence API fails, then recovers on reconnect', async () => {
    const { result } = await withParticipant();
    vi.mocked(eventChatApi.getPresence).mockRejectedValueOnce(new Error('Redis unavailable'));
    await act(async () => { await callbacks.onConnect?.(); });
    expect(result.current.presenceKnown).toBe(false);
    vi.mocked(eventChatApi.getPresence).mockResolvedValue(['me']);
    await act(async () => { await callbacks.onConnect?.(); });
    await waitFor(() => expect(result.current.presenceKnown).toBe(true));
    expect(result.current.participants[0].isOnline).toBe(true);
  });

  it('keeps an older empty snapshot from overwriting presence after reconnect', async () => {
    const { result } = await withParticipant();
    let resolveOlder!: (online: string[]) => void;
    vi.mocked(eventChatApi.getPresence)
      .mockReturnValueOnce(new Promise(resolve => { resolveOlder = resolve; }))
      .mockResolvedValue(['me']);
    await act(async () => { await callbacks.onConnect?.(); });
    await act(async () => { await callbacks.onConnect?.(); });
    await waitFor(() => expect(result.current.participants[0].isOnline).toBe(true));
    await act(async () => { resolveOlder([]); });
    expect(result.current.participants[0].isOnline).toBe(true);
  });

  it('updates existing observers when another member connects', async () => {
    const { result } = await withParticipant();
    await act(async () => { await callbacks.onConnect?.(); });
    vi.mocked(eventChatApi.getPresence).mockResolvedValue(['me']);
    act(() => { callbacks.onRoomEvent?.({ type: 'PRESENCE_CHANGED' }); });
    await waitFor(() => expect(result.current.participants[0].isOnline).toBe(true));
  });
});

describe('private room loading', () => {
  it('does not fetch or connect before joining, then loads after session is saved', async () => {
    const { result, rerender } = renderHook(({ joined }) => useEventChat('room', joined ? session : null),
      { initialProps: { joined: false } });
    expect(result.current.isLoading).toBe(false);
    await act(async () => { await result.current.refreshData(); });
    expect(eventChatApi.getRoomDetails).not.toHaveBeenCalled();
    expect(eventChatApi.getMessages).not.toHaveBeenCalled();
    expect(eventChatApi.getPolls).not.toHaveBeenCalled();
    expect(stompClient.connect).not.toHaveBeenCalled();
    rerender({ joined: true });
    await waitFor(() => expect(result.current.roomTitle).toBe('Room'));
    expect(stompClient.connect).toHaveBeenCalledWith('room', expect.any(Object), 'token');
  });

  it.each(['wrong-room', 'empty-token'])('does not load with %s credentials', async kind => {
    const credentials = kind === 'wrong-room' ? { ...session, slug: 'other' } : { ...session, sessionToken: '' };
    const { result } = renderHook(() => useEventChat('room', credentials));
    await act(async () => { await result.current.refreshData(); });
    expect(eventChatApi.getRoomDetails).not.toHaveBeenCalled();
    expect(stompClient.connect).not.toHaveBeenCalled();
  });

  it('does not connect if room authorization is rejected', async () => {
    vi.mocked(eventChatApi.getRoomDetails).mockRejectedValue(new Error('Phiên đã bị thu hồi'));
    const { result } = await mount();
    expect(result.current.error).toBe('Phiên đã bị thu hồi');
    expect(stompClient.connect).not.toHaveBeenCalled();
  });

  it('clears private data and ignores old callbacks when the session disappears', async () => {
    vi.mocked(eventChatApi.getMessages).mockResolvedValue([message()]);
    const { result, rerender } = renderHook(({ joined }) => useEventChat('room', joined ? session : null),
      { initialProps: { joined: true } });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const previous = callbacks;
    rerender({ joined: false });
    act(() => { previous.onMessage?.(message(2)); previous.onPoll?.(poll()); });
    expect(result.current.messages).toEqual([]);
    expect(result.current.polls).toEqual([]);
    expect(result.current.participants).toEqual([]);
    expect(stompClient.disconnect).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('kick participant', () => {
  const host = { ...session, role: 'HOST' as const, hostToken: 'host-token' };
  async function setup() {
    const details = await eventChatApi.getRoomDetails('room');
    vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ ...details, participants: [
      { guestId: 'me', nickname: 'Host', role: 'HOST', joinedAt: '', lastSeenAt: '' },
      { guestId: 'guest', nickname: 'Guest', role: 'PARTICIPANT', joinedAt: '', lastSeenAt: '' },
    ] });
  }

  it('removes the participant only after ACK and blocks concurrent kicks', async () => {
    await setup();
    let resolve!: () => void;
    vi.mocked(eventChatApi.kickParticipant).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const { result } = renderHook(() => useEventChat('room', host));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.kickParticipant('guest'); });
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.kickingGuestId).toBe('guest');
    await act(async () => { expect(await result.current.kickParticipant('guest')).toBe(false); });
    expect(eventChatApi.kickParticipant).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); expect(await pending).toBe(true); });
    expect(result.current.participants.map(p => p.id)).toEqual(['me']);
    expect(result.current.kickingGuestId).toBeNull();
    await act(async () => { await callbacks.onConnect?.(); });
    expect(result.current.participants.map(p => p.id)).toEqual(['me']);
  });

  it('keeps the participant and exposes the server error when kick fails', async () => {
    await setup();
    vi.mocked(eventChatApi.kickParticipant).mockRejectedValue(new Error('Thử lại sau 2 giây.'));
    const { result } = renderHook(() => useEventChat('room', host));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { expect(await result.current.kickParticipant('guest')).toBe(false); });
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.kickingGuestId).toBeNull();
    expect(result.current.actionError).toBe('Thử lại sau 2 giây.');
  });

  it('rejects kicking the Host or a target outside the room', async () => {
    await setup();
    const { result } = renderHook(() => useEventChat('room', host));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.kickParticipant('me')).toBe(false);
      expect(await result.current.kickParticipant('outside')).toBe(false);
    });
    expect(eventChatApi.kickParticipant).not.toHaveBeenCalled();
  });

  it('does not allow guests to kick', async () => {
    await setup();
    const { result } = await mount();
    await act(async () => { expect(await result.current.kickParticipant('guest')).toBe(false); });
    expect(eventChatApi.kickParticipant).not.toHaveBeenCalled();
  });

  it('ignores a kick acknowledgement after navigation to another room', async () => {
    await setup();
    let resolve!: () => void;
    vi.mocked(eventChatApi.kickParticipant).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ slug }) => useEventChat(slug, host), { initialProps: { slug: 'room' } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.kickParticipant('guest'); });
    rerender({ slug: 'other' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { resolve(); expect(await pending).toBe(false); });
    expect(result.current.participants).toHaveLength(0);
    expect(result.current.kickingGuestId).toBeNull();
  });
});

describe('join lock', () => {
  const host = { ...session, role: 'HOST' as const, hostToken: 'host-token' };

  it('loads lock state and refreshes it after reconnect', async () => {
    const details = await eventChatApi.getRoomDetails('room');
    vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ ...details, joinLocked: true });
    const { result } = await mount();
    expect(result.current.joinLocked).toBe(true);
    vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ ...details, joinLocked: false });
    await act(async () => { await callbacks.onConnect?.(); });
    expect(result.current.joinLocked).toBe(false);
  });

  it('waits for acknowledgement and prevents duplicate writes while pending', async () => {
    let resolve!: () => void;
    vi.mocked(eventChatApi.updateJoinLock).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const { result } = renderHook(() => useEventChat('room', host));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.updateJoinLock(true); });
    expect(result.current.joinLocked).toBe(false);
    expect(result.current.isUpdatingJoinLock).toBe(true);
    await act(async () => { expect(await result.current.updateJoinLock(true)).toBe(false); });
    expect(eventChatApi.updateJoinLock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); expect(await pending).toBe(true); });
    expect(result.current.joinLocked).toBe(true);
    expect(result.current.isUpdatingJoinLock).toBe(false);
    vi.mocked(eventChatApi.updateJoinLock).mockResolvedValue(undefined);
    await act(async () => { expect(await result.current.updateJoinLock(false)).toBe(true); });
    expect(result.current.joinLocked).toBe(false);
  });

  it.each(['Host Token không hợp lệ', 'Bạn thao tác quá nhanh. Thử lại sau 2 giây.'])(
    'preserves lock state on API rejection: %s', async message => {
      vi.mocked(eventChatApi.updateJoinLock).mockRejectedValue(new Error(message));
      const { result } = renderHook(() => useEventChat('room', host));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { expect(await result.current.updateJoinLock(true)).toBe(false); });
      expect(result.current.joinLocked).toBe(false);
      expect(result.current.actionError).toBe(message);
      expect(result.current.isUpdatingJoinLock).toBe(false);
    }
  );

  it('does not let a guest change join state', async () => {
    const { result } = await mount();
    await act(async () => { expect(await result.current.updateJoinLock(true)).toBe(false); });
    expect(eventChatApi.updateJoinLock).not.toHaveBeenCalled();
  });

  it('ignores a previous room acknowledgement after navigation', async () => {
    let resolve!: () => void;
    vi.mocked(eventChatApi.updateJoinLock).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ slug }) => useEventChat(slug, host), { initialProps: { slug: 'room' } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.updateJoinLock(true); });
    rerender({ slug: 'other' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { resolve(); expect(await pending).toBe(false); });
    expect(result.current.joinLocked).toBe(false);
    expect(result.current.isUpdatingJoinLock).toBe(false);
  });
});

it.each(['vote', 'create-decision', 'confirm-decision', 'close-poll', 'close-room'] as const)(
  'reports a rate-limited %s as failure without marking it successful', async action => {
    const error = new Error('Bạn thao tác quá nhanh. Thử lại sau 2 giây.');
    vi.mocked(eventChatApi.castVote).mockRejectedValue(error);
    vi.mocked(eventChatApi.createDecision).mockRejectedValue(error);
    vi.mocked(eventChatApi.updateDecisionStatus).mockRejectedValue(error);
    vi.mocked(eventChatApi.closePoll).mockRejectedValue(error);
    vi.mocked(eventChatApi.closeRoom).mockRejectedValue(error);
    const host = { ...session, role: 'HOST' as const, hostToken: 'host-token' };
    const { result } = renderHook(() => useEventChat('room', host));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const actions = {
      vote: () => result.current.votePoll('10'),
      'create-decision': () => result.current.addDecision('A proposal'),
      'confirm-decision': () => result.current.confirmDecision('1'),
      'close-poll': () => result.current.closePoll(),
      'close-room': () => result.current.closeRoom(),
    };
    await act(async () => { expect(await actions[action]()).toBe(false); });
    expect(result.current.actionError).toBe(error.message);
    expect(result.current.roomStatus).toBe('ACTIVE');
    expect(result.current.poll.isClosed).toBe(false);
    expect(result.current.poll.options.some(option => option.votedByMe)).toBe(false);
  }
);

describe('chat delivery and recovery', () => {
  it('marks an expired room read-only even if the API still reports ACTIVE', async () => {
    const details = await eventChatApi.getRoomDetails('room');
    vi.mocked(eventChatApi.getRoomDetails).mockResolvedValue({ ...details, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const { result } = await mount();
    expect(result.current.roomStatus).toBe('EXPIRED');
    await act(async () => { await result.current.sendMessage('Too late'); await result.current.votePoll('10'); });
    expect(eventChatApi.sendMessage).not.toHaveBeenCalled();
    expect(eventChatApi.castVote).not.toHaveBeenCalled();
  });
  it('opens the chat without waiting for slow optional tools', async () => {
    vi.mocked(eventChatApi.getWheels).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEventChat('room', session));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.roomTitle).toBe('Room');
  });

  it('keeps chat available if an optional tool cannot load', async () => {
    vi.mocked(eventChatApi.getWheels).mockRejectedValue(new Error('Wheel unavailable'));
    const { result } = await mount();
    expect(result.current.roomTitle).toBe('Room');
    expect(result.current.error).toBeNull();
  });

  it('uses the REST acknowledgement even when the websocket echo is lost', async () => {
    const { result } = await mount();
    vi.mocked(eventChatApi.sendMessage).mockResolvedValue(message());
    await act(async () => { await result.current.sendMessage('Hello'); });
    expect(result.current.messages.map(m => m.id)).toEqual(['msg-1']);
    act(() => callbacks.onMessage?.(message()));
    expect(result.current.messages).toHaveLength(1);
  });

  it('removes a rejected optimistic message and exposes an action error', async () => {
    const { result } = await mount();
    vi.mocked(eventChatApi.sendMessage).mockRejectedValue(new Error('Phòng đã đóng'));
    await act(async () => { await result.current.sendMessage('Hello'); });
    expect(result.current.messages).toHaveLength(0);
    expect(result.current).toHaveProperty('actionError', 'Phòng đã đóng');
  });

  it('does not treat a matching nickname as the current guest', async () => {
    vi.mocked(eventChatApi.getMessages).mockResolvedValue([{ ...message(), senderGuestId: 'someone-else' }]);
    const { result } = await mount();
    expect(result.current.messages[0].isMe).toBe(false);
  });

  it('recovers missed messages when starting from sequence zero', async () => {
    const { result } = await mount();
    vi.mocked(eventChatApi.getMessages).mockResolvedValue([message()]);
    await act(async () => { await callbacks.onConnect?.(); });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(eventChatApi.getMessages).toHaveBeenLastCalledWith('room', 0);
  });

  it('fetches all catchup pages, not only the first 100', async () => {
    vi.mocked(eventChatApi.getMessages).mockResolvedValueOnce([message()]);
    const { result } = await mount();
    vi.mocked(eventChatApi.getMessages)
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => message(i + 2)))
      .mockResolvedValueOnce([message(102)]);
    await act(async () => { await callbacks.onConnect?.(); });
    await waitFor(() => expect(result.current.messages).toHaveLength(102));
    expect(eventChatApi.getMessages).toHaveBeenLastCalledWith('room', 101);
  });

  it('keeps messages arriving while initial history is loading', async () => {
    let resolveHistory!: (messages: MessageResponse[]) => void;
    vi.mocked(eventChatApi.getMessages).mockReturnValueOnce(new Promise(resolve => { resolveHistory = resolve; }));
    const { result } = renderHook(() => useEventChat('room', session));
    await waitFor(() => expect(stompClient.connect).toHaveBeenCalled());
    act(() => callbacks.onMessage?.(message(2)));
    await act(async () => { resolveHistory([message(1)]); });
    expect(result.current.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('does not close the room when a joining nickname contains đóng', async () => {
    const { result } = await mount();
    act(() => callbacks.onMessage?.({ ...message(), messageType: 'SYSTEM', body: 'đóng đã tham gia phòng',
      metadata: { event: 'MEMBER_JOINED' } }));
    expect(result.current.roomStatus).toBe('ACTIVE');
    act(() => callbacks.onMessage?.({ ...message(2), messageType: 'SYSTEM', body: 'Phòng chat đã đóng',
      metadata: { event: 'ROOM_CLOSED' } }));
    expect(result.current.roomStatus).toBe('CLOSED');
  });

  it('orders websocket deliveries by server sequence', async () => {
    const { result } = await mount();
    act(() => { callbacks.onMessage?.(message(2)); callbacks.onMessage?.(message(1)); });
    expect(result.current.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
  });
});

describe('voting', () => {
  it('does not invent votes when the server rejects a request', async () => {
    const { result } = await mount();
    vi.mocked(eventChatApi.castVote).mockRejectedValue(new Error('Đã đóng'));
    await act(async () => { await result.current.votePoll('10'); });
    expect(result.current.poll.totalVotes).toBe(0);
    expect(result.current.poll.options[0].votedByMe).toBeFalsy();
  });

  it('preserves both selected options in multiple-choice polls across broadcasts', async () => {
    vi.mocked(eventChatApi.getPolls).mockResolvedValue([poll(true)]);
    const { result } = await mount();
    vi.mocked(eventChatApi.castVote).mockResolvedValueOnce({ ...poll(true),
      options: [{ ...poll().options[0], voteCount: 1 }, poll().options[1]] });
    await act(async () => { await result.current.votePoll('10'); });
    act(() => callbacks.onPoll?.({ ...poll(true), options: [{ ...poll().options[0], voteCount: 1 }, poll().options[1]] }));
    vi.mocked(eventChatApi.castVote).mockResolvedValueOnce({ ...poll(true),
      options: poll().options.map(o => ({ ...o, voteCount: 1 })) });
    await act(async () => { await result.current.votePoll('11'); });
    expect(result.current.poll.options.filter(o => o.votedByMe).map(o => o.id)).toEqual(['10', '11']);
    expect(result.current.poll.totalVotes).toBe(2);
  });

  it('blocks a second selection in single-choice polls', async () => {
    const { result } = await mount();
    vi.mocked(eventChatApi.castVote).mockResolvedValue({ ...poll(),
      options: [{ ...poll().options[0], voteCount: 1 }, poll().options[1]] });
    await act(async () => { await result.current.votePoll('10'); });
    await act(async () => { await result.current.votePoll('11'); });
    expect(eventChatApi.castVote).toHaveBeenCalledTimes(1);
    expect(result.current.poll.totalVotes).toBe(1);
  });

  it('restores the current guests selections after a reload', async () => {
    vi.mocked(eventChatApi.getPolls).mockResolvedValue([{ ...poll(true), votedOptionIds: [10, 11] }]);
    const { result } = await mount();
    expect(result.current.poll.options.every(option => option.votedByMe)).toBe(true);
  });

  it('votes for the selected poll instead of always choosing the newest one', async () => {
    vi.mocked(eventChatApi.getPolls).mockResolvedValue([poll(), { ...poll(), id: 2 }]);
    const { result } = await mount();
    act(() => result.current.selectPoll('2'));
    vi.mocked(eventChatApi.castVote).mockResolvedValue({ ...poll(), id: 2 });
    await act(async () => { await result.current.votePoll('10'); });
    expect(eventChatApi.castVote).toHaveBeenCalledWith('room', 2, 10);
  });

  it('ignores repeated clicks while a vote is pending', async () => {
    const { result } = await mount();
    let resolve!: (poll: PollResponse) => void;
    vi.mocked(eventChatApi.castVote).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => {
      const request = result.current.votePoll('10');
      await result.current.votePoll('10');
      resolve(poll());
      await request;
    });
    expect(eventChatApi.castVote).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer broadcast with an older REST acknowledgement', async () => {
    const { result } = await mount();
    let resolve!: (poll: PollResponse) => void;
    vi.mocked(eventChatApi.castVote).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => {
      const request = result.current.votePoll('10');
      callbacks.onPoll?.({ ...poll(), status: 'CLOSED', options: [{ ...poll().options[0], voteCount: 2 }, poll().options[1]] });
      resolve({ ...poll(), options: [{ ...poll().options[0], voteCount: 1 }, poll().options[1]] });
      await request;
    });
    expect(result.current.poll.totalVotes).toBe(2);
    expect(result.current.poll.isClosed).toBe(true);
  });
});
