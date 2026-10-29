import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBranchChat } from '../src/hooks/useBranchChat';
import { eventChatApi } from '../src/services/eventChatApi';
import type { ChatMessage } from '../src/types/room';
import type { MessageResponse, ThreadResponse } from '../src/types/backend.types';

vi.mock('../src/services/eventChatApi', () => ({ eventChatApi: { getThread: vi.fn(), getThreads: vi.fn(), sendThreadMessage: vi.fn() } }));
const session = { slug: 'room', guestId: 'me', nickname: 'Guest', role: 'PARTICIPANT' as const, sessionToken: 'token', hostToken: null };
const raw = (id: string, sequence: number, root?: string): MessageResponse => ({ id, sequence, clientMessageId: `client-${id}`,
  senderGuestId: 'me', senderNickname: 'Guest', messageType: 'TEXT', body: `Message ${id}`, replyToId: null, createdAt: '', threadRootId: root });
const map = (message: MessageResponse): ChatMessage => ({ id: message.id, clientMessageId: message.clientMessageId,
  sequence: message.sequence, senderId: 'me', senderName: 'Guest', senderRole: 'PARTICIPANT', avatarColor: '#123456',
  content: message.body, createdAt: '', threadRootId: message.threadRootId, threadReplyCount: message.threadReplyCount, type: 'TEXT' });
const page = (root = 'root', messages: MessageResponse[] = []): ThreadResponse => ({ rootMessage: { ...raw(root, 1), threadReplyCount: messages.length },
  messages, hasMore: false, nextSequence: messages.at(-1)?.sequence ?? 0 });
const onCount = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(eventChatApi.getThread).mockResolvedValue(page()); });
afterEach(cleanup);
function mount() { return renderHook(() => useBranchChat('room', session, 'ACTIVE', map, onCount)); }

it('returns from the directory to an old root and keeps its draft through list navigation', async () => {
  vi.mocked(eventChatApi.getThread).mockResolvedValue(page('old-root'));
  vi.mocked(eventChatApi.getThreads).mockResolvedValue({ threads: [], nextActivitySequence: null, hasMore: false });
  const { result } = mount();
  act(() => result.current.open(map(raw('old-root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.changeDraft('Keep this reply'));
  act(() => result.current.openDirectory());
  await waitFor(() => expect(result.current.directory.loading).toBe(false));
  expect(result.current.directory.isOpen).toBe(true);
  expect(result.current.root).toBeNull();
  act(() => result.current.open(map(raw('old-root', 1))));
  expect(result.current.directory.isOpen).toBe(false);
  expect(result.current.draft).toBe('Keep this reply');
  await waitFor(() => expect(result.current.loading).toBe(false));
});

it('loads the saved branch and deduplicates realtime arriving before HTTP history', async () => {
  let resolve!: (response: ThreadResponse) => void;
  vi.mocked(eventChatApi.getThread).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  act(() => result.current.receive({ ...raw('reply', 3, 'root'), threadReplyCount: 1 }));
  await act(async () => { resolve(page('root', [raw('reply', 3, 'root')])); });
  expect(result.current.messages.map(message => message.id)).toEqual(['reply']);
  expect(onCount).toHaveBeenCalledWith('root', 1);
});

it('ignores another branch and stale responses after switching roots', async () => {
  let resolve!: (response: ThreadResponse) => void;
  vi.mocked(eventChatApi.getThread).mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(page('other'));
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  act(() => result.current.open(map(raw('other', 2))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.receive(raw('unrelated', 4, 'root')));
  await act(async () => { resolve(page('root', [raw('old', 3, 'root')])); });
  expect(result.current.root?.id).toBe('other');
  expect(result.current.messages).toEqual([]);
});

it('retries a failed send with the same client ID and merges a realtime acknowledgement once', async () => {
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(eventChatApi.sendThreadMessage).mockRejectedValueOnce(new Error('Mất kết nối')).mockImplementationOnce(async () => {
    const response = { ...raw('reply', 3, 'root'), threadReplyCount: 1 };
    result.current.receive(response);
    return response;
  });
  await act(async () => { expect(await result.current.send('Reply')).toBe(false); });
  expect(result.current.error).toBe('Mất kết nối');
  await act(async () => { expect(await result.current.send('Reply')).toBe(true); });
  const calls = vi.mocked(eventChatApi.sendThreadMessage).mock.calls;
  expect(calls[0][2]).toBe(calls[1][2]);
  expect(result.current.messages).toHaveLength(1);
});

it('loads additional server pages instead of silently truncating replies', async () => {
  vi.mocked(eventChatApi.getThread).mockResolvedValueOnce({ ...page('root', [raw('a', 2, 'root')]), hasMore: true, nextSequence: 2 })
    .mockResolvedValueOnce(page('root', [raw('b', 3, 'root')]));
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(eventChatApi.getThread).toHaveBeenLastCalledWith('room', 'root', 2);
  expect(result.current.messages.map(message => message.id)).toEqual(['a', 'b']);
});

it('blocks writes in a closed room while still allowing history to load', async () => {
  const { result } = renderHook(() => useBranchChat('room', session, 'CLOSED', map, onCount));
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { expect(await result.current.send('Reply')).toBe(false); });
  expect(eventChatApi.sendThreadMessage).not.toHaveBeenCalled();
});

it('hides old branch data and ignores its outstanding response after changing rooms', async () => {
  let resolve!: (response: ThreadResponse) => void;
  vi.mocked(eventChatApi.getThread).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(({ slug, user }) => useBranchChat(slug, user, 'ACTIVE', map, onCount),
    { initialProps: { slug: 'room', user: session } });
  act(() => result.current.open(map(raw('root', 1))));
  rerender({ slug: 'second', user: { ...session, slug: 'second', sessionToken: 'new-token' } });
  expect(result.current.root).toBeNull();
  await act(async () => { resolve(page('root', [raw('private', 2, 'root')])); });
  expect(result.current.messages).toEqual([]);
  expect(result.current.root).toBeNull();
});

it('keeps separate drafts when closing or switching branches and clears a successful send', async () => {
  vi.mocked(eventChatApi.getThread).mockImplementation(async (_slug, rootId) => page(rootId));
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => { result.current.changeDraft('Draft for A'); result.current.close(); });
  act(() => result.current.open(map(raw('other', 2))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.draft).toBe('');
  act(() => result.current.changeDraft('Draft for B'));
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.draft).toBe('Draft for A');
  vi.mocked(eventChatApi.sendThreadMessage).mockResolvedValue(raw('reply', 3, 'root'));
  await act(async () => { await result.current.send(result.current.draft); });
  expect(result.current.draft).toBe('');
  act(() => result.current.open(map(raw('other', 2))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.draft).toBe('Draft for B');
});

it('preserves a failed send ID even after sending successfully in another branch', async () => {
  vi.mocked(eventChatApi.getThread).mockImplementation(async (_slug, rootId) => page(rootId));
  const { result } = mount();
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(eventChatApi.sendThreadMessage).mockRejectedValueOnce(new Error('Lost acknowledgement'))
    .mockResolvedValueOnce(raw('b', 3, 'other')).mockResolvedValueOnce(raw('a', 2, 'root'));
  await act(async () => { await result.current.send('A'); });
  act(() => result.current.open(map(raw('other', 2))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.send('B'); });
  act(() => result.current.open(map(raw('root', 1))));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.send('A'); });
  const calls = vi.mocked(eventChatApi.sendThreadMessage).mock.calls;
  expect(calls[0][2]).toBe(calls[2][2]);
  expect(calls[1][2]).not.toBe(calls[0][2]);
});
