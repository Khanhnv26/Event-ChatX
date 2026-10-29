import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WheelSpinModal } from '../src/components/room/WheelSpinModal';
import confetti from 'canvas-confetti';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const items = [{ id: '1', label: 'A', color: '#fff' }, { id: '2', label: 'B', color: '#000' }];
const wheel = { id: 1, title: 'Dinner', entries: ['A', 'B'], excludeWinner: false, createdAt: '',
  spins: [{ id: 7, wheelId: 1, actorNickname: 'Host', idempotencyKey: 'spin', resultEntry: 'A', entriesSnapshot: ['A', 'B'], createdAt: '' }] };
afterEach(() => { cleanup(); vi.useRealTimers(); delete document.documentElement.dataset.motion; });

it('does not fabricate a local winner when the server rejects a spin', async () => {
  vi.useFakeTimers();
  render(<WheelSpinModal isOpen isHost items={items} onClose={vi.fn()}
    onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={vi.fn().mockRejectedValue(new Error('Đã đóng'))} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  await act(async () => { vi.advanceTimersByTime(4200); });
  expect(screen.queryByText('KẾT QUẢ VÒNG QUAY')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Đã đóng');
});

it('prevents participants from triggering a spin', () => {
  render(<WheelSpinModal isOpen isHost={false} items={items} onClose={vi.fn()} onConfirmWinnerAsDecision={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'QUAY NGAY' }) as HTMLButtonElement).disabled).toBe(true);
});

it('keeps the original slices while the server removes a winner during a spin', async () => {
  vi.useFakeTimers();
  function Harness() {
    const [entries, setEntries] = React.useState(items);
    return <WheelSpinModal isOpen isHost items={entries} onClose={vi.fn()}
      onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={async () => {
        setEntries([items[1]]);
        return 'A';
      }} />;
  }
  render(<Harness />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  expect(document.querySelectorAll('svg[viewBox="0 0 100 100"] path').length).toBe(2);
  expect(screen.queryByText('KẾT QUẢ VÒNG QUAY')).toBeNull();
  await act(async () => { vi.advanceTimersByTime(4200); });
  expect(screen.getByText('KẾT QUẢ VÒNG QUAY')).toBeTruthy();
});

it('keeps configuration drafts when participant presence changes', () => {
  const props = { isOpen: true, isHost: true, items, onClose: vi.fn(), onConfirmWinnerAsDecision: vi.fn() };
  const { rerender } = render(<WheelSpinModal {...props} participants={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo vòng quay mới' }));
  rerender(<WheelSpinModal {...props} participants={[]} />);
  expect(screen.getByText('Tiêu đề vòng quay')).toBeTruthy();
});

it('cancels the pending celebration when unmounted', async () => {
  vi.useFakeTimers();
  vi.mocked(confetti).mockClear();
  const { unmount } = render(<WheelSpinModal isOpen isHost items={items} onClose={vi.fn()}
    onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={async () => 'A'} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  unmount();
  await act(async () => { vi.advanceTimersByTime(4200); });
  expect(confetti).not.toHaveBeenCalled();
});

it('locks wheel selection and configuration while a spin request is pending', async () => {
  render(<WheelSpinModal isOpen isHost items={items} currentWheelId={1}
    wheelList={[{ id: 1, title: 'Wheel', entries: ['A', 'B'], excludeWinner: false, createdAt: '', spins: [] }]}
    onClose={vi.fn()} onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={() => new Promise(() => {})} />);
  fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' }));
  expect((screen.getByLabelText('Chọn vòng quay') as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Tạo vòng quay mới' }) as HTMLButtonElement).disabled).toBe(true);
});

it('reveals the winner on transition completion and celebrates only once', async () => {
  vi.useFakeTimers();
  document.documentElement.dataset.motion = 'full';
  vi.mocked(confetti).mockClear();
  render(<WheelSpinModal isOpen isHost items={items} onClose={vi.fn()}
    onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={async () => 'A'} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  expect(screen.queryByText('KẾT QUẢ VÒNG QUAY')).toBeNull();
  const end = new Event('transitionend', { bubbles: true });
  Object.defineProperty(end, 'propertyName', { value: 'transform' });
  fireEvent(screen.getByLabelText('Vòng quay'), end);
  expect(screen.getByText('KẾT QUẢ VÒNG QUAY')).toBeTruthy();
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(confetti).toHaveBeenCalledOnce();
});

it('skips the spin wait and confetti when reduced motion is selected', async () => {
  vi.useFakeTimers();
  document.documentElement.dataset.motion = 'reduced';
  vi.mocked(confetti).mockClear();
  render(<WheelSpinModal isOpen isHost items={items} onClose={vi.fn()}
    onConfirmWinnerAsDecision={vi.fn()} onSpinRemote={async () => 'A'} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QUAY NGAY' })); });
  await act(async () => { vi.advanceTimersByTime(0); });
  expect(screen.getByText('KẾT QUẢ VÒNG QUAY')).toBeTruthy();
  expect(screen.getByLabelText('Vòng quay').style.transition).toBe('none');
  expect(confetti).not.toHaveBeenCalled();
});

it('requires context and blocks repeat saves while the same spin is being saved', async () => {
  let resolve!: (ok: boolean) => void;
  const save = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
  const close = vi.fn();
  render(<WheelSpinModal isOpen isHost items={items} wheelList={[wheel]} currentWheelId={1} remoteWinner="A"
    onClose={close} onConfirmWinnerAsDecision={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất từ kết quả' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('nhập việc cần quyết định');
  fireEvent.change(screen.getByLabelText('Việc cần quyết định'), { target: { value: 'Người bao kèo lẩu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đề xuất từ kết quả' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đang lưu đề xuất...' }));
  expect(save).toHaveBeenCalledExactlyOnceWith('A', 'Người bao kèo lẩu', 7);
  await act(async () => { resolve(true); });
  expect(close).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Đã tạo đề xuất từ lượt quay này' }) as HTMLButtonElement).disabled).toBe(true);
});

it('does not offer saving the same spin after reopening or to participants', () => {
  const props = { isOpen: true, items, wheelList: [wheel], currentWheelId: 1, remoteWinner: 'A', onClose: vi.fn(), onConfirmWinnerAsDecision: vi.fn() };
  const view = render(<WheelSpinModal {...props} isHost savedSpinIds={[7]} />);
  expect((screen.getByRole('button', { name: 'Đã tạo đề xuất từ lượt quay này' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<WheelSpinModal {...props} />);
  expect(screen.queryByRole('button', { name: 'Tạo đề xuất từ kết quả' })).toBeNull();
});
