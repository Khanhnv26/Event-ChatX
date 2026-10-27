import { useState, useCallback } from 'react';
import type { SessionRole } from '../types/backend.types';

export interface UserSession {
  slug: string;
  guestId: string;
  nickname: string;
  role: SessionRole;
  sessionToken: string;
  hostToken: string | null;
}

export function useRoomSession() {
  const [session, setSessionState] = useState<UserSession | null>(() => {
    const slug = sessionStorage.getItem('eventchat_slug');
    const guestId = sessionStorage.getItem('eventchat_guest_id');
    const nickname = sessionStorage.getItem('eventchat_nickname');
    const role = (sessionStorage.getItem('eventchat_role') as SessionRole) || 'PARTICIPANT';
    const sessionToken = sessionStorage.getItem('eventchat_session_token');
    const hostToken = sessionStorage.getItem('eventchat_host_token');

    if (slug && sessionToken && guestId && nickname) {
      return { slug, guestId, nickname, role, sessionToken, hostToken };
    }
    return null;
  });

  const saveSession = useCallback((newSession: UserSession) => {
    sessionStorage.setItem('eventchat_slug', newSession.slug);
    sessionStorage.setItem('eventchat_guest_id', newSession.guestId);
    sessionStorage.setItem('eventchat_nickname', newSession.nickname);
    sessionStorage.setItem('eventchat_role', newSession.role);
    sessionStorage.setItem('eventchat_session_token', newSession.sessionToken);
    if (newSession.hostToken) {
      sessionStorage.setItem('eventchat_host_token', newSession.hostToken);
    } else {
      sessionStorage.removeItem('eventchat_host_token');
    }
    setSessionState(newSession);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('eventchat_slug');
    sessionStorage.removeItem('eventchat_guest_id');
    sessionStorage.removeItem('eventchat_nickname');
    sessionStorage.removeItem('eventchat_role');
    sessionStorage.removeItem('eventchat_session_token');
    sessionStorage.removeItem('eventchat_host_token');
    setSessionState(null);
  }, []);

  return { session, saveSession, clearSession };
}
