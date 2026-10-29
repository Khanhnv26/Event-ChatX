import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AttachmentUploadQueue } from '../services/attachmentUploadQueue';
export type { AttachmentDraft } from '../services/attachmentUploadQueue';

export function useAttachmentUploads(slug: string | undefined, enabled: boolean) {
  const queue = useMemo(() => new AttachmentUploadQueue(slug, enabled), [slug, enabled]);
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  useEffect(() => { queue.resume(); return () => queue.dispose(); }, [queue]);
  return { ...snapshot, add: queue.add, remove: queue.remove, retry: queue.retry, clearSent: queue.clearSent,
    ready: snapshot.drafts.length > 0 && snapshot.drafts.every(draft => draft.state === 'ready'),
    attachments: snapshot.drafts.flatMap(draft => draft.attachment ? [draft.attachment] : []) };
}
