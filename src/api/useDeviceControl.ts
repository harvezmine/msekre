import { router } from 'expo-router';
import { useSampleDispatch } from '@/sample/store';
import type { DeviceControlReq } from './contract';
import type { ControlResult } from './devicesController';
import { useDevices } from './useDevices';

/**
 * Perintah ke perangkat dari layar: kegagalan menjadi toast ramah, dan aksi yang butuh PIN membuka lembar PIN
 * (`/pin?id=`), yang mengulang perintahnya dengan PIN. Membuka kunci saat PIN mati bertanya dulu di `/buka-kunci?id=`. Hasilnya dikembalikan supaya layar bisa menyesuaikan.
 */
export function useDeviceControl(place: string | null | undefined) {
  const devices = useDevices(place);
  const dispatch = useSampleDispatch();
  const control = async (id: string, req: DeviceControlReq): Promise<ControlResult> => {
    const result = await devices.controlDevice(id, req);
    if (result.ok) return result;
    if (result.reason === 'pin') router.push({ pathname: '/pin', params: { id } });
    else if (result.reason === 'confirm') router.push({ pathname: '/buka-kunci', params: { id } });
    else dispatch({ type: 'showToast', text: result.message });
    return result;
  };
  return { ...devices, control };
}
