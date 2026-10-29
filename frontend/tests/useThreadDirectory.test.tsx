import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useThreadDirectory } from '../src/hooks/useThreadDirectory';
import { eventChatApi } from '../src/services/eventChatApi';
import type { MessageResponse, ThreadListResponse } from '../src/types/backend.types';
import type { ChatMessage } from '../src/types/room';

vi.mock('../src/services/eventChatApi', () => ({ eventChatApi: { getThreads: vi.fn() } }));
const session = { slug: 'room', guestId: 'me', nickname: 'Guest', role: 'PARTICIPANT' as const, sessionToken: 'token', hostToken: null };
const map = (message: MessageResponse): ChatMessage => ({ id: message.id, sequence: message.sequence, senderId: 'me', senderName: 'Guest', senderRole: 'PARTICIPANT', avatarColor: '#123456', content: message.body, createdAt: '10:00' });
function page(id = 'old-root', sequence = 100, hasMore = false): ThreadListResponse {
  return { threads: [{ rootMessage: { id, sequence: 1, clientMessageId: id, senderGuestId: 'me', senderNickname: 'Guest', messageType: 'TEXT', body: 'Old topic', replyToId: null, createdAt: '' },
    replyCount: 3, lastActivitySequence: sequence, lastActivityAt: '2026-10-29T07:00:00Z', lastReplySnippet: 'Latest reply' }], nextActivitySequence: sequence, hasMore };
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(eventChatApi.getThreads).mockResolvedValue(page()); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('loads old roots directly from the server only when the directory opens', async () => {
  const { result } = renderHook(() => useThreadDirectory('room', session, map));
  expect(eventChatApi.getThreads).not.toHaveBeenCalled();
  act(() => result.current.open());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.entries[0].root.id).toBe('old-root');
  expect(result.current.isOpen).toBe(true);
});

it('loads older pages by activity cursor without duplicating roots', async () => {
  vi.mocked(eventChatApi.getThreads).mockResolvedValueOnce(page('new', 100, true)).mockResolvedValueOnce({ ...page('old', 50), threads: [...page('new', 100).threads, ...page('old', 50).threads] });
  const { result } = renderHook(() => useThreadDirectory('room', session, map));
  act(() => result.current.open());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.loadMore(); });
  expect(eventChatApi.getThreads).toHaveBeenLastCalledWith('room', 100);
  expect(result.current.entries.map(item => item.root.id)).toEqual(['new', 'old']);
  expect(result.current.hasMore).toBe(false);
});

it('ignores an in-flight response after closing or changing room and hides previous entries', async () => {
  let resolve!: (value: ThreadListResponse) => void;
  const { result, rerender } = renderHook(({ slug, token }) => useThreadDirectory(slug, { ...session, slug, sessionToken: token }, map), { initialProps: { slug: 'room', token: 'token' } });
  act(() => result.current.open());
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  rerender({ slug: 'other', token: 'new-token' });
  expect(result.current.entries).toEqual([]);
  vi.mocked(eventChatApi.getThreads).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  act(() => result.current.open());
  expect(result.current.entries).toEqual([]);
  act(() => result.current.close());
  await act(async () => { resolve(page('late')); });
  expect(result.current.isOpen).toBe(false);
  expect(result.current.entries).toEqual([]);
});

it('coalesces realtime refreshes and preserves older loaded pages and their cursor', async () => {
  vi.mocked(eventChatApi.getThreads).mockResolvedValueOnce(page('new', 100, true)).mockResolvedValueOnce(page('old', 50));
  const { result } = renderHook(() => useThreadDirectory('room', session, map));
  act(() => result.current.open());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.loadMore(); });
  vi.useFakeTimers();
  vi.mocked(eventChatApi.getThreads).mockResolvedValueOnce(page('latest', 120, true));
  act(() => { result.current.noteActivity(); result.current.noteActivity(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(eventChatApi.getThreads).toHaveBeenCalledTimes(3);
  expect(result.current.entries.map(item => item.root.id)).toEqual(['latest', 'new', 'old']);
  expect(result.current.hasMore).toBe(false);
  act(() => result.current.close());
  act(() => result.current.noteActivity());
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(eventChatApi.getThreads).toHaveBeenCalledTimes(3);
});

it('retains the cursor after an error so pagination can be retried', async () => {
  vi.mocked(eventChatApi.getThreads).mockResolvedValueOnce(page('new', 100, true)).mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce(page('old', 50));
  const { result } = renderHook(() => useThreadDirectory('room', session, map));
  act(() => result.current.open());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.loadMore(); });
  expect(result.current.error).toBe('Mất kết nối');
  expect(result.current.entries).toHaveLength(1);
  await act(async () => { await result.current.loadMore(); });
  expect(eventChatApi.getThreads).toHaveBeenLastCalledWith('room', 100);
  expect(result.current.entries).toHaveLength(2);
});
