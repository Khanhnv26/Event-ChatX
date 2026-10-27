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

  connect(slug: string, callbacks: RoomSubscriptions): void {
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
      onConnect: () => {
        if (this.client !== client) return;
        // 1. Messages Topic
        client.subscribe(`/topic/room.${slug}.messages`, (frame) => {
          try {
            const data: MessageResponse = JSON.parse(frame.body);
            callbacks.onMessage?.(data);
          } catch (e) {
            console.error('Error parsing STOMP message', e);
          }
        });

        // 2. Decisions Topic
        client.subscribe(`/topic/room.${slug}.decisions`, (frame) => {
          try {
            const data: DecisionResponse = JSON.parse(frame.body);
            callbacks.onDecision?.(data);
          } catch (e) {
            console.error('Error parsing STOMP decision', e);
          }
        });

        // 3. Polls Topic
        client.subscribe(`/topic/room.${slug}.polls`, (frame) => {
          try {
            const data: PollResponse = JSON.parse(frame.body);
            callbacks.onPoll?.(data);
          } catch (e) {
            console.error('Error parsing STOMP poll', e);
          }
        });

        // 4. Wheels Topic
        client.subscribe(`/topic/room.${slug}.wheels`, (frame) => {
          try {
            const data: WheelResponse = JSON.parse(frame.body);
            callbacks.onWheel?.(data);
          } catch (e) {
            console.error('Error parsing STOMP wheel', e);
          }
        });

        // 5. Wheel Spins (wildcard matching)
        client.subscribe(`/topic/room.${slug}.wheels.*.spins`, (frame) => {
          try {
            const data: WheelSpinResponse = JSON.parse(frame.body);
            callbacks.onWheelSpin?.(data);
          } catch (e) {
            console.error('Error parsing STOMP wheel spin', e);
          }
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
