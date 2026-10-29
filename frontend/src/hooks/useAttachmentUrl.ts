import { useEffect, useState } from 'react';
import { attachmentApi } from '../services/attachmentApi';

export function useAttachmentUrl(slug: string | undefined, publicId: string | undefined, thumbnail: boolean, enabled = true) {
  const [result, setResult] = useState<{ key: string; url?: string; error?: string }>({ key: '' });
  const key = `${slug}/${publicId}/${thumbnail}`;
  useEffect(() => {
    if (!slug || !publicId || !enabled) return;
    const controller = new AbortController();
    let url: string | undefined;
    void attachmentApi.content(slug, publicId, thumbnail, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setResult({ key, url });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Không thể tải ảnh.' });
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [slug, publicId, thumbnail, enabled, key]);
  return result.key === key && enabled ? result : { key };
}
