import type { IconName } from '@/ui/icons';

/** Pengguna contoh Fase 0b. Di Fase 2 diganti respons /app/v1/home. */
export const user = { name: 'Rina', initials: 'RW' };

export const homeSummary = 'Ada 3 hal yang perlu Anda hari ini.';

/** Dua baris lain di kartu Rumah Beranda; AC kamar datang dari penyimpanan. */
export const houseOthers: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'Pintu depan terkunci' },
  { icon: 'camera', text: 'Kamera aktif' },
];
