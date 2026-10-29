import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoomWorkspaceView } from '../src/components/room/RoomWorkspaceView';
import type { ChatMessage, Poll } from '../src/types/room';

const metrics = vi.hoisted(() => ({ messageListRender: vi.fn() }));
vi.mock('../src/components/room/ChatMessageList', async importOriginal => {
  const original = await importOriginal<typeof import('../src/components/room/ChatMessageList')>();
  return { ChatMessageList: (props: React.ComponentProps<typeof original.ChatMessageList>) => {
    metrics.messageListRender();
    return <original.ChatMessageList {...props} />;
  } };
});
const poll: Poll = { id: '0', question: 'Empty', options: [], isClosed: true, totalVotes: 0, createdBy: 'System' };
const message: ChatMessage = { id: '1', senderId: 'guest', senderName: 'Guest', senderRole: 'PARTICIPANT',
  avatarColor: '#6366f1', content: 'First message', createdAt: '10:00', isMe: false };
const props = { roomTitle: 'Test room', roomCode: 'test', roomStatus: 'ACTIVE' as const, participants: [], poll,
  decisions: [], onSendMessage: vi.fn().mockResolvedValue(true), onVotePoll: vi.fn(), onOpenWheelModal: vi.fn(),
  onConfirmDecision: vi.fn(), onAddDecision: vi.fn(), onCloseRoom: vi.fn(), onOpenExport: vi.fn() };
