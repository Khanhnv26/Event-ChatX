import { useCallback, useEffect, useRef, useState } from 'react';
import { eventChatApi } from '../services/eventChatApi';
import { toast } from '../stores/toastStore';
import type { MessageResponse, ReactionEmoji, ReactionResponse } from '../types/backend.types';
import type { ChatMessage } from '../types/room';

type ReactionMap = Partial<Record<string, ReactionResponse[]>>;

interface InteractionSnapshot {
  scope: string;
  pinnedMessage: ChatMessage | null;
  reactions: ReactionMap;
}

interface Requests {
  scope: string;
  visible: Set<string>;
  loaded: Set<string>;
  pendingWrites: Set<string>;
  messageVersions: Map<string, number>;
  changed: Set<string>;
  refreshTimer?: ReturnType<typeof setTimeout>;
  pinVersion: number;
  version: number;
}

function reportError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Không thể tải tương tác tin nhắn');
}

export function useMessageInteractions(slug: string, sessionToken: string | undefined, ids: string[],
  mapMessage: (message: MessageResponse) => ChatMessage) {
  const scope = JSON.stringify([slug, sessionToken]);
  const [snapshot, setSnapshot] = useState<InteractionSnapshot>();
  const requestsRef = useRef<Requests | null>(null);
  const idsKey = JSON.stringify(ids);

  useEffect(() => {
    const requests: Requests = { scope, visible: new Set(), loaded: new Set(), pendingWrites: new Set(),
      messageVersions: new Map(), changed: new Set(), pinVersion: 0, version: 0 };
    requestsRef.current = requests;
    return () => {
      clearTimeout(requests.refreshTimer);
      requestsRef.current = null;
    };
  }, [scope]);

  const load = useCallback(async (messageIds: string[]) => {
    const requests = requestsRef.current;
    if (!slug || !sessionToken || !requests || requests.scope !== scope) return;
    const version = ++requests.version;
    requests.pinVersion = version;
    messageIds.forEach(id => requests.messageVersions.set(id, version));
    const response = await eventChatApi.getMessageInteractions(slug, messageIds, sessionToken).catch(error => {
      messageIds.forEach(id => {
        if (requests.messageVersions.get(id) === version) requests.messageVersions.delete(id);
      });
      throw error;
    });
    if (requestsRef.current !== requests) return;
    const updates: ReactionMap = {};
    for (const id of messageIds) {
      if (requests.messageVersions.get(id) !== version) continue;
      updates[id] = response.reactions[id] ?? [];
      requests.loaded.add(id);
    }
    const updatePin = requests.pinVersion === version;
    if (!updatePin && Object.keys(updates).length === 0) return;
    setSnapshot(previous => {
      const current = previous?.scope === scope ? previous : undefined;
      return {
        scope,
        pinnedMessage: updatePin ? response.pinnedMessage && mapMessage(response.pinnedMessage) : current?.pinnedMessage ?? null,
        reactions: { ...current?.reactions, ...updates },
      };
    });
  }, [slug, sessionToken, scope, mapMessage]);

  const loadBatches = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length) return load([]);
    const requests: Promise<void>[] = [];
    for (let start = 0; start < messageIds.length; start += 100) {
      requests.push(load(messageIds.slice(start, start + 100)));
    }
    await Promise.all(requests);
  }, [load]);

  useEffect(() => {
    const requests = requestsRef.current;
    if (!requests || !sessionToken) return;
    const visible: string[] = JSON.parse(idsKey);
    requests.visible = new Set(visible);
    const missing = visible.filter(id => !requests.loaded.has(id) && !requests.messageVersions.has(id));
    if (missing.length || requests.version === 0) {
      void loadBatches(missing).catch(error => { if (requestsRef.current === requests) reportError(error); });
    }
  }, [idsKey, loadBatches, sessionToken]);

  const refresh = useCallback((messageId?: string) => {
    const requests = requestsRef.current;
    if (!requests || (messageId && !requests.visible.has(messageId))) return;
    if (messageId) requests.changed.add(messageId);
    if (requests.refreshTimer !== undefined) return;
    requests.refreshTimer = setTimeout(() => {
      requests.refreshTimer = undefined;
      const changed = [...requests.changed];
      requests.changed.clear();
      void loadBatches(changed).catch(error => {
        if (requestsRef.current === requests) reportError(error);
      });
    }, 75);
  }, [loadBatches]);

  const reconnect = useCallback(() => {
    const requests = requestsRef.current;
    if (requests) void loadBatches([...requests.visible]).catch(error => {
      if (requestsRef.current === requests) reportError(error);
    });
  }, [loadBatches]);

  const setReaction = useCallback(async (messageId: string, emoji: ReactionEmoji, active: boolean) => {
    const requests = requestsRef.current;
    if (!sessionToken || requests?.scope !== scope || requests.pendingWrites.has(messageId)) return;
    requests.pendingWrites.add(messageId);
    try {
      await eventChatApi.setReaction(slug, messageId, emoji, active);
      if (requestsRef.current === requests) await load([messageId]);
    } catch (error) {
      if (requestsRef.current === requests) reportError(error);
    } finally {
      requests.pendingWrites.delete(messageId);
    }
  }, [slug, sessionToken, scope, load]);

  const setPin = useCallback(async (messageId: string | null) => {
    const requests = requestsRef.current;
    const key = 'room-pin';
    if (!sessionToken || requests?.scope !== scope || requests.pendingWrites.has(key)) return;
    requests.pendingWrites.add(key);
    try {
      await eventChatApi.setPinnedMessage(slug, messageId);
      if (requestsRef.current === requests) await load([]);
    } catch (error) {
      if (requestsRef.current === requests) reportError(error);
    } finally {
      requests.pendingWrites.delete(key);
    }
  }, [slug, sessionToken, scope, load]);

  const current = snapshot?.scope === scope ? snapshot : undefined;
  return { reactions: current?.reactions, pinnedMessage: current?.pinnedMessage, setReaction, setPin, refresh, reconnect };
}
