import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatInputBar } from '../src/components/room/ChatInputBar';
import type { Participant } from '../src/types/room';

afterEach(cleanup);

it('inserts an explicit @Everyone mention when the group suggestion is selected', async () => {
  const send = vi.fn().mockResolvedValue(true);
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={send} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  fireEvent.change(input, { target: { value: '@eve' } });
  fireEvent.click(screen.getByRole('option', { name: /@Everyone/ }));
  expect(input.value).toBe('@Everyone ');
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  expect(send).toHaveBeenCalledExactlyOnceWith('@Everyone ', undefined, undefined, [{ everyone: true, start: 0, end: 9 }]);
});

it('selects the correct room member when nicknames match and preserves the tag after editing the draft', async () => {
  const send = vi.fn().mockResolvedValue(true);
  const members: Participant[] = ['member-111111', 'member-222222'].map(id => ({
    id, nickname: 'Đức Anh', role: 'PARTICIPANT', isOnline: true, avatarColor: '#123456',
  }));
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={send} mentionMembers={members} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  fireEvent.change(input, { target: { value: '@duc' } });
  const choice = screen.getByRole('option', { name: /Đức Anh.*222222/ });
  expect(choice.querySelector('strong')?.textContent).toBe('@Đức Anh');
  fireEvent.click(choice);
  fireEvent.change(input, { target: { value: 'Chào @Đức Anh ' } });
  fireEvent.change(input, { target: { value: 'Chào @Đức Anh nhé' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  expect(send).toHaveBeenCalledExactlyOnceWith('Chào @Đức Anh nhé', undefined, undefined,
    [{ guestId: 'member-222222', start: 5, end: 13 }]);
});

it('offers AI commands after @ and uses Enter to select before sending', async () => {
  const send = vi.fn().mockResolvedValue(true);
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={send} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  fireEvent.change(input, { target: { value: 'lan@a' } });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.change(input, { target: { value: '@a' } });
  expect(screen.getByRole('listbox', { name: 'Gợi ý thành viên và lệnh AI' })).toBeTruthy();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('option', { selected: true }).textContent).toContain('@ai tóm tắt thảo luận');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('@ai tóm tắt thảo luận ');
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).toBeNull();
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  expect(send).toHaveBeenCalledExactlyOnceWith('@ai tóm tắt thảo luận ', undefined);
});

it('sends the draft once on Enter after text composition has finished', async () => {
  const send = vi.fn().mockResolvedValue(true);
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={send} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  fireEvent.change(input, { target: { value: 'Chào cả phòng' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', repeat: true });
  expect(send).not.toHaveBeenCalled();
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  expect(send).toHaveBeenCalledExactlyOnceWith('Chào cả phòng', undefined);
  expect(input.value).toBe('');
});

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

it('opens emoji picker and appends selected emoji to input', () => {
  render(<ChatInputBar roomStatus="ACTIVE" onSendMessage={vi.fn()} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  const smileButton = screen.getByTitle('Thêm biểu tượng cảm xúc');
  
  // Picker is closed initially
  expect(screen.queryByRole('dialog', { name: 'Bảng chọn biểu tượng cảm xúc' })).toBeNull();
  
  // Open picker
  fireEvent.click(smileButton);
  expect(screen.getByRole('dialog', { name: 'Bảng chọn biểu tượng cảm xúc' })).toBeTruthy();
  
  // Click an emoji (e.g. 👍)
  const thumbsUpBtn = screen.getByTitle('👍');
  fireEvent.click(thumbsUpBtn);
  
  expect(input.value).toBe('👍');
  
  // Click another emoji (e.g. ❤️)
  fireEvent.click(screen.getByTitle('❤️'));
  expect(input.value).toBe('👍 ❤️');
});
