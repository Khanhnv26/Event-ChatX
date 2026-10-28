import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PollListModal } from '../src/mockup/components/workspace/PollListModal';
import type { Poll } from '../src/mockup/types';

afterEach(cleanup);
const polls: Poll[] = [
  { id: '1', question: 'Ăn gì?', isClosed: false, options: [], totalVotes: 3, createdBy: 'Host' },
  { id: '2', question: 'Đi đâu?', isClosed: true, options: [], totalVotes: 5, createdBy: 'Host' },
];

it('filters closed polls and selects the intended poll', () => {
  const onSelect = vi.fn();
  render(<PollListModal polls={polls} selectedId="1" onClose={vi.fn()} onSelect={onSelect} />);
  fireEvent.change(screen.getByLabelText('Lọc bình chọn'), { target: { value: 'closed' } });
  expect(screen.queryByRole('button', { name: /Ăn gì/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Đi đâu/ }));
  expect(onSelect).toHaveBeenCalledWith('2');
  expect(screen.queryByRole('button', { name: 'Tạo bình chọn' })).toBeNull();
});

it('allows creating the first poll from an empty list', () => {
  const onCreate = vi.fn();
  render(<PollListModal polls={[]} selectedId="0" onClose={vi.fn()} onSelect={vi.fn()} onCreate={onCreate} />);
  expect(screen.getByText('Chưa có bình chọn trong danh sách này.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bình chọn' }));
  expect(onCreate).toHaveBeenCalledOnce();
});
