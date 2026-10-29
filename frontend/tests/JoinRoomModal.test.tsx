import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JoinRoomModal } from '../src/components/room/JoinRoomModal';

afterEach(cleanup);

it('prevents duplicate joins and keeps errors inside the dialog for retry', async () => {
  let reject!: (error: Error) => void;
  const join = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  render(<JoinRoomModal isOpen slug="room" onJoin={join} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Biệt danh của bạn'), { target: { value: 'Minh' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vào phòng ngay' }));
  expect((screen.getByRole('button', { name: 'Đang tham gia…' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByLabelText('Biệt danh của bạn').closest('form')!);
  expect(join).toHaveBeenCalledOnce();
  await act(async () => { reject(new Error('Phòng đã đầy')); });
  expect(screen.getByRole('alert').textContent).toContain('Phòng đã đầy');
  expect((screen.getByRole('button', { name: 'Vào phòng ngay' }) as HTMLButtonElement).disabled).toBe(false);
});
