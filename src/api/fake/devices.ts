import { BOX, deviceStatus } from '@/sample/devices';
import type { SampleAction, SampleState } from '@/sample/reducer';
import { ROUTINES } from '@/sample/routines';
import { PLACES, type Device as SampleDevice, type DeviceKind as SampleKind } from '@/sample/types';
import type { Box, Device, DevicesRes, Routine } from '../contract';

/** Ruangan tetap di Rumah, walau belum ada perangkatnya. */
export const HOME_ROOMS = ['Ruang tamu', 'Kamar', 'Dapur', 'Teras'];
/** Id Kotak Sekretaris AI di contoh. */
export const BOX_ID = 'kotak-ruang-tamu';

const KIND: Record<SampleKind, Device['kind']> = {
  lampu: 'lamp',
  ac: 'ac',
  kamera: 'camera',
  kunci: 'lock',
  speaker: 'other',
  lain: 'other',
};

/** Perangkat kontrak dari perangkat contoh. Tulisan keadaannya dibuat server (di sini: `deviceStatus`). */
export function toDevice(d: SampleDevice): Device {
  return {
    id: d.id,
    place: d.place,
    room: d.room,
    name: d.name,
    ...(d.short ? { short: d.short } : {}),
    icon: d.icon,
    kind: KIND[d.kind],
    on: d.on,
    reachable: d.reachable,
    ...(d.unreachableSince ? { unreachableSince: d.unreachableSince } : {}),
    ...(d.level !== undefined ? { level: d.level } : {}),
    ...(d.ac ? { ac: { ...d.ac } } : {}),
    ...(d.roomTemp !== undefined ? { roomTemp: d.roomTemp } : {}),
    ...(d.brand ? { brand: d.brand } : {}),
    ...(d.via ? { via: d.via } : {}),
    ...(d.needsPin ? { sensitive: true } : {}),
    status: deviceStatus(d),
  };
}

/** Kotak sebagai perangkat di Ruang tamu, supaya aplikasi menaruh kartunya di ruangan yang benar. */
export function boxDevice(): Device {
  return {
    id: BOX_ID,
    place: 'Rumah',
    room: 'Ruang tamu',
    name: 'Kotak Sekretaris AI',
    icon: 'box',
    kind: 'box',
    on: true,
    reachable: true,
    status: 'Aktif',
  };
}

export function boxFrom(state: SampleState): Box {
  return {
    deviceId: BOX_ID,
    online: true,
    micOn: state.boxMic,
    speaker: BOX.speaker,
    roomTemp: BOX.temp,
    humidity: BOX.humidity,
  };
}

/**
 * Aturan rutinitas: tidak pernah berisi membuka kunci, mematikan kamera, atau mematikan alarm (aksi yang dijaga). Server
 * memeriksanya saat rutinitas dibuat; di server tiruan, aksi seperti itu dibuang saat dijalankan dan disebut di
 * `summary`. Mengunci dan menghidupkan kamera tidak dijaga. Mengembalikan aksi yang boleh dan nama perangkat yang dilewati.
 */
export function withoutGuardedActions(
  actions: SampleAction[],
  state: SampleState,
): { allowed: SampleAction[]; skipped: string[] } {
  const allowed: SampleAction[] = [];
  const skipped: string[] = [];
  for (const action of actions) {
    const device =
      action.type === 'toggleDevice' || action.type === 'setLevel'
        ? state.devices.find((d) => d.id === action.id)
        : action.type === 'setAc'
          ? state.devices.find((d) => d.id === action.deviceId)
          : undefined;
    const turnsOff = (action.type === 'toggleDevice' && !action.on) || (action.type === 'setAc' && action.on === false);
    if (device?.needsPin && turnsOff) skipped.push(device.name);
    else allowed.push(action);
  }
  return { allowed, skipped };
}

export const routinesFrom = (): Routine[] =>
  ROUTINES.map((r) => ({ id: r.id, name: r.name, icon: r.icon, summary: r.sub, places: [...r.places] }));

/** `GET /devices` untuk `place` (`Semua` atau satu tempat nyata), dari penyimpanan contoh. */
export function devicesFrom(state: SampleState, place: string): Omit<DevicesRes, 'rev'> {
  const real = PLACES.filter((p) => p !== 'Semua');
  const all = place === 'Semua';
  const devices = state.devices.filter((d) => all || d.place === place).map(toDevice);
  // Kotak ikut sebagai perangkat berjenis `box` di ruangannya (kartunya digambar dari `box`, bukan ubin).
  if (all || place === 'Rumah') devices.push(boxDevice());
  const rooms = (all ? real : real.filter((p) => p === place)).flatMap((p) => {
    const names = p === 'Rumah' ? HOME_ROOMS : [...new Set(devices.filter((d) => d.place === p).map((d) => d.room))];
    return names.map((name) => ({ place: p as string, name }));
  });
  return {
    place,
    places: [...real],
    rooms,
    devices,
    box: all || place === 'Rumah' ? boxFrom(state) : null,
    routines: routinesFrom(),
  };
}
