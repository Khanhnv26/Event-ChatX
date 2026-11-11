import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activateNotificationSound, NOTIFICATION_SOUND_KEY, playNotificationSound, readNotificationSound, saveNotificationSound } from '../services/notificationSound';
import type { NewRoomNotification, RoomNotification } from '../types/roomNotification';

const INBOX_LIMIT = 80;
const SEEN_LIMIT = 600;

interface Inbox {
  entries: RoomNotification[];
  followed: string[];
}

interface InboxSession {
  key: string | undefined;
  data: Inbox;
  seen: Set<string>;
}

function readInbox(key: string | undefined): Inbox {
  if (key) {
    try {
      const value = sessionStorage.getItem(key);
      if (value) {
        const data = JSON.parse(value) as Partial<Inbox> | null;
        if (data && Array.isArray(data.entries) && Array.isArray(data.followed)) {
          return { entries: data.entries, followed: data.followed };
        }
      }
    } catch { return { entries: [], followed: [] }; }
  }
  return { entries: [], followed: [] };
}

export function useRoomNotifications(slug: string, guestId: string | undefined, activeThreadId: string | undefined) {
  const key = slug && guestId ? `eventchat_notifications:${slug}:${guestId}` : undefined;
  const initial = useMemo(() => readInbox(key), [key]);
  const inboxRef = useRef<InboxSession | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string | undefined; entries: RoomNotification[] }>();
  const [soundEnabled, setSoundEnabled] = useState(readNotificationSound);
  const soundEnabledRef = useRef(soundEnabled);
  const entries = snapshot && snapshot.key === key ? snapshot.entries : initial.entries;

  useEffect(() => {
    inboxRef.current = { key, data: initial, seen: new Set(initial.entries.map(entry => entry.id)) };
    return () => { inboxRef.current = null; };
  }, [initial, key]);

  const save = useCallback((data: Inbox) => {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(data)); }
    catch { return; }
  }, [key]);

  const remember = useCallback((id: string) => {
    const inbox = inboxRef.current;
    if (!inbox || inbox.key !== key) return false;
    if (inbox.seen.has(id)) return false;
    inbox.seen.add(id);
    if (inbox.seen.size > SEEN_LIMIT) {
      const oldest = inbox.seen.values().next().value;
      if (oldest !== undefined) inbox.seen.delete(oldest);
    }
    return true;
  }, [key]);

  const add = useCallback((entry: NewRoomNotification, audible = true) => {
    const inbox = inboxRef.current;
    if (!key || !inbox || inbox.key !== key || !remember(entry.id)) return;
    const next = [{ ...entry, read: false, receivedAt: Date.now() }, ...inbox.data.entries].slice(0, INBOX_LIMIT);
    inbox.data = { ...inbox.data, entries: next };
    save(inbox.data);
    setSnapshot({ key, entries: next });
    if (audible && soundEnabledRef.current) playNotificationSound();
  }, [key, remember, save]);

  const markRead = useCallback((matches: (entry: RoomNotification) => boolean) => {
    const inbox = inboxRef.current;
    if (!inbox || inbox.key !== key) return;
    const previous = inbox.data.entries;
    if (!previous.some(entry => !entry.read && matches(entry))) return;
    const next = previous.map(entry => !entry.read && matches(entry) ? { ...entry, read: true } : entry);
    inbox.data = { ...inbox.data, entries: next };
    save(inbox.data);
    setSnapshot({ key, entries: next });
  }, [key, save]);

  const followThread = useCallback((rootId: string) => {
    const inbox = inboxRef.current;
    if (!key || !inbox || inbox.key !== key || inbox.data.followed.includes(rootId)) return;
    inbox.data = { ...inbox.data, followed: [...inbox.data.followed, rootId].slice(-INBOX_LIMIT) };
    save(inbox.data);
  }, [key, save]);

  const followsThread = useCallback((rootId: string) => {
    const inbox = inboxRef.current;
    return Boolean(inbox && inbox.key === key && inbox.data.followed.includes(rootId));
  }, [key]);

  const changeSound = async (enabled: boolean) => {
    saveNotificationSound(enabled);
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    return !enabled || activateNotificationSound(true);
  };

  useEffect(() => {
    const syncSound = (event: StorageEvent) => {
      if (event.key !== NOTIFICATION_SOUND_KEY) return;
      const enabled = event.newValue === 'on';
      soundEnabledRef.current = enabled;
      setSoundEnabled(enabled);
    };
    window.addEventListener('storage', syncSound);
    return () => window.removeEventListener('storage', syncSound);
  }, []);

  useEffect(() => {
    if (!key) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') return;
      markRead(entry => entry.kind === 'message' || entry.kind === 'thread' && entry.threadRootId === activeThreadId);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setTimeout(onVisibility, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeThreadId, key, markRead]);

  useEffect(() => {
    if (!key || !soundEnabled) return;
    const activate = () => { void activateNotificationSound(); };
    window.addEventListener('pointerdown', activate, { once: true });
    window.addEventListener('keydown', activate, { once: true });
    return () => {
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
    };
  }, [key, soundEnabled]);

  const chatUnread = entries.filter(entry => entry.kind === 'message' && !entry.read).length;
  useEffect(() => {
    if (!key || !chatUnread) return;
    const title = document.title;
    document.title = `(${chatUnread}) ${title}`;
    return () => { document.title = title; };
  }, [chatUnread, key]);

  return {
    entries, soundEnabled, changeSound, previewSound: () => activateNotificationSound(true),
    add, remember, followThread, followsThread,
    read: (id: string) => markRead(entry => entry.id === id),
    readAll: () => markRead(() => true),
  };
}
