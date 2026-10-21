import type { Box, Device, DeviceKind } from '@/api/contract';
import { canSwitch, deviceStateOf } from '@/api/devices';
import { iconOr, type IconName } from '../icons';

const KIND_ICON: Partial<Record<DeviceKind, IconName>> = {
  ac: 'snow',
  tv: 'tv',
  lamp: 'bulb',
  speaker: 'speaker',
  fan: 'fan',
  plug: 'bolt',
  lock: 'lock',
  camera: 'camera',
  curtain: 'curtain',
  sensor: 'thermo',
  box: 'box',
};

/** Ikon perangkat menurut jenisnya; jenis lain memakai ikon dari server (atau bola lampu). Kunci terbuka: gembok terbuka. */
export function deviceIcon(d: Device): IconName {
  if (d.kind === 'lock' && !isLocked(d)) return 'unlock';
  return KIND_ICON[d.kind] ?? iconOr(d.icon, 'bulb');
}

/** Angka dengan koma desimal ("27,5"), paling banyak satu angka di belakang koma. */
export function decimal(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

export function isLocked(d: Device): boolean {
  return deviceStateOf(d).locked ?? d.on;
}

/** Kamera sedang merekam (bukan mode privasi). */
export function isRecording(d: Device): boolean {
  const s = deviceStateOf(d);
  return s.privacy !== undefined ? !s.privacy : d.on;
}

/** Label pilihan (`mode`, `fan`, `source`) dari id-nya; tanpa kemampuan: id-nya sendiri. */
function optionLabel(d: Device, type: 'mode' | 'fan' | 'source', id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  const cap = d.capabilities.find((c) => c.type === type);
  const found = cap && 'options' in cap ? cap.options.find((o) => o.id === id) : undefined;
  return found?.label ?? id;
}

/**
 * Satu atau dua kata keadaan di ubin Perangkat: "Dingin", "80%", "Vol 18", "Memutar", "Terkunci", "Mati", "Terputus".
 * Suhu AC tampil sebagai angka besar di ubinnya sendiri (lihat {@link wideTemp}).
 */
export function tileWord(d: Device): string {
  if (!d.reachable) return 'Terputus';
  const s = deviceStateOf(d);
  switch (d.kind) {
    case 'lock':
      return isLocked(d) ? 'Terkunci' : 'Terbuka';
    case 'camera':
      return isRecording(d) ? 'Merekam' : 'Mati';
    case 'curtain': {
      const p = s.position;
      if (p === undefined) return d.on ? 'Terbuka' : 'Tertutup';
      return p <= 0 ? 'Tertutup' : p >= 100 ? 'Terbuka' : `${p}%`;
    }
    case 'sensor':
      return sensorWord(d) ?? d.status;
  }
  if (!(s.on ?? d.on)) return 'Mati';
  switch (d.kind) {
    case 'ac':
      return optionLabel(d, 'mode', s.mode) ?? (s.temp !== undefined ? `${s.temp}°` : 'Nyala');
    case 'lamp':
      return s.brightness !== undefined ? `${s.brightness}%` : 'Nyala';
    case 'tv':
      return s.muted ? 'Bisu' : s.volume !== undefined ? `Vol ${s.volume}` : 'Nyala';
    case 'speaker':
      return s.playing === undefined ? 'Nyala' : s.playing ? 'Memutar' : 'Jeda';
    case 'plug':
      return s.powerW !== undefined ? `${decimal(s.powerW)} W` : 'Nyala';
    default:
      return 'Nyala';
  }
}

/** Bacaan sensor pertama dengan satuannya ("27,5°"), atau suhu ruangan. */
function sensorWord(d: Device): string | undefined {
  const s = deviceStateOf(d);
  const cap = d.capabilities.find((c) => c.type === 'sensor');
  const first = cap?.type === 'sensor' ? cap.readings.find((r) => s.readings?.[r.id] !== undefined) : undefined;
  if (first) return `${decimal(s.readings![first.id]!)}${unitText(first.unit)}`;
  if (s.roomTemp !== undefined) return `${decimal(s.roomTemp)}°`;
  return undefined;
}

/** Satuan siap tempel: "°C" ditulis "°", persen dan lainnya apa adanya (dengan spasi untuk satuan berhuruf). */
export function unitText(unit: string): string {
  if (unit === '°C' || unit === 'C' || unit === '°') return '°';
  if (unit === '%' || unit === '') return unit;
  return ` ${unit}`;
}

/** Suhu AC menyala untuk ubin lebar (angka 56); selain itu `undefined`. */
export function wideTemp(d: Device): number | undefined {
  if (d.kind !== 'ac' || !d.reachable || !d.on) return undefined;
  return deviceStateOf(d).temp;
}

/**
 * Ketuk ubin langsung menyalakan/mematikan: hanya perangkat terjangkau yang punya daya dan tidak dijaga. Kunci, kamera,
 * perangkat yang dijaga, Kotak, sensor, dan tirai dibuka remote-nya (aksi yang dijaga tetap lewat PIN atau "buka kunci?").
 */
export function tileToggles(d: Device): boolean {
  if (!d.reachable || d.sensitive) return false;
  if (d.kind === 'lock' || d.kind === 'camera' || d.kind === 'box' || d.kind === 'sensor' || d.kind === 'curtain')
    return false;
  return canSwitch(d);
}

/** Ubin menyala (hijau): perangkat terjangkau yang nyala; kunci yang terkunci tetap netral (aman, bukan menyala). */
export function tileOn(d: Device): boolean {
  if (!d.reachable || d.kind === 'lock' || d.kind === 'sensor') return false;
  if (d.kind === 'camera') return isRecording(d);
  return d.on;
}

/** Keadaan Kotak di ubinnya: "Mic nyala", "Mic mati", atau "Terputus". */
export function boxWord(box: Box): string {
  if (!box.online) return 'Terputus';
  return box.micOn ? 'Mic nyala' : 'Mic mati';
}
