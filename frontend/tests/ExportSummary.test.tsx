import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExportSummaryModal } from '../src/mockup/components/ExportSummaryModal';
import { eventChatApi } from '../src/services/eventChatApi';
import { toast } from '../src/stores/toastStore';
import type { RoomExportResponse } from '../src/types/backend.types';

vi.mock('../src/services/eventChatApi', () => ({ eventChatApi: { exportSummary: vi.fn() } }));
vi.mock('../src/stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const report: RoomExportResponse = { roomSlug: 'room', roomTitle: 'Server report', roomStatus: 'CLOSED',
  participantCount: 4, confirmedDecisions: [], polls: [], wheels: [],
  markdownSummary: '# Server report\nAll polls and wheels', exportedAt: '2026-10-28T00:00:00Z' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(eventChatApi.exportSummary).mockResolvedValue(report); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('uses the same server markdown for preview and clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<ExportSummaryModal isOpen roomCode="room" onClose={vi.fn()} />);
  expect((await screen.findByText(/All polls and wheels/)).textContent).toBe(report.markdownSummary);
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép Markdown' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(writeText).toHaveBeenCalledWith(report.markdownSummary);
});
it('does not claim success when the clipboard rejects', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
  render(<ExportSummaryModal isOpen roomCode="room" onClose={vi.fn()} />);
  await screen.findByText(/All polls and wheels/);
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép Markdown' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(toast.success).not.toHaveBeenCalled();
});
it('shows the authorization error instead of a locally invented report', async () => {
  vi.mocked(eventChatApi.exportSummary).mockRejectedValue(new Error('Chỉ Host được xuất'));
  render(<ExportSummaryModal isOpen roomCode="room" onClose={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chỉ Host được xuất');
  expect(screen.queryByRole('button', { name: 'Tải Markdown' })).toBeNull();
});

it('renders visual preview with structured decisions, polls, wheels and switches tabs', async () => {
  const richReport: RoomExportResponse = {
    roomSlug: 'rich-room',
    roomTitle: 'Họp Team Dự Án',
    roomStatus: 'CLOSED',
    participantCount: 5,
    confirmedDecisions: [{
      id: 1,
      text: 'Chốt chọn công nghệ Vite + React 19',
      creatorNickname: 'Alice',
      status: 'CONFIRMED',
      evidenceRefs: [],
      approveCount: 4,
      rejectCount: 0,
      createdAt: '2026-10-28T01:00:00Z',
      confirmedAt: '2026-10-28T02:00:00Z',
    }],
    polls: [{
      id: 10,
      question: 'Ăn trưa ở đâu?',
      status: 'CLOSED',
      allowMultiple: false,
      createdAt: '2026-10-28T01:10:00Z',
      closedAt: '2026-10-28T01:30:00Z',
      options: [
        { id: 101, label: 'Cơm tấm', voteCount: 4, displayOrder: 1 },
        { id: 102, label: 'Bún bò', voteCount: 1, displayOrder: 2 },
      ],
    }],
    wheels: [{
      id: 20,
      title: 'Vòng quay trả tiền trà sữa',
      entries: ['Alice', 'Bob', 'Charlie'],
      excludeWinner: false,
      createdAt: '2026-10-28T01:40:00Z',
      spins: [{
        id: 201,
        wheelId: 20,
        actorNickname: 'Alice',
        idempotencyKey: 'k-1',
        resultEntry: 'Bob',
        entriesSnapshot: ['Alice', 'Bob', 'Charlie'],
        createdAt: '2026-10-28T01:45:00Z',
      }],
    }],
    markdownSummary: '# Họp Team Dự Án\nMarkdown version',
    exportedAt: '2026-10-28T03:00:00Z',
  };
  vi.mocked(eventChatApi.exportSummary).mockResolvedValue(richReport);

  const printSpy = vi.fn();
  window.print = printSpy;

  render(<ExportSummaryModal isOpen roomCode="rich-room" onClose={vi.fn()} />);

  expect(await screen.findByText('Chốt chọn công nghệ Vite + React 19')).toBeTruthy();
  expect(screen.getByText('Ăn trưa ở đâu?')).toBeTruthy();
  expect(screen.getByText('Cơm tấm')).toBeTruthy();
  expect(screen.getByText('Bob')).toBeTruthy();

  // Test print
  fireEvent.click(screen.getByRole('button', { name: 'In / Lưu PDF' }));
  expect(printSpy).toHaveBeenCalled();

  // Switch to Markdown tab
  fireEvent.click(screen.getByRole('tab', { name: 'Mã nguồn Markdown' }));
  expect(screen.getByRole('tab', { name: 'Mã nguồn Markdown' }).getAttribute('aria-selected')).toBe('true');
});
