import axios from 'axios';
import { toast } from '../stores/toastStore';

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
    const message = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ';
    const skipToast = (error.config as { skipToast?: boolean } | undefined)?.skipToast;
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
    const isServerError = error.response?.status >= 500;

    if (!skipToast && (isNetworkError || isServerError)) {
      toast.error(message, {
        description: isNetworkError ? 'Vui lòng kiểm tra lại kết nối mạng' : undefined,
      });
    }

    return Promise.reject(new Error(message));
  }
);
