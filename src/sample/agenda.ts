import type { AgendaItem, Leftover } from './types';

/** "Hari ini" dalam data contoh: Senin, 20 Okt 2025 (kalender desain), jam contoh 09.41. */
export const TODAY = '2025-10-20';
export const NOW = '09.41';

export const initialAgenda: AgendaItem[] = [
  {
    id: 'a1',
    date: TODAY,
    time: '09.00',
    title: 'Rapat dengan supplier susu',
    kind: 'meeting',
    note: 'Notulen siap',
    past: true,
  },
  {
    id: 'a2',
    date: TODAY,
    time: '13.00',
    title: 'Bayar listrik Kedai Dago',
    kind: 'reminder',
    way: 'call',
  },
  { id: 'a3', date: TODAY, time: '15.00', title: 'Cek stok Kedai Riau', kind: 'task' },
  {
    id: 'a4',
    date: TODAY,
    time: '16.00',
    title: 'Jemput Kayla les',
    kind: 'recurring',
    way: 'alarm',
    repeat: 'Tiap Senin',
  },
  {
    id: 'a5',
    date: TODAY,
    time: '19.00',
    title: 'Rapat manajer kedai',
    kind: 'meeting',
    note: 'Google Meet',
    repeat: 'Tiap Senin',
  },
  {
    id: 'a6',
    date: '2025-10-21',
    time: '10.00',
    title: 'Telepon Pak Budi soal harga sewa',
    kind: 'reminder',
    way: 'call',
  },
  {
    id: 'a10',
    date: '2025-10-21',
    time: '07.00',
    title: 'Berangkat ke bandara',
    kind: 'reminder',
    way: 'alarm',
    note: 'Penerbangan GA 408 jam 09.15, Terminal 3',
  },
  { id: 'a7', date: '2025-10-22', time: '08.30', title: 'Belanja bahan kedai', kind: 'task' },
  { id: 'a8', date: '2025-10-23', time: '14.00', title: 'Rapat dengan Bu Sari', kind: 'meeting', note: 'Zoom' },
  { id: 'a9', date: '2025-10-24', time: '19.30', title: 'Makan malam keluarga', kind: 'reminder', way: 'alarm' },
  {
    id: 'a11',
    date: '2025-10-26',
    time: '16.00',
    title: 'Jemput Kayla les',
    kind: 'recurring',
    way: 'alarm',
    repeat: 'Tiap Senin',
  },
];

export const initialLeftover: Leftover = { id: 'l1', title: 'Kirim penawaran katering ke Bu Sari' };

/** Pengingat yang dibuka alarm bila tidak ada id (desain 2l). */
export const ALARM_SAMPLE_ID = 'a10';
