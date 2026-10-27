import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingView } from '../mockup/components/LandingView';
import { eventChatApi } from '../services/eventChatApi';
import { useRoomSession } from '../hooks/useRoomSession';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { saveSession } = useRoomSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (title: string, nickname: string, ttlHours: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventChatApi.createRoom(title, nickname || 'Host', ttlHours);
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
      setError(e.message || 'Lỗi khi tạo phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (slug: string, nickname: string) => {
    setLoading(true);
    setError(null);
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
      setError(e.message || 'Lỗi khi tham gia phòng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="max-w-md mx-auto mt-4 p-3 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-2xl text-center">
          {error}
        </div>
      )}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <div className="px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-white">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Đang xử lý yêu cầu...</span>
          </div>
        </div>
      )}
      <LandingView
        onEnterRoom={() => {}}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
};
