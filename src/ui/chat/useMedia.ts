import { useCallback, useEffect, useState } from 'react';
import type { MediaSource } from '@/api/transport';

/**
 * Cara menampilkan media `mediaId`: `null` selagi diambil, `'error'` kalau gagal. `reload` mengambil ulang (misalnya
 * dari tombol "Coba muat lagi").
 */
export function useMedia(
  mediaUrl: (mediaId: string) => Promise<MediaSource>,
  mediaId: string,
): { media: MediaSource | null | 'error'; reload: () => void } {
  const [result, setResult] = useState<{ id: string; source: MediaSource | 'error' } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    mediaUrl(mediaId).then(
      (source) => alive && setResult({ id: mediaId, source }),
      () => alive && setResult({ id: mediaId, source: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [mediaUrl, mediaId, attempt]);
  const reload = useCallback(() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);
  return { media: result?.id === mediaId ? result.source : null, reload };
}
