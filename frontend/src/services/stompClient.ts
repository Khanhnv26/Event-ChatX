import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  MessageResponse,
  PollResponse,
  DecisionResponse,
  WheelResponse,
  WheelSpinResponse,
} from '../types/backend.types';

export interface RoomSubscriptions {
  onRoomEvent?: (event: { type: string; guestId?: string }) => void;
  onAccessDenied?: () => void;
  onMessage?: (msg: MessageResponse) => void;
  onPoll?: (poll: PollResponse) => void;
  onDecision?: (decision: DecisionResponse) => void;
  onWheel?: (wheel: WheelResponse) => void;
  onWheelSpin?: (spin: WheelSpinResponse) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class StompClientService {
  private client: Client | null = null;
  private currentSlug: string | null = null;

  connect(slug: string, callbacks: RoomSubscriptions, sessionToken?: string): void {
    const token = sessionToken ?? sessionStorage.getItem('eventchat_session_token');
    if (!token) { callbacks.onAccessDenied?.(); return; }
    if (this.client && this.currentSlug === slug && this.client.connected) {
      return;
    }

    this.disconnect();
    this.currentSlug = slug;

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders: { 'X-Room-Slug': slug, 'X-Session-Token': token },
      onStompError: () => {
        if (this.client !== client) return;
        this.disconnect();
        callbacks.onAccessDenied?.();
      },
      onConnect: () => {
        if (this.client !== client) return;
        client.subscribe(`/topic/room.${slug}.messages`, (frame) => {
          try {
            const data: MessageResponse = JSON.parse(frame.body);
            callbacks.onMessage?.(data);
          } catch (e) {
            console.error('Error parsing STOMP message', e);
          }
        });

        client.subscribe(`/topic/room.${slug}.decisions`, (frame) => {
          try {
            const data: DecisionResponse = JSON.parse(frame.body);
            callbacks.onDecision?.(data);
          } catch (e) {
            console.error('Error parsing STOMP decision', e);
          }
        });

        client.subscribe(`/topic/room.${slug}.polls`, (frame) => {
          try {
            const data: PollResponse = JSON.parse(frame.body);
            callbacks.onPoll?.(data);
          } catch (e) {
            console.error('Error parsing STOMP poll', e);
          }
        });

        client.subscribe(`/topic/room.${slug}.wheels`, (frame) => {
          try {
            const data: WheelResponse = JSON.parse(frame.body);
            callbacks.onWheel?.(data);
          } catch (e) {
            console.error('Error parsing STOMP wheel', e);
          }
        });

        client.subscribe(`/topic/room.${slug}.wheels.*.spins`, (frame) => {
          try {
            const data: WheelSpinResponse = JSON.parse(frame.body);
            callbacks.onWheelSpin?.(data);
          } catch (e) {
            console.error('Error parsing STOMP wheel spin', e);
          }
        });
        client.subscribe(`/topic/room.${slug}.events`, frame => {
          if (this.client !== client) return;
          try { callbacks.onRoomEvent?.(JSON.parse(frame.body)); }
          catch { /* Ignore malformed notifications; REST remains authoritative. */ }
        });
        callbacks.onConnect?.();
      },
      onDisconnect: () => {
        if (this.client === client) callbacks.onDisconnect?.();
      },
      onWebSocketClose: () => { if (this.client === client) callbacks.onDisconnect?.(); },
    });

    this.client = client;
    client.activate();
  }

  disconnect(): void {
    if (this.client) {
      try {
        void this.client.deactivate().catch(() => {});
      } catch {
      }
      this.client = null;
      this.currentSlug = null;
    }
  }
}

export const stompClient = new StompClientService();
