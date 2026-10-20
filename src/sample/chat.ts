import { BUDI_DRAFT_ID } from './outgoing';
import type { ChatEntry } from './types';

/** Utas chat contoh Fase 0b (desain 1b dan 1c), awal `state.chat`. Di Fase 1 diganti riwayat sungguhan. */
export const initialChat: ChatEntry[] = [
  { id: 't1', kind: 'user', text: 'Nyalakan AC kamar 24 derajat' },
  { id: 't2', kind: 'assistant', text: 'Sudah. AC kamar nyala di 24°.' },
  { id: 't3', kind: 'device', deviceId: 'ac-kamar' },
  { id: 't4', kind: 'user', text: 'Balas Pak Budi, harga sewa bisa Rp15 juta' },
  { id: 't5', kind: 'assistant', text: 'Ini draf balasannya. Saya kirim setelah Anda setuju.' },
  { id: 't6', kind: 'confirm', outgoingId: BUDI_DRAFT_ID },
  { id: 't7', kind: 'assistant', text: 'Rapat dengan supplier susu sudah saya catat.' },
  {
    id: 't8',
    kind: 'notes',
    title: 'Rapat dengan supplier susu',
    when: 'Senin, 20 Okt · 09.00–09.40',
    decisions: [
      'Harga susu UHT tetap sampai Desember.',
      'Pengiriman jadi dua kali seminggu, Selasa dan Jumat.',
      'Kedai Riau dapat 20 karton tiap kiriman.',
    ],
  },
  { id: 't9', kind: 'assistant', text: 'Laporan yang Anda minta sudah jadi.' },
  { id: 't10', kind: 'file', name: 'Laporan penjualan Oktober.xlsx', meta: '48 KB · Excel' },
  { id: 't11', kind: 'user', text: 'Beli token listrik 100 ribu' },
  {
    id: 't12',
    kind: 'token',
    title: 'Token listrik PLN',
    amount: 'Rp100.000',
    meter: '5321 0987 6543',
    owner: 'RINA WULANDARI',
  },
  { id: 't13', kind: 'user', text: 'Ya, benar' },
  { id: 't14', kind: 'qris', amount: 'Rp100.000', until: '10.15' },
  { id: 't15', kind: 'user', text: 'Cek stok kedai' },
  { id: 't16', kind: 'thinking' },
];

/** Kalimat asisten sebelum kartu konfirmasi draf baru: "Ini draf pesanannya. Saya kirim setelah Anda setuju." */
export const draftIntro = (what: string) => `Ini draf ${what}nya. Saya kirim setelah Anda setuju.`;

export const typedReply = 'Ini masih contoh. Mulai Fase 1 saya menjawab sungguhan.';
export const THINK_MS = 1200;
export const ROOM_TEMP = 27;
