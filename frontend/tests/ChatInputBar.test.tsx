import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatInputBar } from '../src/components/room/ChatInputBar';

afterEach(cleanup);
it('requests a summary without clearing the message draft', async () => {
  const send = vi.fn().mockResolvedValue(true);
  render(<ChatInputBar roomCode="room-1" roomStatus="ACTIVE" onSendMessage={send} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  fireEvent.change(input, { target: { value: 'Bản nháp của mình' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tóm tắt thảo luận' })); });
  expect(send).toHaveBeenCalledWith('/ai tóm tắt thảo luận');
  expect(input.value).toBe('Bản nháp của mình');
});
it('submits the selected reply and preserves it on failure', async () => {
  const send = vi.fn().mockResolvedValue(false);
  const cancel = vi.fn();
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={send} onCancelReply={cancel}
    replyTo={{ id: 'original', senderId: 'guest', senderName: 'Guest', senderRole: 'PARTICIPANT',
      avatarColor: '#fff', content: 'Original', createdAt: '10:00' }} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reply' } });
  await act(async () => { fireEvent.click(screen.getByTitle('Gửi tin nhắn')); });
  expect(send).toHaveBeenCalledWith('Reply', 'original');
  expect(cancel).not.toHaveBeenCalled();
  expect(screen.getByText('Trả lời Guest: Original')).toBeTruthy();
});
it('keeps the draft when sending fails', async () => {
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={vi.fn().mockResolvedValue(false)} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Please keep this' } });
  await act(async () => { fireEvent.click(screen.getByTitle('Gửi tin nhắn')); });
  expect(input.value).toBe('Please keep this');
});

it('disables input and sending for expired rooms', () => {
  const send = vi.fn();
  render(<ChatInputBar roomStatus="EXPIRED" onSendMessage={send} />);
  expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByTitle('Gửi tin nhắn') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
  expect(send).not.toHaveBeenCalled();
});

it('inserts @ai prefix when AI button is clicked', () => {
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={vi.fn()} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  const aiButton = screen.getByTitle('Gọi AI Co-Host (@ai)');
  fireEvent.click(aiButton);
  expect(input.value).toBe('@ai ');

  // Clicking again when already starting with @ai preserves it
  fireEvent.click(aiButton);
  expect(input.value).toBe('@ai ');
});
