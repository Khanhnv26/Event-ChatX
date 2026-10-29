import { attachmentApi, attachmentType } from './attachmentApi';
import { ApiError } from './api.client';
import type { AttachmentResponse } from '../types/backend.types';

export interface AttachmentDraft {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  state: 'queued' | 'uploading' | 'processing' | 'ready' | 'error';
  error?: string;
  attachment?: AttachmentResponse;
}

interface UploadTask extends AttachmentDraft {
  clientUploadId: string;
  publicId?: string;
  controller?: AbortController;
}

function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Upload cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1500);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

// The queue owns network work and object URLs; React subscribes to immutable snapshots.
export class AttachmentUploadQueue {
  private tasks = new Map<string, UploadTask>();
  private active = new Set<string>();
  private listeners = new Set<() => void>();
  private disposed = false;
  private snapshot: { drafts: AttachmentDraft[]; selectionError: string | null } = { drafts: [], selectionError: null };

  private slug: string | undefined;
  private enabled: boolean;

  constructor(slug: string | undefined, enabled: boolean) {
    this.slug = slug;
    this.enabled = enabled;
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  resume = () => { this.disposed = false; };

  private publish(selectionError = this.snapshot.selectionError) {
    this.snapshot = { drafts: Array.from(this.tasks.values(), task => ({ ...task })), selectionError };
    this.listeners.forEach(listener => listener());
  }

  add = (files: File[]) => {
    if (!this.enabled || !this.slug || this.disposed) return;
    let error: string | null = null;
    for (const file of files) {
      if (this.tasks.size >= 4) { error = 'Mỗi tin nhắn đính kèm tối đa 4 tệp.'; break; }
      const contentType = attachmentType(file);
      if (!contentType) { error = 'Hỗ trợ JPG, PNG, PDF, DOCX, XLSX, PPTX, TXT và CSV.'; continue; }
      const maxBytes = contentType.startsWith('image/') ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
      if (!file.size || file.size > maxBytes) { error = `${file.name}: ${file.size ? `giới hạn ${maxBytes / 1024 / 1024} MB` : 'tệp đang trống'}.`; continue; }
      if (Array.from(this.tasks.values()).some(task => task.file.name === file.name && task.file.size === file.size && task.file.lastModified === file.lastModified)) continue;
      const id = crypto.randomUUID();
      this.tasks.set(id, { id, file, clientUploadId: crypto.randomUUID(), progress: 0, state: 'queued',
        previewUrl: contentType.startsWith('image/') ? URL.createObjectURL(file) : undefined });
    }
    this.publish(error);
    this.pump();
  };

  remove = (id: string) => {
    const task = this.tasks.get(id);
    if (!task) return;
    task.controller?.abort();
    this.tasks.delete(id);
    this.active.delete(id);
    if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
    if (this.slug && task.publicId) void attachmentApi.cancel(this.slug, task.publicId).catch(() => {});
    this.publish();
    this.pump();
  };

  retry = (id: string) => {
    const task = this.tasks.get(id);
    if (task?.state === 'error') { task.state = 'queued'; this.publish(); this.pump(); }
  };

  clearSent = () => { this.dispose(false); this.resume(); };

  dispose = (cancelRemote = true) => {
    this.disposed = true;
    for (const task of this.tasks.values()) {
      task.controller?.abort();
      if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
      if (cancelRemote && this.slug && task.publicId) void attachmentApi.cancel(this.slug, task.publicId).catch(() => {});
    }
    this.tasks.clear();
    this.active.clear();
    this.publish(null);
  };

  private pump() {
    if (this.disposed || !this.enabled || !this.slug) return;
    for (const task of this.tasks.values()) {
      if (this.active.size >= 2) break;
      if (task.state !== 'queued') continue;
      const controller = new AbortController();
      task.controller = controller;
      task.state = 'uploading';
      task.error = undefined;
      this.active.add(task.id);
      this.publish();
      void this.run(task, controller, this.slug);
    }
  }

  private async run(task: UploadTask, controller: AbortController, scope: string) {
    const current = () => !this.disposed && this.tasks.get(task.id) === task && !controller.signal.aborted;
    try {
      let status: AttachmentResponse | undefined;
      if (task.publicId) status = await attachmentApi.status(scope, task.publicId, controller.signal);
      if (!current()) return;
      if (!task.publicId) {
        const intent = await attachmentApi.create(scope, task.file, task.clientUploadId, controller.signal);
        task.publicId = intent.publicId;
        if (!current()) { void attachmentApi.cancel(scope, intent.publicId).catch(() => {}); return; }
      }
      if (!status || status.state === 'RESERVED') {
        await attachmentApi.upload(scope, task.publicId, task.file, controller.signal, percent => {
          if (current()) { task.progress = percent; this.publish(); }
        });
      }
      if (!current()) return;
      task.state = 'processing';
      task.progress = 100;
      this.publish();
      for (let attempt = 0; attempt < 60; attempt++) {
        status = await attachmentApi.status(scope, task.publicId, controller.signal);
        if (!current()) return;
        if (status.state === 'READY') {
          task.state = 'ready'; task.error = undefined; task.attachment = status; this.publish(); return;
        }
        if (['REJECTED', 'EXPIRED', 'DELETING'].includes(status.state)) {
          throw new Error(status.errorCode === 'UNSAFE_FILE' ? 'Tệp không an toàn và đã bị từ chối.' : 'Tệp không hợp lệ hoặc đã hết hạn. Hãy bỏ tệp và chọn lại.');
        }
        if (status.errorCode === 'PROCESSING_UNAVAILABLE') {
          task.error = 'Máy chủ đang chờ bộ kiểm tra tệp. Bạn có thể tiếp tục soạn tin.'; this.publish();
        }
        await delay(controller.signal);
      }
      throw new Error('Tệp đang xử lý lâu hơn dự kiến. Bấm thử lại để kiểm tra tiếp.');
    } catch (error) {
      if (!current()) return;
      task.state = 'error';
      task.error = error instanceof Error ? error.message : 'Không thể tải tệp lên.';
      if (error instanceof ApiError && (error.status === 403 || error.status === 409)) {
        task.publicId = undefined; task.clientUploadId = crypto.randomUUID();
      }
      this.publish();
    } finally {
      if (this.tasks.get(task.id) === task) { this.active.delete(task.id); this.publish(); this.pump(); }
    }
  }
}
