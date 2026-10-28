export type RoomStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

export type SessionRole = 'HOST' | 'PARTICIPANT';

export interface RoomAuthResponse {
  slug: string;
  title: string;
  status: RoomStatus;
  guestId: string;
  nickname: string;
  role: SessionRole;
  sessionToken: string;
  hostToken: string | null;
  expiresAt: string;
}

export interface ParticipantResponse {
  guestId: string;
  nickname: string;
  role: SessionRole;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoomDetailResponse {
  joinLocked: boolean;
  slug: string;
  title: string;
  status: RoomStatus;
  settings: Record<string, unknown> | null;
  expiresAt: string;
  closedAt: string | null;
  createdAt: string;
  participants: ParticipantResponse[];
}

export type MessageType = 'TEXT' | 'SYSTEM' | 'POLL_NOTIF' | 'WHEEL_NOTIF' | 'DECISION_NOTIF';

export interface MessageResponse {
  id: string;
  clientMessageId: string;
  sequence: number;
  senderGuestId: string | null;
  senderNickname: string;
  messageType: MessageType;
  body: string;
  replyToId: string | null;
  metadata?: { event?: string; guestId?: string; nickname?: string } | null;
  createdAt: string;
}

export interface PollOptionResponse {
  id: number;
  label: string;
  voteCount: number;
  displayOrder: number;
}

export interface PollResponse {
  id: number;
  question: string;
  status: 'OPEN' | 'CLOSED';
  allowMultiple: boolean;
  votedOptionIds?: number[];
  createdAt: string;
  closedAt: string | null;
  options: PollOptionResponse[];
}

export type DecisionStatus = 'DRAFT' | 'PROPOSED' | 'CONFIRMED';

export interface DecisionResponse {
  id: number;
  creatorNickname: string | null;
  text: string;
  status: DecisionStatus;
  evidenceRefs: string[];
  approveCount: number;
  rejectCount: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface WheelSpinResponse {
  id: number;
  wheelId: number;
  actorNickname: string;
  idempotencyKey: string;
  resultEntry: string;
  entriesSnapshot: string[];
  createdAt: string;
}

export interface WheelResponse {
  id: number;
  title: string;
  entries: string[];
  excludeWinner: boolean;
  createdAt: string;
  spins: WheelSpinResponse[];
}

export interface RoomExportResponse {
  roomSlug: string;
  roomTitle: string;
  roomStatus: RoomStatus;
  participantCount: number;
  confirmedDecisions: DecisionResponse[];
  polls: PollResponse[];
  wheels: WheelResponse[];
  markdownSummary: string;
  exportedAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
