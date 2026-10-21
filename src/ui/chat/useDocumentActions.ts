import { useRef, useState } from 'react';
import { FILE_DOWNLOAD_TEXT, FILE_NO_APP_TEXT } from '@/api/errors';
import type { MediaSource } from '@/api/transport';
import { NoViewerError, openDocument, shareDocument, type LocalDocument } from '@/files/documents';
import { useSampleDispatch } from '@/sample/store';
import { useMediaDownload } from './useMedia';

export interface DocumentRef {
  mediaId: string;
  name: string;
  mime: string;
}

/**
 * Buka dan bagikan dokumen `file`: keduanya mengunduhnya dulu ke HP (selagi itu `busy` terisi dan aksi lain diabaikan),
 * lalu Buka membukanya di aplikasi bawaan HP dan Bagikan membuka lembar bagikan. Gagal memunculkan toast ramah. Dipakai
 * kartu berkas di chat dan kartu laporan di Usaha.
 */
export function useDocumentActions(file: DocumentRef, mediaUrl: (mediaId: string) => Promise<MediaSource>) {
  const dispatch = useSampleDispatch();
  const download = useMediaDownload(mediaUrl);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const running = useRef(false);
  const run = async (kind: 'open' | 'share', action: (doc: LocalDocument) => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    try {
      await action(await download(file.mediaId, file.name, file.mime));
    } catch (e) {
      dispatch({ type: 'showToast', text: e instanceof NoViewerError ? FILE_NO_APP_TEXT : FILE_DOWNLOAD_TEXT });
    } finally {
      running.current = false;
      setBusy(null);
    }
  };
  return {
    busy,
    open: () => void run('open', openDocument),
    share: () => void run('share', shareDocument),
  };
}
