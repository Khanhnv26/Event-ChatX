import axios from 'axios';

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
    return Promise.reject(new Error(message));
  }
);
