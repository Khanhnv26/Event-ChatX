export type RoomStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

export type UserRole = 'HOST' | 'PARTICIPANT';

export interface Participant {
  id: string;
  nickname: string;
  role: UserRole;
  isOnline: boolean;
  avatarColor: string;
}

export interface PollOption {
  rankingScore?: number;
  ratingValue?: number;
  id: string;
  text: string;
  votes: number;
  votedByMe?: boolean;
}

export interface Poll {
  type?: import('./backend.types').PollType;
  votedOptionIds?: string[];
  revision?: number;
  ownVotesRevision?: number;
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  isClosed: boolean;
  createdBy: string;
  allowMultiple?: boolean;
}

export type DecisionStatus = 'DRAFT' | 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'DELETED' | 'WITHDRAWN';

export interface DecisionCard {
  sourceSpinId?: number;
  sourcePollId?: number;
  creatorGuestId?: string;
  creatorNickname?: string;
  id: string;
  title: string;
  details?: string;
  status: DecisionStatus;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByGuestId?: string;
  approveCount?: number;
  rejectCount?: number;
  evidenceType: 'POLL' | 'WHEEL' | 'CONSENSUS';
  evidenceRef?: string;
}

export interface DecisionDraft {
  title: string;
  details: string;
  sourcePollId?: number;
}

export interface ChatMessage {
  threadRootId?: string | null;
  threadReplyCount?: number;
  attachments?: import('./backend.types').AttachmentResponse[];
  replyToId?: string | null;
  id: string;
  clientMessageId?: string;
  sequence?: number;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  avatarColor: string;
  content: string;
  createdAt: string;
  type?: import('./backend.types').MessageType;
  aiSummary?: import('./backend.types').AiSummary;
  aiDemo?: boolean;
  interactiveRefId?: string;
  isMe?: boolean;
}

export interface MessageInteractionControls {
  reactions?: Partial<Record<string, import('./backend.types').ReactionResponse[]>>;
  pinnedMessageId?: string;
  onReaction?: (messageId: string, emoji: import('./backend.types').ReactionEmoji, active: boolean) => Promise<void>;
  onPin?: (messageId: string | null) => Promise<void>;
}

export interface AiActivity {
  requestId: string;
  threadRootId: string | null;
  error?: string;
}

export interface WheelItem {
  id: string;
  label: string;
  color: string;
}