let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  metrics.messageListRender.mockClear();
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: media.includes('min-width') })));
  scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scrollTo, configurable: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows the host join-lock control, pending state and unlock action', () => {
  const toggle = vi.fn().mockResolvedValue(undefined);
  const view = render(<RoomWorkspaceView {...props} messages={[]} isHost onToggleJoinLock={toggle} />);
  fireEvent.click(screen.getByRole('button', { name: 'Khóa lượt tham gia mới' }));
  expect(toggle).toHaveBeenCalledOnce();
  view.rerender(<RoomWorkspaceView {...props} messages={[]} isHost onToggleJoinLock={toggle} isUpdatingJoinLock />);
  const pending = screen.getByRole('button', { name: 'Đang cập nhật...' }) as HTMLButtonElement;
  expect(pending.disabled).toBe(true);
  fireEvent.click(pending);
  expect(toggle).toHaveBeenCalledOnce();
  view.rerender(<RoomWorkspaceView {...props} messages={[]} isHost onToggleJoinLock={toggle} joinLocked />);
  expect(screen.getByRole('button', { name: 'Mở lại lượt tham gia' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Đang khóa người mới. Thành viên hiện tại vẫn sử dụng phòng.')).toBeTruthy();
});

it('does not label members offline until presence is known', () => {
  const participants = [{ id: 'guest', nickname: 'Guest', role: 'PARTICIPANT' as const,
    isOnline: false, avatarColor: '#6366f1' }];
  const view = render(<RoomWorkspaceView {...props} messages={[]} participants={participants} presenceKnown={false} />);
  fireEvent.click(screen.getByRole('tab', { name: /Thành viên/ }));
  expect(screen.getAllByText('Đang cập nhật…').length).toBeGreaterThan(0);
  expect(screen.queryByText('Vừa rời đi')).toBeNull();
  expect(screen.queryByText('Không kết nối')).toBeNull();
  view.rerender(<RoomWorkspaceView {...props} messages={[]} participants={participants} presenceKnown />);
  expect(screen.getByText('Không kết nối')).toBeTruthy();
  view.rerender(<RoomWorkspaceView {...props} messages={[]} participants={[{ ...participants[0], isOnline: true }]} presenceKnown />);
  expect(screen.getByText('Đang online')).toBeTruthy();
});

it('lets the Host kick participants but never shows a kick button for Host', () => {
  const kick = vi.fn().mockResolvedValue(undefined);
  const participants = [
    { id: 'host', nickname: 'Host', role: 'HOST' as const, isOnline: true, avatarColor: '#6366f1' },
    { id: 'guest', nickname: 'Guest', role: 'PARTICIPANT' as const, isOnline: true, avatarColor: '#6366f1' },
  ];
  const view = render(<RoomWorkspaceView {...props} messages={[]} participants={participants} isHost onKickParticipant={kick} />);
  expect(screen.queryByRole('button', { name: 'Loại Host khỏi phòng' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Loại Guest khỏi phòng' }));
  expect(kick).toHaveBeenCalledWith('guest');
  view.rerender(<RoomWorkspaceView {...props} messages={[]} participants={participants} isHost onKickParticipant={kick} kickingGuestId="guest" />);
  const pending = screen.getByRole('button', { name: 'Loại Guest khỏi phòng' }) as HTMLButtonElement;
  expect(pending.disabled).toBe(true);
  fireEvent.click(pending);
  expect(kick).toHaveBeenCalledTimes(1);
  view.rerender(<RoomWorkspaceView {...props} messages={[]} participants={participants} onKickParticipant={kick} />);
  expect(screen.queryByRole('button', { name: 'Loại Guest khỏi phòng' })).toBeNull();
});

it.each(['guest', 'CLOSED', 'EXPIRED'] as const)('hides the join-lock action for %s', state => {
  render(<RoomWorkspaceView {...props} messages={[]} isHost={state !== 'guest'}
    roomStatus={state === 'guest' ? 'ACTIVE' : state} onToggleJoinLock={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Khóa lượt tham gia mới' })).toBeNull();
});

it('updates the countdown without rerendering the message list', () => {
  vi.useFakeTimers();
  render(<RoomWorkspaceView {...props} messages={[message]} expiresAt={new Date(Date.now() + 60000).toISOString()} />);
  const renders = metrics.messageListRender.mock.calls.length;
  act(() => { vi.advanceTimersByTime(3000); });
  expect(metrics.messageListRender).toHaveBeenCalledTimes(renders);
  expect(screen.getByText('00:00:57')).toBeTruthy();
});

it('does not pull readers away from older messages when new ones arrive', () => {
  const view = render(<RoomWorkspaceView {...props} messages={[message]} />);
  const stream = screen.getByLabelText('Tin nhắn trong phòng');
  Object.defineProperties(stream, { scrollHeight: { value: 1600, configurable: true },
    clientHeight: { value: 400, configurable: true } });
  stream.scrollTop = 100;
  fireEvent.scroll(stream);
  scrollTo.mockClear();
  view.rerender(<RoomWorkspaceView {...props} messages={[message, { ...message, id: '2', content: 'New message' }]} />);
  expect(stream.scrollTop).toBe(100);
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '1 tin nhắn mới ↓' }));
  expect(scrollTo).toHaveBeenCalledOnce();
});

it('keeps decision fields open when the server rejects submission', async () => {
  const add = vi.fn().mockResolvedValue(false);
  render(<RoomWorkspaceView {...props} messages={[]} onAddDecision={add} />);
  fireEvent.click(screen.getByRole('button', { name: 'Đề xuất quyết định' }));
  const title = await screen.findByPlaceholderText('Tiêu đề quyết định...') as HTMLInputElement;
  const details = screen.getByPlaceholderText('Ghi chú thêm hoặc bằng chứng (tùy chọn)...') as HTMLInputElement;
  fireEvent.change(title, { target: { value: 'Keep this proposal' } });
  fireEvent.change(details, { target: { value: 'Keep this evidence' } });
  await act(async () => { fireEvent.submit(title.closest('form')!); });
  expect(add).toHaveBeenCalledWith('Keep this proposal', 'Keep this evidence');
  expect(title.value).toBe('Keep this proposal');
  expect(details.value).toBe('Keep this evidence');
  expect(screen.getByRole('button', { name: 'Ghim quyết định' })).toBeTruthy();
});
