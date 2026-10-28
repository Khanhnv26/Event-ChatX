import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingView } from '../mockup/components/LandingView';
import { eventChatApi } from '../services/eventChatApi';
import { useRoomSession } from '../hooks/useRoomSession';
import { useLoadingOverlay } from '../components/common/PreloaderContext';
import { toast } from '../stores/toastStore';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { saveSession } = useRoomSession();
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  useLoadingOverlay(pendingAction !== null);

  const handleCreateRoom = async (title: string, nickname: string, ttlMinutes: number) => {
    if (pendingAction) return;
    setPendingAction('create');
    try {
      const res = await eventChatApi.createRoom(title, nickname || 'Host', ttlMinutes);
      saveSession({
        slug: res.slug,
        guestId: res.guestId,
        nickname: res.nickname,
        role: res.role,
        sessionToken: res.sessionToken,
        hostToken: res.hostToken,
      });
      navigate(`/rooms/${res.slug}`);
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Lỗi khi tạo phòng');
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoinRoom = async (slug: string, nickname: string) => {
    if (pendingAction) return;
    setPendingAction('join');
    try {
      const res = await eventChatApi.joinRoom(slug.trim(), nickname || 'Khách');
      saveSession({
        slug: res.slug,
        guestId: res.guestId,
        nickname: res.nickname,
        role: res.role,
        sessionToken: res.sessionToken,
        hostToken: null,
      });
      navigate(`/rooms/${res.slug}`);
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || 'Lỗi khi tham gia phòng');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <LandingView
      onEnterRoom={() => {}}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      pendingAction={pendingAction}
    />
  );
};
