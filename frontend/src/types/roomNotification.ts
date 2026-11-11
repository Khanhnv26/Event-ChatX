export interface RoomNotification {
  id: string;
  kind: 'message' | 'thread' | 'poll' | 'pin' | 'decision' | 'mention';
  targetId: string;
  threadRootId?: string;
  sequence?: number;
  title: string;
  detail: string;
  receivedAt: number;
  read: boolean;
}

export type NewRoomNotification = Omit<RoomNotification, 'receivedAt' | 'read'>;
