import { useCallback, useEffect, useState } from 'react';
import type { MediaSource } from '@/api/transport';
import { downloadDocument, FileDownloadError, type LocalDocument } from '@/files/documents';

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

/**
 * Unduh dokumen `mediaId` ke HP. Mode server memakai header token; server tiruan membuat berkas contoh kecil. Gagal
 * (termasuk alamat media yang tidak ada) menjadi `FileDownloadError`.
 */
export function useMediaDownload(mediaUrl: (mediaId: string) => Promise<MediaSource>) {
  return useCallback(
    async (mediaId: string, name: string, mime: string): Promise<LocalDocument> => {
      let source: MediaSource;
      try {
        source = await mediaUrl(mediaId);
      } catch (e) {
        throw new FileDownloadError(e);
      }
      return downloadDocument(source, mediaId, name, mime);
    },
    [mediaUrl],
  );
}
