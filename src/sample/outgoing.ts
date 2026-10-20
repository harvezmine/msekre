import type { NewDraft, Outgoing } from './types';

/** Kiriman contoh: balasan untuk Pak Budi soal harga sewa (desain 1a, 1b). */
export const BUDI_DRAFT_ID = 'o-budi';

export const initialOutgoing: Record<string, Outgoing> = {
  [BUDI_DRAFT_ID]: {
    id: BUDI_DRAFT_ID,
    to: 'Pak Budi',
    channel: 'WhatsApp',
    what: 'balasan',
    text: 'Selamat siang, Pak Budi. Untuk sewa tempatnya, kami bisa di harga Rp15 juta. Terima kasih.',
    status: 'draft',
    ask: 'Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?',
    sentAt: '10.42',
    heldUntil: '10.47',
  },
};

/** Draf pesanan ke supplier dari "Pesan lagi" di Usaha (desain 2g). */
export const supplierOrderDraft: NewDraft = {
  to: 'PT Sumber Susu',
  channel: 'WhatsApp',
  what: 'pesanan',
  text: 'Selamat siang, PT Sumber Susu. Kami mau pesan lagi Susu UHT 20 karton untuk kiriman Selasa. Terima kasih.',
};
