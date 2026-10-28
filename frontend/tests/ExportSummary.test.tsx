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
