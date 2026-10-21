import { createContext, use } from 'react';
import type { Box, Device, DeviceControlReq } from '@/api/contract';
import type { ControlResult } from '@/api/devicesController';
import type { MediaSource } from '@/api/transport';

/**
 * Yang dipakai setiap remote: perangkatnya (keadaan layar, sudah termasuk perubahan yang masih dalam perjalanan) dan cara
 * mengaturnya. Semua perintah lewat `useDeviceControl`, jadi PIN, "buka kunci?", balasan terakhir saja, dan
 * pengembalian saat gagal sama dengan Beranda dan chat.
 */
export interface RemoteApi {
  device: Device;
  /** Kirim sekarang (daya, mode, tombol remote). */
  control: (req: DeviceControlReq) => Promise<ControlResult>;
  /** Nilai kontinu (suhu, terang, volume, posisi): layar langsung berubah, nilai akhir dikirim setelah jeda. */
  adjust: (req: DeviceControlReq) => Promise<ControlResult>;
  /** Sematkan ke Beranda; gagal: toast. */
  setFavorite: (favorite: boolean) => void;
  /** Muat ulang perangkat (perangkat tidak terjangkau). */
  retry: () => void;
  mediaUrl: (mediaId: string) => Promise<MediaSource>;
  /** Kotak Sekretaris AI (hanya remote Kotak). */
  box: Box | null;
  /** Mic Kotak; gagal: toast. */
  setBoxMic: (on: boolean) => void;
}

export const RemoteContext = createContext<RemoteApi | null>(null);

export function useRemote(): RemoteApi {
  const api = use(RemoteContext);
  if (!api) throw new Error('useRemote di luar RemoteContext');
  return api;
}
