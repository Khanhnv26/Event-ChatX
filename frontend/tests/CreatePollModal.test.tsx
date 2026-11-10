import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CreatePollModal } from '../src/components/room/CreatePollModal';

afterEach(cleanup);
it('creates a rating poll with fixed server-defined options', async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<CreatePollModal isOpen onClose={vi.fn()} onCreatePoll={onCreate} />);
  fireEvent.change(screen.getByPlaceholderText(/VD:/), { target: { value: 'Đánh giá buổi họp' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Kiểu bình chọn' }), { target: { value: 'RATING' } });
  expect(screen.queryByPlaceholderText('Lựa chọn 1')).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tạo bình chọn' })); });
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('Đánh giá buổi họp', [], false, 'RATING');
});
it('waits for server acknowledgement before closing the form', async () => {
  let resolve!: () => void;
  const onCreate = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const onClose = vi.fn();
  render(<CreatePollModal isOpen onClose={onClose} onCreatePoll={onCreate} />);
  fireEvent.change(screen.getByPlaceholderText(/VD:/), { target: { value: 'Question' } });
  fireEvent.change(screen.getByPlaceholderText('Lựa chọn 1'), { target: { value: 'A' } });
  fireEvent.change(screen.getByPlaceholderText('Lựa chọn 2'), { target: { value: 'B' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bình chọn' }));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { resolve(); });
  expect(onClose).toHaveBeenCalledOnce();
});

it('preserves the input and displays a rejected request', async () => {
  const onClose = vi.fn();
  render(<CreatePollModal isOpen onClose={onClose} onCreatePoll={vi.fn().mockRejectedValue(new Error('Mất kết nối'))} />);
  fireEvent.change(screen.getByPlaceholderText(/VD:/), { target: { value: 'Question' } });
  fireEvent.change(screen.getByPlaceholderText('Lựa chọn 1'), { target: { value: 'A' } });
  fireEvent.change(screen.getByPlaceholderText('Lựa chọn 2'), { target: { value: 'B' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tạo bình chọn' })); });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Mất kết nối')).toBeTruthy();
  expect((screen.getByPlaceholderText(/VD:/) as HTMLInputElement).value).toBe('Question');
});
