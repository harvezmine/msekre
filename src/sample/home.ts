import type { IconName } from '@/ui/icons';
import type { OrbitNode } from '@/ui/orbit/types';

/** Data contoh Fase 0, sama dengan desain 1a. Di Fase 2 diganti respons /app/v1/home. */
export const homeSample = {
  name: 'Rina',
  initials: 'RW',
  place: 'Semua',
  summary: 'Ada 3 hal yang perlu Anda hari ini.',
  nodes: [
    { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
    { key: 'gmail', icon: 'mail', label: 'Gmail' },
    { key: 'wa', icon: 'chat', label: 'WhatsApp' },
    { key: 'ac', icon: 'snow', label: 'AC kamar' },
    { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
    { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
    { key: 'bank', icon: 'bank', label: 'Bank' },
  ] satisfies OrbitNode[],
  approval: 'Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?',
  agenda: [
    { time: '09.00', title: 'Rapat dengan supplier susu' },
    { time: '13.00', title: 'Bayar listrik Kedai Dago' },
    { time: '16.00', title: 'Jemput Kayla les' },
  ],
  house: {
    acOn: true,
    acTemp: 24,
    others: [
      { icon: 'lock', text: 'Pintu depan terkunci' },
      { icon: 'camera', text: 'Kamera aktif' },
    ] satisfies { icon: IconName; text: string }[],
  },
  business: {
    source: 'dari Moka',
    sales: 'Rp4.250.000',
    change: 'naik 12% dari Senin lalu',
    alert: 'Susu UHT tinggal 6 karton',
  },
};
