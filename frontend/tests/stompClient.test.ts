import { beforeEach, expect, it, vi } from 'vitest';
import type { StompConfig } from '@stomp/stompjs';
import { StompClientService } from '../src/services/stompClient';

const state = vi.hoisted(() => ({ clients: [] as { config: StompConfig; subscribe: ReturnType<typeof vi.fn> }[] }));
vi.mock('sockjs-client', () => ({ default: vi.fn() }));
vi.mock('@stomp/stompjs', () => ({ Client: class {
  connected = false;
  subscribe = vi.fn();
  activate = vi.fn();
  deactivate = vi.fn().mockResolvedValue(undefined);
  constructor(public config: StompConfig) { state.clients.push(this); }
} }));
beforeEach(() => { state.clients.length = 0; });

it('subscribes to live topics before starting catchup requests', () => {
  const service = new StompClientService();
  const onConnect = vi.fn(() => expect(state.clients[0].subscribe).toHaveBeenCalledTimes(5));
  service.connect('room', { onConnect });
  state.clients[0].config.onConnect?.({} as never);
  expect(onConnect).toHaveBeenCalledOnce();
});

it('ignores delayed connection callbacks for a room that was left', () => {
  const service = new StompClientService();
  const onConnect = vi.fn();
  service.connect('old-room', { onConnect });
  service.connect('new-room', {});
  state.clients[0].config.onConnect?.({} as never);
  expect(onConnect).not.toHaveBeenCalled();
  expect(state.clients[1].subscribe).not.toHaveBeenCalled();
});
