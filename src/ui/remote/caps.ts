import { AC_MAX, AC_MIN } from '@/api/constants';
import type { Capability, CapabilityOption, Device, RemoteKey } from '@/api/contract';
import type { IconName } from '../icons';

export type Cap<T extends Capability['type']> = Extract<Capability, { type: T }>;

const POWER: Capability = { type: 'power' };
const LEGACY_MODES: CapabilityOption[] = ['Dingin', 'Kering', 'Kipas', 'Otomatis'].map((id) => ({ id, label: id }));
const LEGACY_FANS: CapabilityOption[] = ['Pelan', 'Sedang', 'Kencang', 'Otomatis'].map((id) => ({ id, label: id }));

/**
 * Kemampuan perangkat untuk remote. Server lama tanpa `capabilities` (kosong): disusun dari jenis dan bidang datar lama
 * (`ac`, `level`), seperti aplikasi sebelum remote virtual.
 */
export function capsOf(d: Device): Capability[] {
  if (d.capabilities.length > 0) return d.capabilities;
  switch (d.kind) {
    case 'ac':
      return [
        POWER,
        { type: 'temperature', min: AC_MIN, max: AC_MAX, step: 1, unit: 'C' },
        { type: 'mode', options: LEGACY_MODES },
        { type: 'fan', options: LEGACY_FANS },
      ];
    case 'lamp':
      return d.level !== undefined ? [POWER, { type: 'brightness', min: 0, max: 100 }] : [POWER];
    case 'lock':
      return [{ type: 'lock' }];
    case 'camera':
      return [POWER, { type: 'camera' }];
    case 'box':
    case 'sensor':
      return [];
    default:
      return [POWER];
  }
}

/** Satu kemampuan dengan bentuknya, atau `undefined`. */
export function capOf<T extends Capability['type']>(d: Device, type: T): Cap<T> | undefined {
  return capsOf(d).find((c): c is Cap<T> => c.type === type);
}

/** Tombol remote yang dimiliki perangkat (kemampuan `keys`). */
export function hasKey(d: Device, key: RemoteKey): boolean {
  return capOf(d, 'keys')?.keys.includes(key) ?? false;
}

export type RemoteKind =
  'ac' | 'tv' | 'speaker' | 'lamp' | 'fan' | 'plug' | 'curtain' | 'lock' | 'camera' | 'sensor' | 'box' | 'basic';

const BY_KIND: Partial<Record<Device['kind'], RemoteKind>> = {
  ac: 'ac',
  tv: 'tv',
  speaker: 'speaker',
  lamp: 'lamp',
  fan: 'fan',
  plug: 'plug',
  curtain: 'curtain',
  lock: 'lock',
  camera: 'camera',
  sensor: 'sensor',
  box: 'box',
};

/** Tata letak remote: menurut jenis; jenis yang belum dikenal menurut kemampuannya; tanpa petunjuk: daya saja. */
export function remoteKindOf(d: Device): RemoteKind {
  const byKind = BY_KIND[d.kind];
  if (byKind) return byKind;
  const has = (t: Capability['type']) => capOf(d, t) !== undefined;
  if (has('lock')) return 'lock';
  if (has('camera')) return 'camera';
  if (has('temperature')) return 'ac';
  if (has('keys')) return 'tv';
  if (has('playback')) return 'speaker';
  if (has('brightness')) return 'lamp';
  if (has('position')) return 'curtain';
  if (has('energy')) return 'plug';
  if (has('fan')) return 'fan';
  if (has('sensor')) return 'sensor';
  return 'basic';
}

const lc = (o: CapabilityOption) => `${o.id} ${o.label}`.toLowerCase();

/** Ikon mode AC dari id/labelnya; mode asing tanpa ikon khusus memakai kilau. */
export function modeIcon(o: CapabilityOption): IconName {
  const t = lc(o);
  if (/dingin|cool/.test(t)) return 'snow';
  if (/kering|dry/.test(t)) return 'drop';
  if (/kipas|fan/.test(t)) return 'fan';
  if (/otomatis|auto/.test(t)) return 'auto';
  if (/panas|heat/.test(t)) return 'sun';
  return 'sparkle';
}

/** Warna busur dial: biru langit selagi mendinginkan (detail), hangat saat memanas, hijau selain itu. */
export function arcFor(mode: CapabilityOption | undefined): 'cool' | 'warm' | 'brand' {
  if (!mode) return 'cool';
  const t = lc(mode);
  if (/dingin|cool|kering|dry/.test(t)) return 'cool';
  if (/panas|heat/.test(t)) return 'warm';
  return 'brand';
}

export const isAutoOption = (o: CapabilityOption) => /otomatis|auto/.test(lc(o));

/** Pilihan kipas dengan "Otomatis" di depan (seperti papan): sisanya berurutan pelan → kencang. */
export function fanOrder(options: readonly CapabilityOption[]): CapabilityOption[] {
  return [...options.filter(isAutoOption), ...options.filter((o) => !isAutoOption(o))];
}

/** Pilihan timer dalam batas `maxMinutes`, dengan "Tanpa timer" di depan. */
export function timerChoices(maxMinutes: number): { id: string; label: string }[] {
  const steps = [30, 60, 120, 240, 480, 720].filter((m) => m <= maxMinutes);
  return [
    { id: '0', label: 'Tanpa timer' },
    ...steps.map((m) => ({ id: String(m), label: m < 60 ? `${m} menit` : `${m / 60} jam` })),
  ];
}

/** Jam mati sendiri ("22.00") dari sisa menit timer, atau "Mati" tanpa timer. */
export function timerValue(minutes: number | undefined, now: Date = new Date()): string {
  if (!minutes) return 'Mati';
  const at = new Date(now.getTime() + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getHours())}.${pad(at.getMinutes())}`;
}
