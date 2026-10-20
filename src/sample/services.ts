import { MAIN_AC_ID } from './devices';
import type { Service } from './types';

/** Layanan tersambung, desain 2h. */
export const initialServices: Service[] = [
  {
    id: 'gcal',
    name: 'Google Kalender',
    icon: 'calendar',
    note: 'terakhir dibaca 5 menit lalu',
    permission: 'act',
    reachable: true,
    ring: { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'mail',
    note: 'terakhir dibaca 2 menit lalu',
    permission: 'act',
    reachable: true,
    ring: { key: 'gmail', icon: 'mail', label: 'Gmail' },
  },
  {
    id: 'wa',
    name: 'WhatsApp',
    icon: 'chat',
    note: 'pesan masuk langsung terbaca',
    permission: 'act',
    reachable: true,
    ring: { key: 'wa', icon: 'chat', label: 'WhatsApp' },
  },
  {
    id: 'moka',
    name: 'Moka',
    icon: 'receipt',
    note: 'terakhir dibaca 1 menit lalu',
    permission: 'read',
    reachable: true,
    ring: { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
  },
  {
    id: 'bca',
    name: 'Mutasi rekening BCA',
    icon: 'bank',
    note: 'terakhir dibaca 10 menit lalu',
    permission: 'read',
    reachable: true,
    ring: { key: 'bank', icon: 'bank', label: 'Bank' },
  },
  {
    id: 'kotak',
    name: 'Kotak Sekretaris AI',
    icon: 'box',
    note: 'di ruang tamu',
    permission: 'act',
    reachable: true,
  },
  {
    id: 'imou',
    name: 'Imou · CCTV',
    icon: 'camera',
    permission: 'read',
    reachable: false,
    unreachableSince: '10.12',
    ring: { key: 'cctv', icon: 'camera', label: 'CCTV' },
  },
];

export type RingSource = { service: string } | { device: string };

/**
 * Urutan simpul cincin Beranda seperti desain 1a: Google Kalender, Gmail, WhatsApp, AC kamar, CCTV, Kasir, Bank.
 * Layanan lain yang punya simpul (yang disambungkan kemudian) menyusul di belakang, sesuai urutan sambungnya.
 */
export const RING_ORDER: RingSource[] = [
  { service: 'gcal' },
  { service: 'gmail' },
  { service: 'wa' },
  { device: MAIN_AC_ID },
  { service: 'imou' },
  { service: 'moka' },
  { service: 'bca' },
];

const fresh = (s: Omit<Service, 'note' | 'permission' | 'reachable'>): Service => ({
  ...s,
  note: 'baru tersambung',
  permission: 'read',
  reachable: true,
});

/** Layanan yang bisa disambungkan (desain 2h), dalam keadaan setelah tersambung. */
export const serviceCatalog: Record<string, Service> = {
  m365: fresh({
    id: 'm365',
    name: 'Microsoft 365',
    icon: 'mail',
    ring: { key: 'm365', icon: 'mail', label: 'Microsoft 365' },
  }),
  notion: fresh({ id: 'notion', name: 'Notion', icon: 'note', ring: { key: 'notion', icon: 'note', label: 'Notion' } }),
  rapat: fresh({
    id: 'rapat',
    name: 'Pencatat rapat Zoom, Meet, Teams',
    icon: 'camera',
    ring: { key: 'rapat', icon: 'camera', label: 'Pencatat rapat' },
  }),
  plaud: fresh({ id: 'plaud', name: 'Plaud', icon: 'mic', ring: { key: 'plaud', icon: 'mic', label: 'Plaud' } }),
  github: fresh({
    id: 'github',
    name: 'GitHub',
    icon: 'globe',
    ring: { key: 'github', icon: 'globe', label: 'GitHub' },
  }),
  tiktok: fresh({
    id: 'tiktok',
    name: 'TikTok Shop & Tokopedia',
    icon: 'bag',
    ring: { key: 'tiktok', icon: 'bag', label: 'TikTok Shop' },
  }),
  accurate: fresh({
    id: 'accurate',
    name: 'Accurate',
    icon: 'bank',
    ring: { key: 'accurate', icon: 'bank', label: 'Accurate' },
  }),
};
