/**
 * Kalimat contoh untuk Mode Suara di server tiruan. Server tiruan tidak mengerti suara: tiap kali pengguna menahan Inti
 * dan melepas, ia "mendengar" kalimat berikutnya dari daftar ini (berputar). Kalimat yang diketik dipakai apa adanya.
 * Kalimat dengan "bayar", "token", atau "kirim ke" memunculkan kartu konfirmasi, tidak dijalankan lewat suara saja.
 */
export const VOICE_UTTERANCES: readonly string[] = [
  'Matikan AC kamar.',
  'Bayar token listrik seratus ribu.',
  'Kirim ke Pak Budi, saya terlambat lima belas menit.',
];

/** Lama hening balasan suara contoh (ms). */
export const VOICE_SAMPLE_REPLY_MS = 700;
