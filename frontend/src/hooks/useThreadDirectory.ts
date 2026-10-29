import { useCallback, useEffect, useRef, useState } from 'react';
import { eventChatApi } from '../services/eventChatApi';
import type { MessageResponse } from '../types/backend.types';
import type { ChatMessage } from '../types/room';
import type { UserSession } from './useRoomSession';

export interface ThreadListItem {
  root: ChatMessage;
  replyCount: number;
  lastActivitySequence: number;
  lastActivityAt: string | null;
  lastReplySnippet: string | null;
}

interface DirectoryState {
  scope: string;
  open: boolean;
  entries: ThreadListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export function useThreadDirectory(slug: string, session: UserSession | null, mapMessage: (message: MessageResponse) => ChatMessage) {
  const sessionSlug = session?.slug;
  const sessionToken = session?.sessionToken;
  const scope = `${slug}:${sessionToken ?? ''}`;
  const [state, setState] = useState<DirectoryState>({ scope: '', open: false, entries: [], loading: false, error: null, hasMore: false });
  const active = useRef(false);
  const generation = useRef(0);
  const cursor = useRef<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loading = useRef(false);

  useEffect(() => () => {
    generation.current += 1; active.current = false; cursor.current = null; loading.current = false;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  }, [scope]);

  const close = useCallback(() => {
    active.current = false; generation.current += 1; loading.current = false;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
    setState(previous => ({ ...previous, open: false, loading: false }));
  }, []);

  const load = useCallback(async (append = false, preserve = false) => {
    if (!active.current || sessionSlug !== slug || !sessionToken || append && (loading.current || cursor.current === null)) return;
    const version = ++generation.current;
    const pageCursor = append ? cursor.current! : undefined;
    loading.current = true;
    setState(previous => ({ ...previous, entries: previous.scope === scope ? previous.entries : [], scope, open: true, loading: true, error: null }));
    try {
      const page = await eventChatApi.getThreads(slug, pageCursor);
      if (version !== generation.current || !active.current) return;
      const items = page.threads.map(({ rootMessage, ...item }) => ({ ...item, root: mapMessage(rootMessage) }));
      if (append && page.hasMore && (page.nextActivitySequence === null || page.nextActivitySequence >= pageCursor!)) {
        throw new Error('Không thể tải tiếp danh sách nhánh. Vui lòng thử lại.');
      }
      const hadCursor = cursor.current !== null;
      if (!preserve || !hadCursor) cursor.current = page.nextActivitySequence;
      setState(previous => {
        const byRoot = new Map((append || preserve ? previous.entries : []).map(item => [item.root.id, item]));
        items.forEach(item => { const old = byRoot.get(item.root.id); if (!old || old.lastActivitySequence <= item.lastActivitySequence) byRoot.set(item.root.id, item); });
        return { scope, open: true, entries: [...byRoot.values()].sort((a, b) => b.lastActivitySequence - a.lastActivitySequence),
          loading: false, error: null, hasMore: preserve && hadCursor ? previous.hasMore : page.hasMore };
      });
    } catch (err) {
      if (version === generation.current) setState(previous => ({ ...previous, loading: false, error: err instanceof Error ? err.message : 'Không thể tải danh sách nhánh' }));
    } finally { if (version === generation.current) loading.current = false; }
  }, [slug, sessionSlug, sessionToken, scope, mapMessage]);

  const open = useCallback(() => { active.current = true; cursor.current = null; void load(); }, [load]);
  const reload = useCallback(() => load(), [load]);
  const loadMore = useCallback(() => load(true), [load]);
  const noteActivity = useCallback(() => {
    if (!active.current || refreshTimer.current) return;
    const refreshWhenIdle = () => {
      if (!active.current) { refreshTimer.current = null; return; }
      if (loading.current) { refreshTimer.current = setTimeout(refreshWhenIdle, 300); return; }
      refreshTimer.current = null;
      void load(false, true);
    };
    refreshTimer.current = setTimeout(refreshWhenIdle, 300);
  }, [load]);
  const visible = state.scope === scope;
  return { isOpen: visible && state.open, entries: visible ? state.entries : [], loading: visible && state.loading,
    error: visible ? state.error : null, hasMore: visible && state.hasMore, open, close, reload, loadMore, noteActivity };
}
