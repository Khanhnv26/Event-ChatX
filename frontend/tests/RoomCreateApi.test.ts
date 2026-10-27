import { beforeEach, expect, it, vi } from 'vitest';
import { eventChatApi } from '../src/services/eventChatApi';
import { apiClient } from '../src/services/api.client';

vi.mock('../src/services/api.client', () => ({ apiClient: { post: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: { data: { slug: 'room' } } }); });

it('sends the selected number of minutes without a legacy hours field', async () => {
  await eventChatApi.createRoom('Topic', 'Host', 5);
  expect(apiClient.post).toHaveBeenCalledWith('/rooms', { title: 'Topic', hostNickname: 'Host', ttlMinutes: 5 });
});

it('defaults the frontend request to 24 hours expressed in minutes', async () => {
  await eventChatApi.createRoom('Topic', 'Host');
  expect(apiClient.post).toHaveBeenCalledWith('/rooms', { title: 'Topic', hostNickname: 'Host', ttlMinutes: 1440 });
});
