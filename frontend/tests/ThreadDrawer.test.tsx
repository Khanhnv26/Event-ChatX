import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThreadDrawer } from '../src/components/room/ThreadDrawer';
import { ChatMessageList } from '../src/components/room/ChatMessageList';
import type { ChatMessage } from '../src/types/room';

afterEach(cleanup);
const root: ChatMessage = { id: 'root', sequence: 1, senderId: 'guest', senderName: 'Guest', senderRole: 'PARTICIPANT',
  avatarColor: '#123456', content: 'Chọn lịch họp', createdAt: '14:00', type: 'TEXT' };
const props = { root, messages: [], loading: false, sending: false, error: null, roomStatus: 'ACTIVE' as const,
  roomCode: 'room', onClose: vi.fn(), onReload: vi.fn().mockResolvedValue(undefined), onSend: vi.fn() };

it('keeps replying in the main chat separate from opening a thread', () => {
  const reply = vi.fn(), open = vi.fn();
  render(<ChatMessageList messages={[root]} onOpenDecisions={vi.fn()} onReply={reply} onOpenThread={open} />);
  fireEvent.click(screen.getByRole('button', { name: 'Trích dẫn vào kênh chính' }));
  expect(reply).toHaveBeenCalledExactlyOnceWith(root);
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Mở nhánh thảo luận:/ }));
  expect(open).toHaveBeenCalledExactlyOnceWith(root);
});

it('shows a reply count but does not offer nested threads or threads on optimistic messages', () => {
  render(<ChatMessageList messages={[{ ...root, threadReplyCount: 3 }, { ...root, id: 'reply', threadRootId: 'root' },
    { ...root, id: 'optimistic', sequence: undefined }]} onOpenDecisions={vi.fn()} onOpenThread={vi.fn()} />);
  expect(screen.getByRole('button', { name: /3 phản hồi trong nhánh:/ })).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

it('preserves a failed draft and clears it only after acknowledgement', async () => {
  const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<ThreadDrawer {...props} onSend={send} />);
  const field = screen.getByLabelText('Nhắn trong nhánh này') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: '19 giờ nhé' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' })); });
  expect(field.value).toBe('19 giờ nhé');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' })); });
  expect(field.value).toBe('');
  expect(screen.queryByRole('button', { name: 'Đính kèm ảnh hoặc tệp' })).toBeNull();
});

it('renders history read-only after the room closes', () => {
  render(<ThreadDrawer {...props} roomStatus="CLOSED" messages={[{ ...root, id: 'reply', threadRootId: 'root', content: 'Saved reply' }]} />);
  expect(screen.getByText('Saved reply')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Gửi phản hồi' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
});

it('keeps the root context outside the scrolling reply list', () => {
  render(<ThreadDrawer {...props} />);
  expect(screen.getByLabelText('Phản hồi trong nhánh').contains(screen.getByText('Tin gốc'))).toBe(false);
  expect(screen.getByText('Đang trong nhánh')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đóng nhánh thảo luận' }).textContent).toContain('Kênh chính');
});

it('announces new replies without pulling someone away from older messages', () => {
  const first = { ...root, id: 'a', threadRootId: 'root', content: 'Earlier reply' };
  const view = render(<ThreadDrawer {...props} messages={[first]} />);
  const stream = screen.getByLabelText('Phản hồi trong nhánh');
  Object.defineProperties(stream, { scrollHeight: { value: 1200, configurable: true }, clientHeight: { value: 300, configurable: true } });
  stream.scrollTop = 100;
  fireEvent.scroll(stream);
  view.rerender(<ThreadDrawer {...props} messages={[first, { ...first, id: 'b', content: 'New reply' }]} />);
  expect(stream.scrollTop).toBe(100);
  fireEvent.click(screen.getByRole('button', { name: 'Có phản hồi mới' }));
  expect(stream.scrollTop).toBe(1200);
  expect(screen.queryByRole('button', { name: 'Có phản hồi mới' })).toBeNull();
});

it('renders the desktop panel without a modal or a page-wide focus trap', () => {
  const close = vi.fn();
  render(<ThreadDrawer {...props} embedded onClose={close} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('region', { name: 'Nhánh thảo luận' })).toBeTruthy();
  expect(document.body.style.overflow).not.toBe('hidden');
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
