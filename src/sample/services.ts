import type { OrbitNode } from '@/ui/orbit/types';
import type { Service } from './types';

export const initialServices: Service[] = [
  {
    id: 'gcal',
    name: 'Google Kalender',
    icon: 'calendar',
    status: 'Aktif · terakhir dibaca 5 menit lalu',
    permission: 'act',
    reachable: true,
    ringKey: 'gcal',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'mail',
    status: 'Aktif · terakhir dibaca 2 menit lalu',
    permission: 'act',
    reachable: true,
    ringKey: 'gmail',
  },
  {
    id: 'wa',
    name: 'WhatsApp',
    icon: 'chat',
    status: 'Aktif · pesan masuk langsung terbaca',
    permission: 'act',
    reachable: true,
    ringKey: 'wa',
  },
  {
    id: 'moka',
    name: 'Moka',
    icon: 'receipt',
    status: 'Aktif · terakhir dibaca 1 menit lalu',
    permission: 'read',
    reachable: true,
    ringKey: 'kasir',
  },
  {
    id: 'bca',
    name: 'Mutasi rekening BCA',
    icon: 'bank',
    status: 'Aktif · terakhir dibaca 10 menit lalu',
    permission: 'read',
    reachable: true,
    ringKey: 'bank',
  },
  {
    id: 'kotak',
    name: 'Kotak Sekretaris AI',
    icon: 'box',
    status: 'Aktif · di ruang tamu',
    permission: 'act',
    reachable: true,
  },
  {
    id: 'imou',
    name: 'Imou · CCTV',
    icon: 'camera',
    status: 'Tidak terjangkau sejak 10.12',
    permission: 'read',
    reachable: false,
    ringKey: 'cctv',
  },
];

/** Cincin Beranda: tujuh simpul awal, sama dengan desain 1a. */
export const initialRing: OrbitNode[] = [
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  { key: 'gmail', icon: 'mail', label: 'Gmail' },
  { key: 'wa', icon: 'chat', label: 'WhatsApp' },
  { key: 'ac', icon: 'snow', label: 'AC kamar' },
  { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
  { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
  { key: 'bank', icon: 'bank', label: 'Bank' },
];

/** Layanan yang bisa disambungkan (desain 2h), dengan simpul cincin dan keadaan setelah tersambung. */
export const serviceCatalog: Record<string, { service: Omit<Service, 'ringKey'>; node: OrbitNode }> = {
  m365: {
    service: {
      id: 'm365',
      name: 'Microsoft 365',
      icon: 'mail',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'm365', icon: 'mail', label: 'Microsoft 365' },
  },
  notion: {
    service: {
      id: 'notion',
      name: 'Notion',
      icon: 'note',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'notion', icon: 'note', label: 'Notion' },
  },
  rapat: {
    service: {
      id: 'rapat',
      name: 'Pencatat rapat Zoom, Meet, Teams',
      icon: 'camera',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'rapat', icon: 'camera', label: 'Pencatat rapat' },
  },
  plaud: {
    service: {
      id: 'plaud',
      name: 'Plaud',
      icon: 'mic',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'plaud', icon: 'mic', label: 'Plaud' },
  },
  github: {
    service: {
      id: 'github',
      name: 'GitHub',
      icon: 'globe',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'github', icon: 'globe', label: 'GitHub' },
  },
  tiktok: {
    service: {
      id: 'tiktok',
      name: 'TikTok Shop & Tokopedia',
      icon: 'bag',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'tiktok', icon: 'bag', label: 'TikTok Shop' },
  },
  accurate: {
    service: {
      id: 'accurate',
      name: 'Accurate',
      icon: 'bank',
      status: 'Aktif · baru tersambung',
      permission: 'read',
      reachable: true,
    },
    node: { key: 'accurate', icon: 'bank', label: 'Accurate' },
  },
};
