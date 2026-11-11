import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RoomNotificationMenu } from '../src/components/room/RoomNotificationMenu';
import type { RoomNotification } from '../src/types/roomNotification';

const poll: RoomNotification = { id: 'poll:1', kind: 'poll', targetId: '1', title: 'Bình chọn mới',
  detail: 'Chọn giờ họp', receivedAt: 1, read: false };
const decision: RoomNotification = { id: 'decision:1', kind: 'decision', targetId: '1', title: 'Quyết định đã chốt',
  detail: 'Chọn phòng họp', receivedAt: 2, read: true };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([false, true])('opens and filters the notification list, then selects the destination (mobile: %s)', mobile => {
  vi.stubGlobal('matchMedia', () => ({ matches: mobile }));
  const select = vi.fn();
  const readAll = vi.fn();
  render(<RoomNotificationMenu entries={[poll, decision]} soundEnabled={false}
    changeSound={vi.fn()} previewSound={vi.fn()} readAll={readAll} onSelect={select} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
  expect(screen.getByRole(mobile ? 'dialog' : 'region', { name: 'Thông báo' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Chưa đọc' }));
  expect(screen.queryByText('Quyết định đã chốt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Đọc tất cả' }));
  expect(readAll).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: /Bình chọn mới/ }));
  expect(select).toHaveBeenCalledExactlyOnceWith(poll);
  expect(screen.queryByRole(mobile ? 'dialog' : 'region', { name: 'Thông báo' })).toBeNull();
});

it('offers separate actions to enable and preview sound', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const changeSound = vi.fn().mockResolvedValue(true);
  const previewSound = vi.fn().mockResolvedValue(false);
  render(<RoomNotificationMenu entries={[]} soundEnabled={false}
    changeSound={changeSound} previewSound={previewSound} readAll={vi.fn()} onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
  await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Âm báo' })); });
  expect(changeSound).toHaveBeenCalledExactlyOnceWith(true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nghe thử' })); });
  expect(previewSound).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain('chưa phát được');
});
