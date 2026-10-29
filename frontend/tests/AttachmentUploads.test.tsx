import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AttachmentUploadQueue } from '../src/services/attachmentUploadQueue';
import { attachmentApi } from '../src/services/attachmentApi';
import { ChatInputBar } from '../src/mockup/components/ChatInputBar';

vi.mock('../src/services/attachmentApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/services/attachmentApi')>();
  return {
    ...actual,
    attachmentApi: {
      upload: vi.fn(),
      cancel: vi.fn(),
      content: vi.fn(),
      download: vi.fn(),
    },
  };
});

const queues: AttachmentUploadQueue[] = [];
const file = (name = 'notes.txt') => new File(['notes'], name, { type: 'text/plain' });
const ready = {
  publicId: 'id',
  state: 'READY' as const,
  filename: 'notes.txt',
  sizeBytes: 5,
  contentType: 'text/plain',
  hasThumbnail: false,
  expiresAt: '2099-01-01T00:00:00Z',
};
const makeQueue = (enabled = true) => {
  const queue = new AttachmentUploadQueue('room', enabled);
  queues.push(queue);
  return queue;
};

beforeEach(() => {
  vi.resetAllMocks();
  class TestURL extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview');
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal('URL', TestURL);
  vi.mocked(attachmentApi.upload).mockResolvedValue(ready);
  vi.mocked(attachmentApi.cancel).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  queues.splice(0).forEach(queue => queue.dispose());
  vi.unstubAllGlobals();
});

it('does not start more than two files concurrently and caps selection at four', async () => {
  vi.mocked(attachmentApi.upload).mockImplementation(() => new Promise(() => {}));
  const queue = makeQueue();
  queue.add(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt'].map(name => file(name)));
  expect(attachmentApi.upload).toHaveBeenCalledTimes(2);
  expect(queue.getSnapshot().drafts).toHaveLength(4);
  expect(queue.getSnapshot().drafts.filter(draft => draft.state === 'queued')).toHaveLength(2);
  expect(queue.getSnapshot().selectionError).toContain('4 tệp');
});

it('validates empty files, unsupported types and image size before the network', () => {
  const queue = makeQueue();
  queue.add([
    new File([], 'empty.txt'),
    file('script.svg'),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png'),
  ]);
  expect(attachmentApi.upload).not.toHaveBeenCalled();
  expect(queue.getSnapshot().drafts).toHaveLength(0);
  expect(queue.getSnapshot().selectionError).toContain('5 MB');
});

it('marks a file ready after upload completes', async () => {
  const queue = makeQueue();
  queue.add([file()]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('ready'));
  expect(queue.getSnapshot().drafts[0].attachment).toEqual(ready);
  expect(attachmentApi.upload).toHaveBeenCalledTimes(1);
});

it('handles upload errors gracefully', async () => {
  vi.mocked(attachmentApi.upload).mockRejectedValue(new Error('Lỗi mạng'));
  const queue = makeQueue();
  queue.add([file()]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('error'));
  expect(queue.getSnapshot().drafts[0].error).toBe('Lỗi mạng');
});

it('does not upload in a closed room', () => {
  const queue = makeQueue(false);
  queue.add([file()]);
  expect(queue.getSnapshot().drafts).toHaveLength(0);
  expect(attachmentApi.upload).not.toHaveBeenCalled();
});

it('allows an attachment-only message and sends ready files', async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatInputBar
      roomCode="room"
      roomStatus="ACTIVE"
      onSendMessage={send}
      onTyping={vi.fn()}
      disabled={false}
    />
  );
  fireEvent.change(screen.getByLabelText('Chọn ảnh hoặc tệp'), { target: { files: [file()] } });
  await waitFor(() => expect(screen.getByText('Sẵn sàng')).toBeTruthy());
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Gửi tin nhắn'));
  });
  expect(send).toHaveBeenCalledWith('', undefined, [ready]);
});
