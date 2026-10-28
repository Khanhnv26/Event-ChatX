import { beforeEach, expect, it, vi } from 'vitest';
import { eventChatApi } from '../src/services/eventChatApi';
import { apiClient } from '../src/services/api.client';

vi.mock('../src/services/api.client', () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: { data: { slug: 'room' } } }); });

it('sends the selected number of minutes without a legacy hours field', async () => {
  await eventChatApi.createRoom('Topic', 'Host', 5);
  expect(apiClient.post).toHaveBeenCalledWith('/rooms', { title: 'Topic', hostNickname: 'Host', ttlMinutes: 5 });
});

it('defaults the frontend request to 24 hours expressed in minutes', async () => {
  await eventChatApi.createRoom('Topic', 'Host');
  expect(apiClient.post).toHaveBeenCalledWith('/rooms', { title: 'Topic', hostNickname: 'Host', ttlMinutes: 1440 });
});

it.each([true, false])('updates join lock using PATCH and the backend field for %s', async locked => {
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { success: true } });
  await eventChatApi.updateJoinLock('room', locked);
  expect(apiClient.patch).toHaveBeenLastCalledWith('/rooms/room/join-lock', { joinLocked: locked });
});

it('posts the room-scoped kick endpoint', async () => {
  await eventChatApi.kickParticipant('room', 'guest-id');
  expect(apiClient.post).toHaveBeenLastCalledWith('/rooms/room/participants/guest-id/kick');
});
