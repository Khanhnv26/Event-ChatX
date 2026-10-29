import { useCallback, useEffect, useRef, useState } from 'react';
import { eventChatApi } from '../services/eventChatApi';
import type { MessageResponse } from '../types/backend.types';
import type { ChatMessage, RoomStatus } from '../types/room';
import type { UserSession } from './useRoomSession';
import { useThreadDirectory } from './useThreadDirectory';

function merge(previous: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(previous.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export function useBranchChat(slug: string, session: UserSession | null, roomStatus: RoomStatus,
  mapMessage: (message: MessageResponse) => ChatMessage,
  onCount: (rootId: string, count: number) => void) {
  const [root, setRoot] = useState<ChatMessage | null>(null);
  const [rootScope, setRootScope] = useState('');
  const scope = `${slug}:${session?.sessionToken ?? ''}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const drafts = useRef(new Map<string, string>());
  const selected = useRef<string | null>(null);
  const generation = useRef(0);
  const sendPending = useRef(false);
  const retry = useRef(new Map<string, { payload: string; id: string }>());
  const directory = useThreadDirectory(slug, session, mapMessage);
  const { close: closeDirectory, open: openList, noteActivity } = directory;

  const close = useCallback(() => {
    closeDirectory();
    generation.current += 1;
    selected.current = null;
    setRoot(null); setMessages([]); setError(null); setLoading(false); setSending(false);
  }, [closeDirectory]);

  useEffect(() => () => { generation.current += 1; selected.current = null; retry.current.clear(); drafts.current.clear(); }, [slug, session?.sessionToken]);

  const changeDraft = useCallback((text: string) => {
    if (!selected.current) return;
    if (text) drafts.current.set(selected.current, text);
    else drafts.current.delete(selected.current);
    setDraft(text);
  }, []);

  const load = useCallback(async () => {
    const rootId = selected.current;
    if (!rootId || session?.slug !== slug) return;
    const version = ++generation.current;
    setLoading(true); setError(null);
    try {
      let cursor = 0;
      while (true) {
        const page = await eventChatApi.getThread(slug, rootId, cursor);
        if (version !== generation.current) return;
        setRoot(mapMessage(page.rootMessage));
        onCount(rootId, page.rootMessage.threadReplyCount ?? 0);
        setMessages(previous => merge(previous, page.messages.filter(message => message.threadRootId === rootId).map(mapMessage)));
        if (!page.hasMore) break;
        if (page.nextSequence <= cursor) throw new Error('Không thể tải tiếp phản hồi. Vui lòng thử lại.');
        cursor = page.nextSequence;
      }
    } catch (err) {
      if (version === generation.current) setError(err instanceof Error ? err.message : 'Không thể tải nhánh thảo luận');
    } finally { if (version === generation.current) setLoading(false); }
  }, [slug, session?.slug, mapMessage, onCount]);

  const open = useCallback((message: ChatMessage) => {
    if (message.threadRootId || message.type === 'SYSTEM' || message.sequence == null) return;
    closeDirectory();
    selected.current = message.id;
    setDraft(drafts.current.get(message.id) ?? '');
    setRootScope(scope);
    setRoot(message); setMessages([]); setSending(false);
    void load();
  }, [load, scope, closeDirectory]);

  const openDirectory = useCallback(() => { close(); openList(); }, [close, openList]);
  const reload = useCallback(async () => { await load(); noteActivity(); }, [load, noteActivity]);

  const receive = useCallback((message: MessageResponse) => {
    if (!message.threadRootId) return;
    noteActivity();
    onCount(message.threadRootId, message.threadReplyCount ?? 0);
    if (selected.current === message.threadRootId) {
      setMessages(previous => merge(previous, [mapMessage(message)]));
    }
  }, [mapMessage, onCount, noteActivity]);

  const send = useCallback(async (text: string) => {
    const rootId = selected.current;
    if (!rootId || !text.trim() || roomStatus !== 'ACTIVE' || session?.slug !== slug || sendPending.current) return false;
    const payload = JSON.stringify([slug, session.guestId, rootId, text.trim()]);
    if (retry.current.get(rootId)?.payload !== payload) retry.current.set(rootId, { payload, id: crypto.randomUUID() });
    const request = retry.current.get(rootId)!;
    const version = generation.current;
    sendPending.current = true; setSending(true); setError(null);
    try {
      const response = await eventChatApi.sendThreadMessage(slug, rootId, request.id, text.trim());
      if (version !== generation.current) return false;
      receive(response);
      drafts.current.delete(rootId);
      setDraft('');
      if (retry.current.get(rootId) === request) retry.current.delete(rootId);
      return true;
    } catch (err) {
      if (version === generation.current) setError(err instanceof Error ? err.message : 'Không thể gửi phản hồi');
      return false;
    } finally {
      sendPending.current = false;
      if (version === generation.current) setSending(false);
    }
  }, [slug, session, roomStatus, receive]);

  const visible = rootScope === scope;
  return { root: visible ? root : null, messages: visible ? messages : [], loading: visible && loading,
    sending: visible && sending, error: visible ? error : null, draft: visible ? draft : '', changeDraft, open, close, reload, receive, send, directory, openDirectory };
}
