import { apiClient } from './api.client';
import type {
  ApiResponse,
  RoomAuthResponse,
  RoomDetailResponse,
  MessageResponse,
  PollResponse,
  DecisionResponse,
  WheelResponse,
  WheelSpinResponse,
  RoomExportResponse,
  DecisionStatus,
} from '../types/backend.types';

export const eventChatApi = {
  createRoom: async (title: string, hostNickname: string, ttlMinutes = 1440): Promise<RoomAuthResponse> => {
    const res = await apiClient.post<ApiResponse<RoomAuthResponse>>('/rooms', {
      title,
      hostNickname,
      ttlMinutes,
    });
    return res.data.data;
  },

  joinRoom: async (slug: string, nickname: string): Promise<RoomAuthResponse> => {
    const res = await apiClient.post<ApiResponse<RoomAuthResponse>>(`/rooms/${slug}/join`, {
      nickname,
    });
    return res.data.data;
  },

  reconnect: async (slug: string, sessionToken: string): Promise<RoomAuthResponse> => {
    const res = await apiClient.post<ApiResponse<RoomAuthResponse>>(
      `/rooms/${slug}/reconnect`,
      {},
      { headers: { 'X-Session-Token': sessionToken } }
    );
    return res.data.data;
  },

  getRoomDetails: async (slug: string): Promise<RoomDetailResponse> => {
    const res = await apiClient.get<ApiResponse<RoomDetailResponse>>(`/rooms/${slug}`);
    return res.data.data;
  },

  getPresence: async (slug: string): Promise<string[]> => {
    const res = await apiClient.get<ApiResponse<string[]>>(`/rooms/${slug}/presence`, { skipToast: true });
    return res.data.data;
  },

  closeRoom: async (slug: string): Promise<void> => {
    await apiClient.post<ApiResponse<void>>(`/rooms/${slug}/close`);
  },

  updateJoinLock: async (slug: string, joinLocked: boolean): Promise<void> => {
    await apiClient.patch<ApiResponse<void>>(`/rooms/${slug}/join-lock`, { joinLocked });
  },

  kickParticipant: async (slug: string, guestId: string): Promise<void> => {
    await apiClient.post<ApiResponse<void>>(
      `/rooms/${slug}/participants/${encodeURIComponent(guestId)}/kick`
    );
  },

  sendMessage: async (
    slug: string,
    clientMessageId: string,
    body: string,
    replyToId?: string | null,
    attachmentIds?: string[]
  ): Promise<MessageResponse> => {
    const res = await apiClient.post<ApiResponse<MessageResponse>>(`/rooms/${slug}/messages`, {
      clientMessageId,
      body,
      replyToId: replyToId || null,
      ...(attachmentIds?.length ? { attachmentIds } : {}),
    });
    return res.data.data;
  },

  getMessages: async (slug: string, afterSequence?: number): Promise<MessageResponse[]> => {
    const params = afterSequence !== undefined && afterSequence >= 0 ? { afterSequence } : {};
    const res = await apiClient.get<ApiResponse<MessageResponse[]>>(`/rooms/${slug}/messages`, { params });
    return res.data.data;
  },

  getPolls: async (slug: string): Promise<PollResponse[]> => {
    const res = await apiClient.get<ApiResponse<PollResponse[]>>(`/rooms/${slug}/polls`);
    return res.data.data;
  },

  createPoll: async (
    slug: string,
    question: string,
    options: string[],
    allowMultiple = false
  ): Promise<PollResponse> => {
    const res = await apiClient.post<ApiResponse<PollResponse>>(`/rooms/${slug}/polls`, {
      question,
      options,
      allowMultiple,
    });
    return res.data.data;
  },

  castVote: async (slug: string, pollId: number, optionId: number): Promise<PollResponse> => {
    const res = await apiClient.post<ApiResponse<PollResponse>>(`/rooms/${slug}/polls/${pollId}/votes`, {
      optionId,
    });
    return res.data.data;
  },

  closePoll: async (slug: string, pollId: number): Promise<PollResponse> => {
    const res = await apiClient.post<ApiResponse<PollResponse>>(`/rooms/${slug}/polls/${pollId}/close`);
    return res.data.data;
  },

  updateVotes: async (slug: string, pollId: number, optionIds: number[]): Promise<PollResponse> => {
    const res = await apiClient.put<ApiResponse<PollResponse>>(`/rooms/${slug}/polls/${pollId}/votes`, { optionIds });
    return res.data.data;
  },

  removeDecision: async (slug: string, decisionId: number): Promise<DecisionResponse> => {
    const res = await apiClient.delete<ApiResponse<DecisionResponse>>(`/rooms/${slug}/decisions/${decisionId}`);
    return res.data.data;
  },

  getDecisions: async (slug: string): Promise<DecisionResponse[]> => {
    const res = await apiClient.get<ApiResponse<DecisionResponse[]>>(`/rooms/${slug}/decisions`);
    return res.data.data;
  },

  createDecision: async (
    slug: string,
    text: string,
    proposeImmediately = true,
    evidenceRefs: string[] = [],
    sourceSpinId?: number
  ): Promise<DecisionResponse> => {
    const res = await apiClient.post<ApiResponse<DecisionResponse>>(`/rooms/${slug}/decisions`, {
      text,
      proposeImmediately,
      evidenceRefs,
      ...(sourceSpinId !== undefined ? { sourceSpinId } : {}),
    });
    return res.data.data;
  },

  confirmDecision: async (
    slug: string,
    decisionId: number,
    choice: 'APPROVE' | 'REJECT'
  ): Promise<DecisionResponse> => {
    const res = await apiClient.post<ApiResponse<DecisionResponse>>(`/rooms/${slug}/decisions/${decisionId}/confirm`, {
      choice,
    });
    return res.data.data;
  },

  updateDecisionStatus: async (
    slug: string,
    decisionId: number,
    status: DecisionStatus
  ): Promise<DecisionResponse> => {
    const res = await apiClient.patch<ApiResponse<DecisionResponse>>(`/rooms/${slug}/decisions/${decisionId}/status`, {
      status,
    });
    return res.data.data;
  },

  getWheels: async (slug: string): Promise<WheelResponse[]> => {
    const res = await apiClient.get<ApiResponse<WheelResponse[]>>(`/rooms/${slug}/wheels`);
    return res.data.data;
  },

  createWheel: async (
    slug: string,
    title: string,
    entries: string[],
    excludeWinner = false
  ): Promise<WheelResponse> => {
    const res = await apiClient.post<ApiResponse<WheelResponse>>(`/rooms/${slug}/wheels`, {
      title,
      entries,
      excludeWinner,
    });
    return res.data.data;
  },

  spinWheel: async (
    slug: string,
    wheelId: number,
    idempotencyKey = crypto.randomUUID()
  ): Promise<WheelSpinResponse> => {
    const res = await apiClient.post<ApiResponse<WheelSpinResponse>>(`/rooms/${slug}/wheels/${wheelId}/spin`, {
      idempotencyKey,
    });
    return res.data.data;
  },

  exportSummary: async (slug: string): Promise<RoomExportResponse> => {
    const res = await apiClient.get<ApiResponse<RoomExportResponse>>(`/rooms/${slug}/export`);
    return res.data.data;
  },
};
