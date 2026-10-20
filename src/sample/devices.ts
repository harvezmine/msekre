import type { Device } from './types';

/** AC utama: kartu Rumah di Beranda, kartu AC di chat, dan Mode Suara ("Matikan AC kamar"). */
export const MAIN_AC_ID = 'ac-kamar';
/** Batas suhu AC. Penyimpanan membatasi setiap perubahan ke rentang ini. */
export const AC_MIN = 16;
export const AC_MAX = 30;
/** Baris kartu Rumah di Beranda, berurutan (desain 1a). */
export const HOME_CARD_DEVICES = [MAIN_AC_ID, 'pintu-depan', 'kamera-tamu'];

const dev = (d: Device): Device => d;

/** Perangkat contoh: desain 2c untuk Rumah, ditambah beberapa untuk tiap kedai. */
export const initialDevices: Device[] = [
  dev({
    id: 'lampu-utama',
    place: 'Rumah',
    room: 'Ruang tamu',
    name: 'Lampu utama',
    icon: 'bulb',
    kind: 'lampu',
    on: true,
    level: 80,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'lampu-sudut',
    place: 'Rumah',
    room: 'Ruang tamu',
    name: 'Lampu sudut',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: false,
    unreachableSince: '10.12',
    via: 'cloud',
  }),
  dev({
    id: 'kamera-tamu',
    place: 'Rumah',
    room: 'Ruang tamu',
    name: 'Kamera ruang tamu',
    short: 'Kamera',
    icon: 'camera',
    kind: 'kamera',
    on: true,
    reachable: true,
    via: 'cloud',
    needsPin: true,
  }),
  dev({
    id: 'pintu-depan',
    place: 'Rumah',
    room: 'Ruang tamu',
    name: 'Pintu depan',
    icon: 'lock',
    kind: 'kunci',
    on: true,
    reachable: true,
    via: 'cloud',
    needsPin: true,
  }),
  dev({
    id: MAIN_AC_ID,
    place: 'Rumah',
    room: 'Kamar',
    name: 'AC kamar',
    icon: 'snow',
    kind: 'ac',
    on: true,
    ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' },
    roomTemp: 27,
    ring: { key: 'ac', icon: 'snow', label: 'AC kamar' },
    brand: 'LG',
    reachable: true,
    via: 'ir',
  }),
  dev({
    id: 'lampu-kamar',
    place: 'Rumah',
    room: 'Kamar',
    name: 'Lampu kamar',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'lampu-dapur',
    place: 'Rumah',
    room: 'Dapur',
    name: 'Lampu dapur',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'lampu-teras',
    place: 'Rumah',
    room: 'Teras',
    name: 'Lampu teras',
    icon: 'bulb',
    kind: 'lampu',
    on: true,
    reachable: true,
    via: 'cloud',
  }),

  dev({
    id: 'dago-lampu',
    place: 'Kedai Dago',
    room: 'Dalam kedai',
    name: 'Lampu kedai',
    icon: 'bulb',
    kind: 'lampu',
    on: true,
    level: 100,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'dago-ac',
    place: 'Kedai Dago',
    room: 'Dalam kedai',
    name: 'AC kedai',
    icon: 'snow',
    kind: 'ac',
    on: true,
    ac: { temp: 23, mode: 'Dingin', fan: 'Otomatis' },
    roomTemp: 28,
    brand: 'Daikin',
    reachable: true,
    via: 'ir',
  }),
  dev({
    id: 'dago-lampu-depan',
    place: 'Kedai Dago',
    room: 'Depan',
    name: 'Lampu depan',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'dago-cctv',
    place: 'Kedai Dago',
    room: 'Kasir',
    name: 'CCTV kasir',
    icon: 'camera',
    kind: 'kamera',
    on: true,
    reachable: true,
    via: 'cloud',
    needsPin: true,
  }),

  dev({
    id: 'riau-lampu',
    place: 'Kedai Riau',
    room: 'Dalam kedai',
    name: 'Lampu kedai',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'riau-ac',
    place: 'Kedai Riau',
    room: 'Dalam kedai',
    name: 'AC kedai',
    icon: 'snow',
    kind: 'ac',
    on: false,
    ac: { temp: 25, mode: 'Dingin', fan: 'Otomatis' },
    roomTemp: 29,
    brand: 'Panasonic',
    reachable: true,
    via: 'ir',
  }),
  dev({
    id: 'riau-lampu-gudang',
    place: 'Kedai Riau',
    room: 'Gudang',
    name: 'Lampu gudang',
    icon: 'bulb',
    kind: 'lampu',
    on: false,
    reachable: true,
    via: 'cloud',
  }),
  dev({
    id: 'riau-cctv',
    place: 'Kedai Riau',
    room: 'Kasir',
    name: 'CCTV kasir',
    icon: 'camera',
    kind: 'kamera',
    on: true,
    reachable: true,
    via: 'cloud',
    needsPin: true,
  }),
];

