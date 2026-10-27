import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WheelSpinModal } from '../src/mockup/components/WheelSpinModal';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const items = [{ id: '1', label: 'A', color: '#fff' }, { id: '2', label: 'B', color: '#000' }];
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('does not fabricate a local winner when the server rejects a spin', async () => {
  vi.useFakeTimers();
  render(<WheelSpinModal isOpen isHost items={items} onClose={vi.fn()}
    onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={vi.fn().mockRejectedValue(new Error('Đã đóng'))} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  await act(async () => { vi.advanceTimersByTime(4000); });
  expect(screen.queryByText('KẾT QUẢ ĐÃ CHỐT')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Đã đóng');
});

it('prevents participants from triggering a spin', () => {
  render(<WheelSpinModal isOpen isHost={false} items={items} onClose={vi.fn()} onConfirmWinnerAsDecision={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'QUAY NGAY' }) as HTMLButtonElement).disabled).toBe(true);
});
