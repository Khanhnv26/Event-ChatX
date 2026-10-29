import { apiClient } from './api.client';
import type { ApiResponse, AttachmentResponse, UploadIntentResponse } from '../types/backend.types';

export const ATTACHMENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv',
};

export function attachmentType(file: File): string | undefined {
  return ATTACHMENT_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const path = (slug: string, id?: string) => `/rooms/${encodeURIComponent(slug)}/attachments${id ? `/${encodeURIComponent(id)}` : ''}`;

export const attachmentApi = {
  async create(slug: string, file: File, clientUploadId: string, signal: AbortSignal): Promise<UploadIntentResponse> {
    const response = await apiClient.post<ApiResponse<UploadIntentResponse>>(path(slug), {
      clientUploadId, filename: file.name, declaredContentType: attachmentType(file), sizeBytes: file.size,
    }, { signal, skipToast: true });
    return response.data.data;
  },
  async upload(slug: string, id: string, file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
    await apiClient.put(`${path(slug, id)}/content`, file, {
      signal, skipToast: true, headers: { 'Content-Type': 'application/octet-stream' },
      onUploadProgress: event => onProgress(Math.min(99, Math.round(100 * event.loaded / (event.total || file.size)))),
    });
  },
  async status(slug: string, id: string, signal: AbortSignal): Promise<AttachmentResponse> {
    const response = await apiClient.get<ApiResponse<AttachmentResponse>>(path(slug, id), { signal, skipToast: true });
    return response.data.data;
  },
  async cancel(slug: string, id: string): Promise<void> {
    await apiClient.delete(path(slug, id), { skipToast: true });
  },
  async content(slug: string, id: string, thumbnail: boolean, signal?: AbortSignal): Promise<Blob> {
    const response = await apiClient.get<Blob>(`${path(slug, id)}/${thumbnail ? 'thumbnail' : 'content'}`, {
      signal, responseType: 'blob', skipToast: true,
    });
    return response.data;
  },
  async download(slug: string, attachment: AttachmentResponse): Promise<void> {
    const blob = await this.content(slug, attachment.publicId, false);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
