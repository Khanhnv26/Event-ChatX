import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatInputBar } from '../src/mockup/components/ChatInputBar';

afterEach(cleanup);
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
