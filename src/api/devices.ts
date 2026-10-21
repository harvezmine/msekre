import type { Device, DeviceCard } from './contract';

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
