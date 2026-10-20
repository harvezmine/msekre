import { useEffect, useState } from 'react';
import type { MediaSource } from '@/api/transport';

/** Cara menampilkan media `mediaId`: `null` selagi diambil, `'error'` kalau gagal. */
export function useMedia(
  mediaUrl: (mediaId: string) => Promise<MediaSource>,
  mediaId: string,
): MediaSource | null | 'error' {
  const [result, setResult] = useState<{ id: string; source: MediaSource | 'error' } | null>(null);
  useEffect(() => {
    let alive = true;
    mediaUrl(mediaId).then(
      (source) => alive && setResult({ id: mediaId, source }),
      () => alive && setResult({ id: mediaId, source: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [mediaUrl, mediaId]);
  return result?.id === mediaId ? result.source : null;
}
