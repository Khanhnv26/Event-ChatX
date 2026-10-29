import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PollCard } from '../src/components/room/workspace/PollCard';
import type { Poll } from '../src/types/room';

afterEach(cleanup);
const poll: Poll = {
  id: '1', question: 'Chọn địa điểm gặp mặt?', isClosed: false, totalVotes: 0, createdBy: 'Host',
  options: [{ id: 'a', text: 'Quán cà phê', votes: 0 }, { id: 'b', text: 'Công viên', votes: 0 }],
};

it('lets a participant review and change their choice before sending a vote', () => {
  const vote = vi.fn();
  render(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vote} />);
  expect((screen.getByRole('button', { name: 'Gửi phiếu' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Quán cà phê' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Công viên' }));
  expect(vote).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith(['b']);
});

it('locks voting during the request and allows retrying without losing the choice', () => {
  const vote = vi.fn();
  const view = render(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Quán cà phê' }));
  view.rerender(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vote} isVoting />);
  fireEvent.click(screen.getByRole('button', { name: 'Đang gửi phiếu...' }));
  expect(vote).not.toHaveBeenCalled();
  expect((screen.getByRole('radio', { name: 'Công viên' }) as HTMLInputElement).disabled).toBe(true);
  view.rerender(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith(['a']);
});

it('lets a participant change a previously acknowledged single vote', () => {
  const vote = vi.fn();
  const voted: Poll = { ...poll, totalVotes: 1, options: [{ ...poll.options[0], votes: 1, votedByMe: true }, poll.options[1]] };
  render(<PollCard poll={voted} roomStatus="ACTIVE" onVotePoll={vote} />);
  expect(screen.getByText('Phiếu hiện tại của bạn')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Công viên' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith(['b']);
});

it('allows voting for an additional option in multiple-choice mode', () => {
  const vote = vi.fn();
  const voted: Poll = { ...poll, allowMultiple: true, totalVotes: 1,
    options: [{ ...poll.options[0], votes: 1, votedByMe: true }, poll.options[1]] };
  render(<PollCard poll={voted} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Công viên' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
});

it('lets a participant remove a previous checkbox selection and submit the complete ballot', () => {
  const vote = vi.fn();
  const voted: Poll = { ...poll, allowMultiple: true, totalVotes: 2,
    options: poll.options.map(option => ({ ...option, votes: 1, votedByMe: true })) };
  render(<PollCard poll={voted} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Quán cà phê' }));
  expect(vote).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith(['b']);
});

it('withdraws a single vote only after confirming the update', () => {
  const vote = vi.fn();
  const voted: Poll = { ...poll, options: [{ ...poll.options[0], votedByMe: true }, poll.options[1]] };
  render(<PollCard poll={voted} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rút phiếu' }));
  expect(vote).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật phiếu' }));
  expect(vote).toHaveBeenCalledExactlyOnceWith([]);
});

it.each(['CLOSED', 'EXPIRED', 'poll-closed'] as const)('disables participation when %s', state => {
  render(<PollCard poll={{ ...poll, isClosed: state === 'poll-closed' }}
    roomStatus={state === 'poll-closed' ? 'ACTIVE' : state} onVotePoll={vi.fn()} />);
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Gửi phiếu' })).toBeNull();
});

it('keeps an unsent choice from carrying into another poll', () => {
  const vote = vi.fn();
  const view = render(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Quán cà phê' }));
  view.rerender(<PollCard poll={{ ...poll, id: '2' }} roomStatus="ACTIVE" onVotePoll={vote} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phiếu' }));
  expect(vote).not.toHaveBeenCalled();
});

it('only exposes the end-poll action to the host', () => {
  const close = vi.fn().mockResolvedValue(undefined);
  const view = render(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vi.fn()} onClosePoll={close} />);
  expect(screen.queryByRole('button', { name: 'Kết thúc bình chọn' })).toBeNull();
  view.rerender(<PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={vi.fn()} onClosePoll={close} isHost />);
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc bình chọn' }));
  expect(close).toHaveBeenCalledOnce();
});
