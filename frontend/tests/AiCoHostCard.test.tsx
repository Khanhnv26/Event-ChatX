/**
 * Tests for AiCoHostCard rendering in message list
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ChatMessageList } from '../src/components/room/ChatMessageList';
import type { ChatMessage } from '../src/types/room';

afterEach(cleanup);

it('renders structured sections, focuses a loaded source, and shows an excerpt for an older source', () => {
  const person: ChatMessage = {
    id: 'message-1', senderId: 'an', senderName: 'MAI', senderRole: 'PARTICIPANT',
    avatarColor: '#abc', content: 'Chốt họp lúc 10h.', createdAt: '09:01',
  };
  const summary: ChatMessage = {
    ...person, id: 'ai-1', type: 'AI_BOT', senderId: 'ai-cohost',
    aiSummary: {
      contextCount: 2, demo: false, next: [],
      decided: [{ text: 'Họp lúc 10h', sources: [
        { id: 'message-1', number: 1, speaker: 'MAI', excerpt: 'Chốt họp lúc 10h.' },
      ] }],
      open: [{ text: 'Chờ chọn địa điểm', sources: [
        { id: 'older', number: 2, speaker: 'An', excerpt: 'Chưa có địa điểm.' },
      ] }],
    },
  };
  render(<div data-ai-scope><ChatMessageList messages={[person, summary]} onOpenDecisions={() => {}} /></div>);

  expect(screen.getByRole('heading', { name: 'Đã chốt' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Còn mở' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Việc tiếp theo' })).toBeNull();
  expect(screen.getAllByText('AI Co-Host')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Nguồn 1' }));
  expect(document.activeElement?.getAttribute('data-message-id')).toBe('message-1');
  fireEvent.click(screen.getByRole('button', { name: 'Nguồn 2' }));
  expect(screen.getByText('Chưa có địa điểm.')).toBeTruthy();
});

it('shows one empty state when a summary has no recorded items', () => {
  const summary: ChatMessage = {
    id: 'ai-empty', senderId: 'ai-cohost', senderName: 'AI Co-Host', senderRole: 'PARTICIPANT',
    avatarColor: '#abc', content: '', createdAt: '16:50', type: 'AI_BOT',
    aiSummary: { contextCount: 3, demo: false, decided: [], open: [], next: [] },
  };
  render(<ChatMessageList messages={[summary]} onOpenDecisions={() => {}} />);

  expect(screen.getByText('3 tin nhắn gần đây · Kênh chính')).toBeTruthy();
  expect(screen.getByText('Chưa ghi nhận quyết định, câu hỏi mở hoặc việc tiếp theo.')).toBeTruthy();
  expect(screen.getAllByRole('heading')).toHaveLength(1);
});
