import type { Participant, Poll, DecisionCard, ChatMessage, WheelItem } from './types';

export const INITIAL_PARTICIPANTS: Participant[] = [
  { id: 'u1', nickname: 'Minh (Host)', role: 'HOST', isOnline: true, avatarColor: '#6366F1' },
  { id: 'u2', nickname: 'Lan Anh', role: 'PARTICIPANT', isOnline: true, avatarColor: '#EC4899' },
  { id: 'u3', nickname: 'Tuấn Dev', role: 'PARTICIPANT', isOnline: true, avatarColor: '#10B981' },
  { id: 'u4', nickname: 'Hoàng Designer', role: 'PARTICIPANT', isOnline: true, avatarColor: '#F59E0B' },
  { id: 'u5', nickname: 'Mai Phương', role: 'PARTICIPANT', isOnline: false, avatarColor: '#8B5CF6' },
];

export const INITIAL_POLL: Poll = {
  id: 'poll-1',
  question: 'Cuối tuần này team mình đi ăn gì để chốt đồ án?',
  totalVotes: 4,
  isClosed: false,
  createdBy: 'Minh (Host)',
  options: [
    { id: 'opt-1', text: 'Lẩu Haidilao Landmark 81', votes: 2, votedByMe: true },
    { id: 'opt-2', text: 'Nướng BBQ Hàn Quốc Gogi', votes: 1, votedByMe: false },
    { id: 'opt-3', text: 'Buffet Hải Sản D’Maris', votes: 1, votedByMe: false },
    { id: 'opt-4', text: 'Ăn chay thanh tịnh', votes: 0, votedByMe: false },
  ],
};

export const INITIAL_WHEEL_ITEMS: WheelItem[] = [
  { id: 'w1', label: 'Tuấn Dev', color: '#6366F1' },
  { id: 'w2', label: 'Lan Anh', color: '#EC4899' },
  { id: 'w3', label: 'Hoàng Design', color: '#10B981' },
  { id: 'w4', label: 'Minh (Host)', color: '#F59E0B' },
  { id: 'w5', label: 'Mai Phương', color: '#8B5CF6' },
  { id: 'w6', label: 'Quỹ Team trả!', color: '#EF4444' },
];

export const INITIAL_DECISIONS: DecisionCard[] = [
  {
    id: 'dec-1',
    title: 'Địa điểm: Lẩu Haidilao Landmark 81',
    details: 'Đã thống nhất theo kết quả bình chọn (50% tán thành). Đặt bàn lúc 18h30 thứ Bảy.',
    status: 'CONFIRMED',
    confirmedAt: '17:15',
    confirmedBy: 'Minh (Host)',
    evidenceType: 'POLL',
    evidenceRef: 'Bình chọn món ăn cuối tuần',
  },
  {
    id: 'dec-2',
    title: 'Người đặt cọc giữ bàn: Tuấn Dev',
    details: 'Được lựa chọn ngẫu nhiên minh bạch qua Vòng quay may mắn.',
    status: 'CONFIRMED',
    confirmedAt: '17:22',
    confirmedBy: 'Hệ thống EventChat',
    evidenceType: 'WHEEL',
    evidenceRef: 'Vòng quay tìm thủ quỹ tạm thời',
  },
  {
    id: 'dec-3',
    title: 'Ngân sách tối đa: 350k / người',
    details: 'Bao gồm nước uống và tráng miệng. Phần vượt quỹ team bù.',
    status: 'PROPOSED',
    confirmedBy: 'Lan Anh',
    evidenceType: 'CONSENSUS',
  },
];

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    senderId: 'u1',
    senderName: 'Minh (Host)',
    senderRole: 'HOST',
    avatarColor: '#6366F1',
    content: 'Chào cả team! Mình tạo phòng EventChat này để chốt nhanh kế hoạch thứ Bảy nhé. 15 phút là xong!',
    createdAt: '17:05',
    type: 'TEXT',
  },
  {
    id: 'm2',
    senderId: 'u2',
    senderName: 'Lan Anh',
    senderRole: 'PARTICIPANT',
    avatarColor: '#EC4899',
    content: 'Hay quá, không cần add friend Zalo hay tạo thêm group rác nữa rồi 🥳',
    createdAt: '17:07',
    type: 'TEXT',
  },
  {
    id: 'm3',
    senderId: 'u1',
    senderName: 'Minh (Host)',
    senderRole: 'HOST',
    avatarColor: '#6366F1',
    content: 'Mình vừa mở bình chọn địa điểm ăn uống, mọi người bấm vote ngay bên dưới hoặc nhìn bảng bên phải nhé!',
    createdAt: '17:09',
    type: 'POLL_NOTIF',
    interactiveRefId: 'poll-1',
  },
  {
    id: 'm4',
    senderId: 'current-user',
    senderName: 'Bạn',
    senderRole: 'PARTICIPANT',
    avatarColor: '#10B981',
    content: 'Đã vote Haidilao! Thèm trà sữa và múa mì quá 🍲',
    createdAt: '17:11',
    type: 'TEXT',
  },
  {
    id: 'm5',
    senderId: 'u1',
    senderName: 'Minh (Host)',
    senderRole: 'HOST',
    avatarColor: '#6366F1',
    content: 'Đã chốt quyết định #1: Haidilao Landmark 81! Giờ mình quay vòng quay xem ai đặt bàn trước nhé.',
    createdAt: '17:16',
    type: 'DECISION_NOTIF',
    interactiveRefId: 'dec-1',
  },
  {
    id: 'm6',
    senderId: 'u4',
    senderName: 'Hoàng Designer',
    senderRole: 'PARTICIPANT',
    avatarColor: '#F59E0B',
    content: 'Haha run quá, hy vọng không quay trúng mình 🤣',
    createdAt: '17:18',
    type: 'TEXT',
  },
];