/** Suhu AC dibulatkan dan dibatasi 16–30. */
export function clampTemp(t: number): number {
  return Math.min(AC_MAX, Math.max(AC_MIN, Math.round(t)));
}

/** Tulisan keadaan di ubin dan kartu: "Nyala · 80%", "Nyala · 24°", "Terkunci", "Merekam", "Tidak terjangkau sejak 10.12". */
export function deviceStatus(d: Device): string {
  if (!d.reachable) return d.unreachableSince ? `Tidak terjangkau sejak ${d.unreachableSince}` : 'Tidak terjangkau';
  switch (d.kind) {
    case 'ac':
      return d.on ? (d.ac ? `Nyala · ${d.ac.temp}°` : 'Nyala') : 'Mati';
    case 'lampu':
      return d.on ? (d.level !== undefined ? `Nyala · ${d.level}%` : 'Nyala') : 'Mati';
    case 'kamera':
      return d.on ? 'Merekam' : 'Mati';
    case 'kunci':
      return d.on ? 'Terkunci' : 'Terbuka';
    default:
      return d.on ? 'Nyala' : 'Mati';
  }
}

/** Kalimat satu baris di kartu Rumah Beranda: "AC kamar nyala · 24°", "Pintu depan terkunci", "Kamera aktif". */
export function houseLine(d: Device): string {
  const name = d.short ?? d.name;
  if (!d.reachable) return `${name} tidak terjangkau`;
  switch (d.kind) {
    case 'ac':
      return d.on ? `${name} nyala${d.ac ? ` · ${d.ac.temp}°` : ''}` : `${name} mati`;
    case 'kunci':
      return `${name} ${d.on ? 'terkunci' : 'terbuka'}`;
    case 'kamera':
      return `${name} ${d.on ? 'aktif' : 'mati'}`;
    default:
      return `${name} ${d.on ? 'nyala' : 'mati'}`;
  }
}

/** Isi kartu Kotak Sekretaris AI di Perangkat (Ruang tamu, Rumah): data contoh. */
export const BOX = { speaker: 'JBL Ruang Tamu', temp: 27, humidity: 68 } as const;

/** Merek di "Tambah perangkat" (desain 2f): monogram dan nama. */
export const BRANDS = [
  { m: 'LG', n: 'LG' },
  { m: 'S', n: 'Samsung SmartThings' },
  { m: 'Hue', n: 'Philips Hue' },
  { m: 'A', n: 'Aqara' },
  { m: 'eW', n: 'eWeLink / Sonoff' },
  { m: 'I', n: 'Imou' },
  { m: 'EZ', n: 'EZVIZ' },
  { m: 'T', n: 'Tuya' },
  { m: 'HA', n: 'Home Assistant' },
] as const;

/** PIN contoh Fase 0b. PIN sungguhan diatur dan diperiksa di Fase 3. */
export const SAMPLE_PIN = '123456';
export const PIN_LENGTH = 6;
