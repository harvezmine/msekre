import { useRef, useState } from 'react';
import { useApi } from '@/api/ApiProvider';
import { FILE_DOWNLOAD_TEXT, FILE_NO_APP_TEXT } from '@/api/errors';
import type { MediaSource } from '@/api/transport';
import { NoViewerError, openDocument, shareDocument, type LocalDocument } from '@/files/documents';
import { useSampleDispatch } from '@/sample/store';
import { useMediaDownload } from './useMedia';

export interface DocumentRef {
  mediaId: string;
  name: string;
  mime: string;
  /** Ukuran berkas (byte), kalau diketahui: berkas yang sudah diunduh dengan ukuran sama dipakai lagi. */
  size?: number;
}

/**
 * Buka dan bagikan dokumen `file`: keduanya mengunduhnya dulu ke HP (selagi itu `busy` terisi dan aksi lain diabaikan;
 * berakhir begitu berkasnya ada), lalu Buka membukanya di aplikasi bawaan HP dan Bagikan membuka lembar bagikan. Gagal memunculkan toast ramah. Dipakai
 * kartu berkas di chat dan kartu laporan di Usaha.
 */
export function useDocumentActions(file: DocumentRef, mediaUrl: (mediaId: string) => Promise<MediaSource>) {
  const dispatch = useSampleDispatch();
  const { transport } = useApi();
  const download = useMediaDownload(mediaUrl);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const running = useRef(false);
  const run = async (kind: 'open' | 'share', action: (doc: LocalDocument) => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    let doc: LocalDocument;
    try {
      doc = await download(file.mediaId, file.name, file.mime, file.size);
    } catch {
      dispatch({ type: 'showToast', text: FILE_DOWNLOAD_TEXT });
      // Unduhan ditolak karena sesi sudah dicabut? Satu pemeriksaan ringan: 401 menghapus sesi seperti request lain.
      void transport.me().catch(() => {});
      return;
    } finally {
      running.current = false;
      setBusy(null);
    }
    // Sibuk berakhir begitu berkasnya ada; membuka aplikasi lain tidak menahan tombolnya sampai pengguna kembali.
    try {
      await action(doc);
    } catch (e) {
      dispatch({ type: 'showToast', text: e instanceof NoViewerError ? FILE_NO_APP_TEXT : FILE_DOWNLOAD_TEXT });
    }
  };
  return {
    busy,
    open: () => void run('open', openDocument),
    share: () => void run('share', shareDocument),
  };
}
