import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MessageReactionButtons } from '../src/components/room/MessageReactionButtons';
import { PinnedMessageBanner } from '../src/components/room/PinnedMessageBanner';
import type { ChatMessage } from '../src/types/room';

afterEach(cleanup);

const pinned: ChatMessage = {
  id: 'older', senderId: 'host', senderName: 'Host', senderRole: 'HOST',
  avatarColor: '#6366F1', content: 'Agenda buổi họp', createdAt: '10:00',
};

it('adds an emoji from the picker and removes it through the count chip', () => {
  const set = vi.fn();
  const view = render(<MessageReactionButtons onSetReaction={set} />);
  const picker = screen.getByRole('button', { name: 'Thả cảm xúc' });
  fireEvent.click(picker);
  fireEvent.click(screen.getByRole('button', { name: 'Thả Yêu thích' }));
  expect(set).toHaveBeenLastCalledWith('HEART', true);
  expect(document.activeElement).toBe(picker);

  view.rerender(<MessageReactionButtons onSetReaction={set}
    reactions={[{ emoji: 'HEART', count: 2, reactedByMe: true }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Yêu thích, 2 lượt', pressed: true }));
  expect(set).toHaveBeenLastCalledWith('HEART', false);
});

it('opens the full pinned message when it is outside the loaded history', () => {
  const unpin = vi.fn();
  const view = render(<PinnedMessageBanner message={pinned} roomCode="room" onUnpin={unpin} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mở tin nhắn đã ghim' }));
  expect(screen.getByRole('dialog', { name: 'Tin nhắn đã ghim' }).textContent).toContain('Agenda buổi họp');
  fireEvent.click(screen.getByRole('button', { name: 'Đóng tin nhắn ghim' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ ghim tin nhắn' }));
  expect(unpin).toHaveBeenCalledOnce();
  view.rerender(<PinnedMessageBanner message={pinned} roomCode="room" />);
  expect(screen.queryByRole('button', { name: 'Bỏ ghim tin nhắn' })).toBeNull();
});
