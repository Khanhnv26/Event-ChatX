import { afterEach, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient, ApiError } from '../src/services/api.client';

afterEach(() => { sessionStorage.clear(); });

it('preserves 429 status and displays the server retry time', async () => {
  const request = apiClient.post('/rooms/room/messages', { body: 'Keep my draft' }, {
    adapter: async config => {
      throw new AxiosError('Request failed', undefined, config, undefined, {
        data: { message: 'Bạn thao tác quá nhanh.' }, status: 429, statusText: 'Too Many Requests',
        headers: new AxiosHeaders({ 'retry-after': '2' }), config,
      });
    },
  });
  await expect(request).rejects.toMatchObject({
    name: 'ApiError', status: 429, retryAfterSeconds: 2,
    message: 'Bạn thao tác quá nhanh. Thử lại sau 2 giây.',
  });
});

it('does not trust malformed Retry-After values', async () => {
  await expect(apiClient.post('/rooms', {}, {
    adapter: async config => {
      throw new AxiosError('Request failed', undefined, config, undefined, {
        data: { message: 'Thử lại sau.' }, status: 429, statusText: 'Too Many Requests',
        headers: new AxiosHeaders({ 'retry-after': 'NaN' }), config,
      });
    },
  })).rejects.toMatchObject({ status: 429, retryAfterSeconds: undefined, message: 'Thử lại sau.' });
});

it('ApiError stays compatible with existing Error handling', () => {
  expect(new ApiError('limited', 429, 2)).toBeInstanceOf(Error);
});
