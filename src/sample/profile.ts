import type { IconName } from '@/ui/icons';
import type { Outgoing } from './types';

/** Pengguna contoh Fase 0b. Di Fase 2 diganti respons /app/v1/home. */
export const user = { name: 'Rina', initials: 'RW' };

export const homeSummary = 'Ada 3 hal yang perlu Anda hari ini.';

export const approvalText = 'Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?';

/** Dua baris lain di kartu Rumah Beranda; AC kamar datang dari penyimpanan. */
export const houseOthers: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'Pintu depan terkunci' },
  { icon: 'camera', text: 'Kamera aktif' },
];

export const initialOutgoing: Outgoing = {
  to: 'Pak Budi',
  channel: 'WhatsApp',
  text: 'Selamat pagi Pak Budi. Soal harga sewa, kami setuju Rp7.500.000 per bulan dengan kontrak dua tahun. Mohon konfirmasinya ya, Pak.',
  status: 'draft',
  heldUntil: '10.47',
  sentAt: '10.42',
};
