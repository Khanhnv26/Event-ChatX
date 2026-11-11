import { beforeEach, expect, it, vi } from 'vitest';
import type { StompConfig } from '@stomp/stompjs';
import { StompClientService } from '../src/services/stompClient';

const state = vi.hoisted(() => ({ clients: [] as {
  config: StompConfig;
  subscribe: ReturnType<typeof vi.fn>;
  forceDisconnect: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
}[] }));
vi.mock('sockjs-client', () => ({ default: vi.fn() }));
vi.mock('@stomp/stompjs', () => ({ TickerStrategy: { Worker: 'worker' }, Client: class {
  connected = false;
  subscribe = vi.fn();
  activate = vi.fn();
  deactivate = vi.fn().mockResolvedValue(undefined);
  forceDisconnect = vi.fn();
  constructor(public config: StompConfig) { state.clients.push(this); }
} }));
beforeEach(() => { state.clients.length = 0; sessionStorage.setItem('eventchat_session_token', 'token'); });

it('subscribes to live topics before starting catchup requests', () => {
  const service = new StompClientService();
  const onConnect = vi.fn(() => expect(state.clients[0].subscribe).toHaveBeenCalledTimes(6));
  service.connect('room', { onConnect });
  state.clients[0].config.onConnect?.({} as never);
  expect(onConnect).toHaveBeenCalledOnce();
});

it('keeps reconnecting after a broker error while the room session is valid', async () => {
  const service = new StompClientService();
  const onAccessDenied = vi.fn();
  const onConnect = vi.fn();
  const isAccessDenied = vi.fn().mockResolvedValue(false);
  service.connect('room', { onAccessDenied, isAccessDenied, onConnect });
  const client = state.clients[0];

  client.config.onStompError?.({ headers: { message: 'Broker disconnected' } } as never);
  await Promise.resolve();

  expect(onAccessDenied).not.toHaveBeenCalled();
  expect(client.deactivate).not.toHaveBeenCalled();
  expect(client.forceDisconnect).toHaveBeenCalledOnce();
  client.config.onConnect?.({} as never);
  expect(client.subscribe).toHaveBeenCalledTimes(6);
  expect(onConnect).toHaveBeenCalledOnce();
});

it('ignores an access check from before a successful reconnect', async () => {
  const service = new StompClientService();
  const onAccessDenied = vi.fn();
  let resolveCheck!: (denied: boolean) => void;
  const check = new Promise<boolean>(resolve => { resolveCheck = resolve; });
  service.connect('room', { onAccessDenied, isAccessDenied: () => check });
  const client = state.clients[0];

  client.config.onStompError?.({} as never);
  client.config.onConnect?.({} as never);
  resolveCheck(true);
  await check;

  expect(onAccessDenied).not.toHaveBeenCalled();
  expect(client.deactivate).not.toHaveBeenCalled();
});

it('stops reconnecting when the room access check confirms the session was revoked', async () => {
  const service = new StompClientService();
  const onAccessDenied = vi.fn();
  const isAccessDenied = vi.fn().mockResolvedValue(true);
  service.connect('room', { onAccessDenied, isAccessDenied });
  const client = state.clients[0];

  client.config.onStompError?.({} as never);
  await Promise.resolve();

  expect(isAccessDenied).toHaveBeenCalledOnce();
  expect(onAccessDenied).toHaveBeenCalledOnce();
  expect(client.deactivate).toHaveBeenCalledOnce();
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
