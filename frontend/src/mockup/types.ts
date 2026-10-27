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
  id: string;
  text: string;
  votes: number;
  votedByMe?: boolean;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  isClosed: boolean;
  createdBy: string;
}

export type DecisionStatus = 'DRAFT' | 'PROPOSED' | 'CONFIRMED';

export interface DecisionCard {
  id: string;
  title: string;
  details?: string;
  status: DecisionStatus;
  confirmedAt?: string;
  confirmedBy: string;
  evidenceType: 'POLL' | 'WHEEL' | 'CONSENSUS';
  evidenceRef?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  avatarColor: string;
  content: string;
  createdAt: string;
  type?: 'TEXT' | 'POLL_NOTIF' | 'WHEEL_NOTIF' | 'DECISION_NOTIF' | 'SYSTEM';
  interactiveRefId?: string;
  isMe?: boolean;
}

export interface WheelItem {
  id: string;
  label: string;
  color: string;
}
