import type { Device, DeviceCard, DeviceControlReq, DeviceKind, DeviceState } from './contract';

/** Jenis perangkat yang sakelar nyala-matinya boleh tampil di kartu bila tidak dijaga. */
export const SWITCHABLE_KINDS: readonly DeviceKind[] = ['lamp', 'ac', 'plug', 'tv', 'fan'];

/**
 * Keadaan terstruktur perangkat, juga dari server lama yang hanya mengirim bidang datar (`on`, `level`, `ac`,
 * `roomTemp`). `state` dari server menang atas bidang datar.
 */
export function deviceStateOf(d: Device): DeviceState {
  const legacy: DeviceState = { on: d.on };
  if (d.ac) Object.assign(legacy, { temp: d.ac.temp, mode: d.ac.mode, fan: d.ac.fan });
  if (d.level !== undefined) legacy.brightness = d.level;
  if (d.roomTemp !== undefined) legacy.roomTemp = d.roomTemp;
  if (d.kind === 'lock') legacy.locked = d.on;
  if (d.kind === 'camera') legacy.privacy = !d.on;
  return { ...legacy, ...d.state };
}

/**
 * Sakelar nyala-mati boleh tampil di ubin: perangkat yang punya daya, kunci, atau kamera. Server lama tanpa
 * `capabilities` (kosong): semua perangkat seperti dulu.
 */
export function canSwitch(d: Device): boolean {
  return d.capabilities.length === 0 || d.capabilities.some((c) => c.type === 'power' || c.type === 'lock');
}

/** Bidang yang berubah terus selama jari menggeser; dikirim sekali setelah berhenti (lihat `controlDeviceDebounced`). */
export const CONTINUOUS_FIELDS = ['temp', 'brightness', 'level', 'volume', 'position', 'colorTemp'] as const;
/** Perintah yang hanya berisi nilai kontinu (boleh digabung dan ditunda). */
export function isContinuousRequest(req: DeviceControlReq): boolean {
  const keys = Object.entries(req)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
  return keys.length > 0 && keys.every((k) => (CONTINUOUS_FIELDS as readonly string[]).includes(k));
}

/** Aksi yang dijaga PIN: mematikan, membuka kunci, atau menutup lensa kamera (privasi). */
export function isGuardedAction(req: DeviceControlReq): boolean {
  return req.on === false || req.locked === false || req.privacy === true;
}

/**
 * Kartu perangkat untuk chat dari perangkat yang sama dengan yang dilihat Perangkat dan Beranda. Server asli dan server
 * tiruan memakai bentuk ini, supaya kartu di chat dan layar Perangkat sepakat.
 */
export function cardFromDevice(d: Device): DeviceCard {
  return {
    kind: 'device',
    deviceId: d.id,
    name: d.name,
    on: d.on,
    deviceKind: d.kind,
    // Server tidak pernah menjadikan perangkat yang dijaga bisa dikendalikan dari kartu (lihat `deviceCardSchema`).
    ...(d.sensitive ? { sensitive: true } : {}),
    switchable: !d.sensitive && d.reachable && SWITCHABLE_KINDS.includes(d.kind),
    ...(d.ac ? { temp: d.ac.temp, mode: d.ac.mode } : {}),
    ...(d.roomTemp !== undefined ? { note: `suhu ruangan sekarang ${d.roomTemp}°` } : {}),
  };
}

/**
 * Tulisan keadaan sementara selagi perintah masih dalam perjalanan ke server, dengan kata-kata yang sama dengan server.
 * Begitu server menjawab, tulisan dari server yang dipakai.
 */
export function guessStatus(d: Device): string {
  if (!d.reachable) return d.status;
  switch (d.kind) {
    case 'ac':
      return d.on ? (d.ac ? `Nyala · ${d.ac.temp}°` : 'Nyala') : 'Mati';
    case 'lamp':
      return d.on ? (d.level !== undefined ? `Nyala · ${d.level}%` : 'Nyala') : 'Mati';
    case 'camera':
      return d.on ? 'Merekam' : 'Mati';
    case 'lock':
      return d.on ? 'Terkunci' : 'Terbuka';
    default:
      return d.on ? 'Nyala' : 'Mati';
  }
}

/** Cara kartu perangkat di chat ditampilkan, dari isinya (lihat `deviceCardSchema`). */
export interface CardPresentation {
  kind: DeviceKind;
  /** Dijaga (kunci, kamera, alarm): hanya keadaan dan "Buka di Perangkat"; tanpa sakelar atau pengatur suhu. */
  sensitive: boolean;
  /** Pengatur suhu dan ikon salju: hanya AC yang tidak dijaga. */
  isAc: boolean;
  /** Sakelar nyala-mati: tidak dijaga, dan `switchable` (bila tidak ada: lampu, AC, colokan, TV). */
  switchable: boolean;
  status: string;
}

export function presentCard(card: DeviceCard): CardPresentation {
  // Server lama tanpa `deviceKind`: kartu dengan suhu dibaca AC, selain itu perangkat biasa.
  const kind: DeviceKind = card.deviceKind ?? (card.temp !== undefined ? 'ac' : 'other');
  const sensitive = card.sensitive === true || kind === 'lock' || kind === 'camera';
  const isAc = kind === 'ac' && !sensitive;
  const switchable = !sensitive && (card.switchable ?? SWITCHABLE_KINDS.includes(kind));
  let status: string;
  if (kind === 'lock') status = card.on ? 'Terkunci' : 'Terbuka';
  else if (kind === 'camera') status = card.on ? 'Merekam' : 'Mati';
  else if (!card.on) status = 'Mati';
  else status = `Nyala${isAc && card.mode ? ` · ${card.mode}` : ''}`;
  return { kind, sensitive, isAc, switchable, status };
}
