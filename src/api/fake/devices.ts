import { BOX, deviceStatus } from '@/sample/devices';
import type { SampleState } from '@/sample/reducer';
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

export const routinesFrom = (): Routine[] =>
  ROUTINES.map((r) => ({ id: r.id, name: r.name, icon: r.icon, summary: r.sub, places: [...r.places] }));

/** `GET /devices` untuk `place` (`Semua` atau satu tempat nyata), dari penyimpanan contoh. */
export function devicesFrom(state: SampleState, place: string): Omit<DevicesRes, 'rev'> {
  const real = PLACES.filter((p) => p !== 'Semua');
  const all = place === 'Semua';
  const devices = state.devices.filter((d) => all || d.place === place).map(toDevice);
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
