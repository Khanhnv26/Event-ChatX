import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DecisionPanel } from '../src/components/room/workspace/DecisionPanel';
import type { DecisionCard } from '../src/types/room';
afterEach(cleanup);
const proposed: DecisionCard = { id: '1', title: 'Người bao kèo → Host', status: 'PROPOSED', creatorGuestId: 'owner', creatorNickname: 'Minh', evidenceType: 'WHEEL' };
const props = { roomStatus: 'ACTIVE' as const, onAddDecision: vi.fn(), onConfirmDecision: vi.fn() };

it('allows an author to delete their own proposal after confirmation', async () => {
  const remove = vi.fn().mockResolvedValue(true);
  render(<DecisionPanel {...props} decisions={[proposed]} currentGuestId="owner" onRemoveDecision={remove} />);
  fireEvent.click(screen.getByRole('button', { name: /Xóa đề xuất:/ }));
  expect(remove).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' })); });
  expect(remove).toHaveBeenCalledExactlyOnceWith('1');
});

it('restricts withdrawal to hosts and retains a failed confirmation for retry', async () => {
  const remove = vi.fn().mockResolvedValue(false);
  const decisions: DecisionCard[] = [{ ...proposed, status: 'CONFIRMED' }];
  const view = render(<DecisionPanel {...props} decisions={decisions} currentGuestId="owner" onRemoveDecision={remove} />);
  expect(screen.queryByRole('button', { name: /Thu hồi quyết định:/ })).toBeNull();
  view.rerender(<DecisionPanel {...props} decisions={decisions} isHost onRemoveDecision={remove} />);
  fireEvent.click(screen.getByRole('button', { name: /Thu hồi quyết định:/ }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' })); });
  expect(screen.getByRole('button', { name: 'Xác nhận thu hồi' })).toBeTruthy();
});

it('moves removed cards into collapsed history and excludes them from confirmed count', () => {
  render(<DecisionPanel {...props} isHost decisions={[{ ...proposed, status: 'WITHDRAWN' }]} onRemoveDecision={vi.fn()} />);
  expect(screen.getByText('0 đã chốt')).toBeTruthy();
  expect(screen.getByText('Đã thu hồi').closest('details')?.open).toBe(false);
  expect(screen.queryByRole('button', { name: /Thu hồi quyết định:/ })).toBeNull();
});

it('does not offer deletion for another guest or a closed room', () => {
  const view = render(<DecisionPanel {...props} decisions={[proposed]} currentGuestId="other" onRemoveDecision={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Xóa đề xuất:/ })).toBeNull();
  view.rerender(<DecisionPanel {...props} roomStatus="CLOSED" isHost decisions={[proposed]} onRemoveDecision={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Xóa đề xuất:/ })).toBeNull();
});

it('shows distinct proposer and confirmer names, complete timestamp and approval count', () => {
  render(<DecisionPanel {...props} decisions={[{ ...proposed, status: 'CONFIRMED', confirmedBy: 'Lan',
    confirmedAt: '2026-10-29T08:30:00Z', approveCount: 4 }]} />);
  expect(screen.getByText('Đề xuất bởi:').nextElementSibling?.textContent).toBe('Minh');
  expect(screen.getByText('Người chốt:').nextElementSibling?.textContent).toBe('Lan');
  const time = screen.getByText('Chốt lúc:').nextElementSibling?.querySelector('time');
  expect(time?.getAttribute('datetime')).toBe('2026-10-29T08:30:00Z');
  expect(time?.textContent).toContain('29/10/2026');
  expect(screen.getByText('4 lượt tán thành')).toBeTruthy();
});

it('does not invent a confirmer for legacy decisions or show a finalization on a proposal', () => {
  const view = render(<DecisionPanel {...props} decisions={[{ ...proposed, status: 'CONFIRMED' }]} />);
  expect(screen.getByText('Người chốt:').nextElementSibling?.textContent).toBe('Chưa ghi nhận');
  expect(screen.getByText('Chốt lúc:').nextElementSibling?.textContent).toBe('Chưa ghi nhận');
  expect(screen.getByText('0 lượt tán thành')).toBeTruthy();
  view.rerender(<DecisionPanel {...props} decisions={[proposed]} />);
  expect(screen.queryByText('Người chốt:')).toBeNull();
  expect(screen.getByText('Đề xuất bởi:').nextElementSibling?.textContent).toBe('Minh');
});

it('retains attribution in withdrawn decision history', () => {
  render(<DecisionPanel {...props} decisions={[{ ...proposed, status: 'WITHDRAWN', confirmedBy: 'Lan',
    confirmedAt: '2026-10-29T08:30:00Z', approveCount: 2 }]} />);
  expect(screen.getByText('Người chốt:').closest('details')).toBeTruthy();
  expect(screen.getByText('Lan')).toBeTruthy();
  expect(screen.getByText('2 lượt tán thành')).toBeTruthy();
});
