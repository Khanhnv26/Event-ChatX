import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventChat } from '../src/hooks/useEventChat';
import { eventChatApi } from '../src/services/eventChatApi';
import { stompClient, type RoomSubscriptions } from '../src/services/stompClient';
import type { MessageResponse, PollResponse } from '../src/types/backend.types';

vi.mock('../src/services/eventChatApi', () => ({ eventChatApi: {
  getRoomDetails: vi.fn(), getMessages: vi.fn(), getPolls: vi.fn(), getDecisions: vi.fn(),
  getWheels: vi.fn(), sendMessage: vi.fn(), castVote: vi.fn(), closePoll: vi.fn(),
  createDecision: vi.fn(), confirmDecision: vi.fn(), updateDecisionStatus: vi.fn(), closeRoom: vi.fn(),
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
    settings: null, expiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-10-27T00:00:00Z', closedAt: null, participants: [] });
  vi.mocked(eventChatApi.getMessages).mockResolvedValue([]);
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
