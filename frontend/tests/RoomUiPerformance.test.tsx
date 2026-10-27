import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoomWorkspaceView } from '../src/mockup/components/RoomWorkspaceView';
import type { ChatMessage, Poll } from '../src/mockup/types';

const metrics = vi.hoisted(() => ({ messageListRender: vi.fn() }));
vi.mock('../src/mockup/components/ChatMessageList', async importOriginal => {
  const original = await importOriginal<typeof import('../src/mockup/components/ChatMessageList')>();
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
