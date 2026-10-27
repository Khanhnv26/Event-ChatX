import axios from 'axios';
import { toast } from '../stores/toastStore';

export class ApiError extends Error {
  status?: number;
  retryAfterSeconds?: number;

  constructor(message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipToast?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const sessionToken = sessionStorage.getItem('eventchat_session_token');
  const hostToken = sessionStorage.getItem('eventchat_host_token');

  if (sessionToken) {
    config.headers['X-Session-Token'] = sessionToken;
  }
  if (hostToken) {
    config.headers['X-Host-Token'] = hostToken;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const rawRetry = error.response?.headers?.['retry-after'];
    const parsedRetry = typeof rawRetry === 'string' && /^\d+$/.test(rawRetry) ? Number(rawRetry) : undefined;
    const retryAfterSeconds = parsedRetry !== undefined && Number.isSafeInteger(parsedRetry) && parsedRetry > 0
      ? parsedRetry : undefined;
    const baseMessage = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ';
    const message = status === 429 && retryAfterSeconds
      ? `${baseMessage} Thử lại sau ${retryAfterSeconds} giây.` : baseMessage;
    const skipToast = (error.config as { skipToast?: boolean } | undefined)?.skipToast;
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
    const isServerError = error.response?.status >= 500;

    if (!skipToast && (isNetworkError || isServerError)) {
      toast.error(message, {
        description: isNetworkError ? 'Vui lòng kiểm tra lại kết nối mạng' : undefined,
      });
    }

    return Promise.reject(new ApiError(message, status, retryAfterSeconds));
  }
);
