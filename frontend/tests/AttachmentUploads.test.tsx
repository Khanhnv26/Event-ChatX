import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AttachmentUploadQueue } from '../src/services/attachmentUploadQueue';
import { attachmentApi } from '../src/services/attachmentApi';
import { ChatInputBar } from '../src/mockup/components/ChatInputBar';
import { ApiError } from '../src/services/api.client';

vi.mock('../src/services/attachmentApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/services/attachmentApi')>();
  return { ...actual, attachmentApi: { create: vi.fn(), upload: vi.fn(), status: vi.fn(), cancel: vi.fn(), content: vi.fn(), download: vi.fn() } };
});

const queues: AttachmentUploadQueue[] = [];
const file = (name = 'notes.txt') => new File(['notes'], name, { type: 'text/plain' });
const ready = { publicId: 'id', state: 'READY' as const, filename: 'notes.txt', sizeBytes: 5,
  contentType: 'text/plain', hasThumbnail: false, expiresAt: '2099-01-01T00:00:00Z' };
const makeQueue = (enabled = true) => { const queue = new AttachmentUploadQueue('room', enabled); queues.push(queue); return queue; };

beforeEach(() => {
  vi.resetAllMocks();
  class TestURL extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview');
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal('URL', TestURL);
  vi.mocked(attachmentApi.create).mockResolvedValue({ publicId: 'id', state: 'RESERVED', sizeBytes: 5, uploadExpiresAt: '2099-01-01T00:00:00Z' });
  vi.mocked(attachmentApi.upload).mockResolvedValue(undefined);
  vi.mocked(attachmentApi.status).mockResolvedValue(ready);
  vi.mocked(attachmentApi.cancel).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); queues.splice(0).forEach(queue => queue.dispose()); vi.unstubAllGlobals(); });

it('does not start more than two files and caps selection at four', async () => {
  vi.mocked(attachmentApi.create).mockImplementation(() => new Promise(() => {}));
  const queue = makeQueue();
  queue.add(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt'].map(name => file(name)));
  expect(attachmentApi.create).toHaveBeenCalledTimes(2);
  expect(queue.getSnapshot().drafts).toHaveLength(4);
  expect(queue.getSnapshot().drafts.filter(draft => draft.state === 'queued')).toHaveLength(2);
  expect(queue.getSnapshot().selectionError).toContain('4 tệp');
});

it('validates empty files, unsupported types and image size before the network', () => {
  const queue = makeQueue();
  queue.add([new File([], 'empty.txt'), file('script.svg'), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png')]);
  expect(attachmentApi.create).not.toHaveBeenCalled();
  expect(queue.getSnapshot().drafts).toHaveLength(0);
  expect(queue.getSnapshot().selectionError).toContain('5 MB');
});

it('only marks a file ready after the server confirms READY', async () => {
  const queue = makeQueue();
  queue.add([file()]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('ready'));
  expect(queue.getSnapshot().drafts[0].attachment).toEqual(ready);
  expect(attachmentApi.upload).toHaveBeenCalledTimes(1);
});

it('distinguishes rejected file structure from an expired upload', async () => {
  vi.mocked(attachmentApi.status).mockResolvedValue({ ...ready, state: 'REJECTED', errorCode: 'INVALID_CONTENT' });
  const queue = makeQueue();
  queue.add([file('workbook.xlsx')]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('error'));
  expect(queue.getSnapshot().drafts[0].error).toContain('cấu trúc');
  expect(queue.getSnapshot().drafts[0].error).not.toContain('hết hạn');
});

it.each([
  ['UPLOAD_EXPIRED', 'hết hạn'],
  ['UNSAFE_FILE', 'bộ quét'],
])('shows the specific server rejection reason %s', async (errorCode, expected) => {
  vi.mocked(attachmentApi.status).mockResolvedValue({ ...ready, state: 'REJECTED', errorCode });
  const queue = makeQueue();
  queue.add([file('workbook.xlsx')]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('error'));
  expect(queue.getSnapshot().drafts[0].error).toContain(expected);
});

it('keeps failed draft and reuses its intent when retrying a failed PUT', async () => {
  vi.mocked(attachmentApi.upload).mockRejectedValueOnce(new ApiError('Storage unavailable', 503)).mockResolvedValue(undefined);
  vi.mocked(attachmentApi.status).mockResolvedValueOnce({ ...ready, state: 'RESERVED' }).mockResolvedValue(ready);
  const queue = makeQueue();
  queue.add([file()]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('error'));
  queue.retry(queue.getSnapshot().drafts[0].id);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('ready'));
  expect(attachmentApi.create).toHaveBeenCalledTimes(1);
  expect(attachmentApi.upload).toHaveBeenCalledTimes(2);
});

it('aborts removed uploads, revokes preview URLs and cancels late intents', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof attachmentApi.create>>) => void;
  vi.mocked(attachmentApi.create).mockImplementation(() => new Promise(done => { resolve = done; }));
  const queue = makeQueue();
  queue.add([file('photo.png')]);
  const draft = queue.getSnapshot().drafts[0];
  const signal = vi.mocked(attachmentApi.create).mock.calls[0][3];
  queue.remove(draft.id);
  expect(signal.aborted).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  resolve({ publicId: 'late', state: 'RESERVED', sizeBytes: 5, uploadExpiresAt: '2099-01-01T00:00:00Z' });
  await vi.waitFor(() => expect(attachmentApi.cancel).toHaveBeenCalledWith('room', 'late'));
  expect(attachmentApi.upload).not.toHaveBeenCalled();
});

it('does not cancel linked files when clearing a successful send', async () => {
  const queue = makeQueue();
  queue.add([file()]);
  await vi.waitFor(() => expect(queue.getSnapshot().drafts[0].state).toBe('ready'));
  queue.clearSent();
  expect(queue.getSnapshot().drafts).toHaveLength(0);
  expect(attachmentApi.cancel).not.toHaveBeenCalled();
});

it('does not upload in a closed room', () => {
  const queue = makeQueue(false);
  queue.add([file()]);
  expect(attachmentApi.create).not.toHaveBeenCalled();
});

it('allows an attachment-only message and preserves ready files when sending fails', async () => {
  const send = vi.fn().mockResolvedValue(false);
  render(<ChatInputBar roomCode="room" roomStatus="ACTIVE" onSendMessage={send} />);
  fireEvent.change(screen.getByLabelText('Chọn ảnh hoặc tệp'), { target: { files: [file()] } });
  await waitFor(() => expect(screen.getByText('Sẵn sàng')).toBeTruthy());
  await act(async () => { fireEvent.click(screen.getByLabelText('Gửi tin nhắn')); });
  expect(send).toHaveBeenCalledWith('', undefined, [ready]);
  expect(screen.getByText('notes.txt')).toBeTruthy();
  expect(screen.getByText('Sẵn sàng')).toBeTruthy();
});

it('blocks sending text while selected files are still processing', async () => {
  vi.mocked(attachmentApi.status).mockImplementation(() => new Promise(() => {}));
  render(<ChatInputBar roomCode="room" roomStatus="ACTIVE" onSendMessage={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'With a file' } });
  fireEvent.change(screen.getByLabelText('Chọn ảnh hoặc tệp'), { target: { files: [file()] } });
  await waitFor(() => expect((screen.getByLabelText('Gửi tin nhắn') as HTMLButtonElement).disabled).toBe(true));
});
