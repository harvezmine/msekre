import { router } from 'expo-router';
import { useEffect } from 'react';
import type { DeviceControlReq } from './contract';
import type { ControlResult } from './devicesController';
import { isContinuousRequest } from './devices';
import { useDevices } from './useDevices';
import { useToast } from '@/ui/toastStore';

/**
 * Perintah ke perangkat dari layar: kegagalan menjadi toast ramah, dan aksi yang butuh PIN membuka lembar PIN
 * (`/pin?id=`), yang mengulang perintahnya dengan PIN. Membuka kunci saat PIN mati bertanya dulu di `/buka-kunci?id=`.
 * Hasilnya dikembalikan supaya layar bisa menyesuaikan.
 *
 * `adjust` untuk nilai kontinu (suhu, terang, volume, posisi, suhu warna): layar berubah seketika, nilai akhir dikirim
 * sekitar 400 ms setelah perubahan terakhir, dikirim langsung saat layar ditutup, dan dikembalikan bila gagal. Tombol
 * remote (`key`) lewat `control`, satu per satu, tanpa ditebak di layar kecuali volume.
 */
export function useDeviceControl(place: string | null | undefined) {
  const devices = useDevices(place);
  const toast = useToast();
  const flushPending = devices.flushPending;
  useEffect(() => () => void flushPending(), [flushPending]);
  const report = (id: string, result: ControlResult): ControlResult => {
    if (result.ok) return result;
    if (result.reason === 'pin') router.push({ pathname: '/pin', params: { id } });
    else if (result.reason === 'confirm') router.push({ pathname: '/buka-kunci', params: { id } });
    else toast(result.message);
    return result;
  };
  /** Kirim sekarang (nyala-mati, mode, tombol remote, ...). */
  const control = async (id: string, req: DeviceControlReq): Promise<ControlResult> =>
    report(id, await devices.controlDevice(id, req));
  /**
   * Untuk nilai kontinu (suhu, terang, volume, posisi, suhu warna) selagi digeser: layar berubah seketika dan hanya nilai
   * akhir yang dikirim. Perintah yang memuat bidang lain dikirim langsung seperti `control`.
   */
  const adjust = async (id: string, req: DeviceControlReq): Promise<ControlResult> =>
    isContinuousRequest(req)
      ? report(id, await devices.controlDeviceDebounced(id, req))
      : report(id, await devices.controlDevice(id, req));
  return { ...devices, control, adjust };
}
