import { useEffect, useSyncExternalStore } from 'react';
import type { Box, Device, DevicesRes, Room, Routine } from './contract';
import { useDevicesControllerOptional } from './DevicesProvider';
import { findDevice, type DevicesController, type DevicesState, type DevicesStatus } from './devicesController';

export interface DevicesApi {
  /** Jawaban terakhir untuk tempat ini, atau `null` sebelum yang pertama. */
  data: DevicesRes | null;
  devices: Device[];
  rooms: Room[];
  routines: Routine[];
  box: Box | null;
  status: DevicesStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Muat ulang ("Coba lagi"). */
  retry: () => Promise<void>;
  /** Perangkat dengan `id` di cache tempat mana pun. */
  find: (id: string) => Device | undefined;
  /** Atur perangkat, dengan keadaan layar diubah lebih dulu dan dikembalikan kalau gagal. */
  controlDevice: DevicesController['controlDevice'];
  /** Seperti `controlDevice`, untuk nilai kontinu: nilai akhir dikirim ~400 ms setelah perubahan terakhir. */
  controlDeviceDebounced: DevicesController['controlDeviceDebounced'];
  /** Kirim sekarang nilai yang menunggu (saat layar ditutup). */
  flushPending: DevicesController['flush'];
  runRoutine: DevicesController['runRoutine'];
  setBoxMic: DevicesController['setBoxMic'];
}

const EMPTY: DevicesState = { entries: {} };
const NONE: never[] = [];
const noSubscribe = () => () => {};
const noState = () => EMPTY;

/**
 * Perangkat satu tempat untuk layar: dari pengendali bersama di {@link DevicesProvider} (`GET /devices?place=`, event
 * `device`), sama di mode `contoh` dan `server`. `place` kosong (belum diketahui) tidak memuat apa-apa. Di luar provider
 * hasilnya kosong.
 */
export function useDevices(place: string | null | undefined): DevicesApi {
  const controller = useDevicesControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  useEffect(() => {
    if (place && controller) void controller.load(place);
  }, [place, controller]);
  const entry = place ? state.entries[place] : undefined;
  const data = entry?.data ?? null;
  return {
    data,
    devices: data?.devices ?? NONE,
    rooms: data?.rooms ?? NONE,
    routines: data?.routines ?? NONE,
    box: data?.box ?? null,
    status: entry?.status ?? 'loading',
    error: entry?.error ?? null,
    retry: place && controller ? () => controller.load(place) : async () => {},
    find: (id) => findDevice(state, id),
    controlDevice: controller?.controlDevice ?? (async () => ({ ok: false, reason: 'error', message: '' })),
    controlDeviceDebounced:
      controller?.controlDeviceDebounced ?? (async () => ({ ok: false, reason: 'error', message: '' })),
    flushPending: controller?.flush ?? (async () => {}),
    runRoutine: controller?.runRoutine ?? (async () => ({ ok: false, message: '' })),
    setBoxMic: controller?.setBoxMic ?? (async () => null),
  };
}
