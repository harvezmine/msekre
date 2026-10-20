import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { MediaSource } from '@/api/transport';

/** Berkas yang sudah ada di HP (folder cache aplikasi). */
export interface LocalDocument {
  /** `file://...` di cache aplikasi. */
  uri: string;
  name: string;
  mime: string;
}

/** Berkas gagal diunduh (sinyal, sesi, atau berkasnya sudah tidak ada). */
export class FileDownloadError extends Error {
  constructor(cause?: unknown) {
    super('berkas gagal diunduh', { cause });
    this.name = 'FileDownloadError';
  }
}

/** Tidak ada aplikasi di HP yang bisa membuka berkas ini, dan lembar bagikan pun tidak tersedia. */
export class NoViewerError extends Error {
  constructor(cause?: unknown) {
    super('tidak ada aplikasi pembuka berkas', { cause });
    this.name = 'NoViewerError';
  }
}

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION`: aplikasi pembuka boleh membaca berkas lewat `content://`. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const ACTION_VIEW = 'android.intent.action.VIEW';
const SAMPLE_TEXT = 'Ini berkas contoh dari Sekretaris AI. Berkas yang asli muncul saat Anda sudah masuk.\n';

/** Nama yang aman dipakai sebagai nama berkas di HP. */
const safe = (text: string) => text.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'berkas';

/**
 * Unduh dokumen ke cache aplikasi. Alamat server asli diunduh dengan header `Authorization` (alamat `/media/:id` tidak
 * bertanda tangan). Server tiruan tidak punya berkas, jadi aplikasi menulis berkas teks kecil sebagai contoh. Gagal
 * apa pun menjadi {@link FileDownloadError}.
 */
export async function downloadDocument(
  source: MediaSource,
  mediaId: string,
  name: string,
  mime: string,
): Promise<LocalDocument> {
  try {
    // Satu folder per berkas: nama aslinya tetap terlihat di aplikasi pembuka dan lembar bagikan.
    const dir = new Directory(Paths.cache, 'berkas', safe(mediaId));
    dir.create({ idempotent: true, intermediates: true });
    if (source.kind === 'uri') {
      const file = await File.downloadFileAsync(source.uri, new File(dir, safe(name)), {
        headers: source.headers,
        idempotent: true,
      });
      return { uri: file.uri, name, mime };
    }
    if (source.kind === 'sampleFile') {
      const sampleName = `${safe(name).replace(/\.[^.]*$/, '')} (contoh).txt`;
      const file = new File(dir, sampleName);
      file.create({ overwrite: true });
      await file.write(SAMPLE_TEXT);
      return { uri: file.uri, name: sampleName, mime: 'text/plain' };
    }
    throw new Error('bukan dokumen');
  } catch (e) {
    throw new FileDownloadError(e);
  }
}

/** Buka lembar bagikan untuk berkas ini. {@link NoViewerError} kalau HP tidak punya lembar bagikan. */
export async function shareDocument(doc: LocalDocument): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('berbagi tidak tersedia');
    await Sharing.shareAsync(doc.uri, { mimeType: doc.mime, dialogTitle: doc.name });
  } catch (e) {
    throw new NoViewerError(e);
  }
}

/**
 * Buka berkas di aplikasi bawaan HP. Android: `ACTION_VIEW` dengan alamat `content://` dan izin baca. Tanpa aplikasi
 * yang bisa membukanya, atau di platform lain, memakai lembar bagikan; kalau itu pun tidak ada, {@link NoViewerError}.
 */
export async function openDocument(doc: LocalDocument): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const data = await getContentUriAsync(doc.uri);
      await IntentLauncher.startActivityAsync(ACTION_VIEW, {
        data,
        type: doc.mime,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
      return;
    } catch {
      // Tidak ada aplikasi pembuka untuk jenis berkas ini: coba lembar bagikan.
    }
  }
  await shareDocument(doc);
}
