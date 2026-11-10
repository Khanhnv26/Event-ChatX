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
  maxParticipants: number;
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

export type MessageType = 'TEXT' | 'AI_BOT' | 'SYSTEM' | 'POLL_NOTIF' | 'WHEEL_NOTIF' | 'DECISION_NOTIF';

export interface AiSummarySource {
  id: string;
  number: number;
  speaker: string;
  excerpt: string;
}

export interface AiSummaryItem {
  text: string;
  sources: AiSummarySource[];
}

export interface AiSummary {
  decided: AiSummaryItem[];
  open: AiSummaryItem[];
  next: AiSummaryItem[];
  contextCount: number;
  demo: boolean;
}

export interface MessageResponse {
  threadRootId?: string | null;
  threadReplyCount?: number;
  attachments?: AttachmentResponse[];
  id: string;
  clientMessageId: string;
  sequence: number;
  senderGuestId: string | null;
  senderNickname: string;
  messageType: MessageType;
  body: string;
  replyToId: string | null;
  metadata?: { event?: string; guestId?: string; nickname?: string; aiSummary?: AiSummary; aiDemo?: boolean } | null;
  createdAt: string;
}

export type ReactionEmoji = 'HEART' | 'THUMBS_UP' | 'LAUGH' | 'CLAP' | 'RAISED_HAND';

export interface ReactionResponse {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
}

export interface MessageInteractionsResponse {
  pinnedMessage: MessageResponse | null;
  reactions: Partial<Record<string, ReactionResponse[]>>;
}

export interface ThreadResponse {
  rootMessage: MessageResponse;
  messages: MessageResponse[];
  nextSequence: number;
  hasMore: boolean;
}

export interface ThreadSummaryResponse {
  rootMessage: MessageResponse;
  replyCount: number;
  lastActivitySequence: number;
  lastActivityAt: string | null;
  lastReplySnippet: string | null;
}

export interface ThreadListResponse {
  threads: ThreadSummaryResponse[];
  nextActivitySequence: number | null;
  hasMore: boolean;
}

export type AttachmentState = 'RESERVED' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'LINKING' | 'LINKED' | 'REJECTED' | 'EXPIRED' | 'DELETING';

export interface UploadIntentResponse {
  publicId: string;
  state: AttachmentState;
  sizeBytes: number;
  uploadExpiresAt: string;
}

export interface AttachmentResponse {
  publicId: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  state: AttachmentState;
  width?: number | null;
  height?: number | null;
  hasThumbnail: boolean;
  errorCode?: string | null;
  expiresAt: string;
}

export interface PollOptionResponse {
  rankingScore?: number;
  id: number;
  label: string;
  voteCount: number;
  displayOrder: number;
}

export type PollType = 'SINGLE' | 'MULTIPLE' | 'RATING' | 'RANKING';

export interface PollResponse {
  type?: PollType;
  revision?: number;
  id: number;
  question: string;
  status: 'OPEN' | 'CLOSED';
  allowMultiple: boolean;
  votedOptionIds?: number[];
  createdAt: string;
  closedAt: string | null;
  options: PollOptionResponse[];
}

export type DecisionStatus = 'DRAFT' | 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'DELETED' | 'WITHDRAWN';

export interface DecisionResponse {
  confirmedByGuestId?: string | null;
  confirmedByNickname?: string | null;
  creatorGuestId?: string;
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
