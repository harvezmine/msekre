/** Catatan bila Mode Suara belum bisa dipakai akun ini. */
export const VOICE_SOON_TEXT = 'Mode Suara segera hadir.';

/**
 * Kalimat Mode Suara (Beranda dan layar penuh). Pendek, tanpa kode, tanpa "kendala" kecuali penyebabnya sungguh tidak
 * diketahui (`ERROR_TEXT`).
 */
/** Dilepas terlalu cepat (kurang dari 400 ms suara): tidak ada yang dikirim. */
export const SHORT_HOLD_TEXT = 'Tahan sedikit lebih lama';
/** Tidak ada suara yang terbaca (di HP sendiri, atau `tidak_terdengar` dari server). */
export const NOT_HEARD_TEXT = 'Belum terdengar jelas, coba lebih dekat ke HP ya.';
/** Server gagal mengubah ucapan jadi teks (`stt_gagal`). */
export const STT_FAILED_TEXT = 'Suaranya belum bisa saya tangkap, coba sekali lagi ya.';
/** Jawaban terlalu lama (`lama`, `tanpa_jawaban`, atau batas tunggu di HP): balasannya tetap masuk chat. */
export const LATE_TEXT = 'Jawabannya lama, nanti saya kabari di chat.';
/** Ucapan sudah diterima server, tetapi jawabannya tidak bisa lewat sini (sambungan putus, `sudah_ada`). */
export const IN_CHAT_TEXT = 'Jawabannya nanti saya kabari di chat.';
/** Berpikir lebih dari 8 detik. */
export const STILL_WORKING_TEXT = 'Masih saya kerjakan…';
/** Inti ditahan, ucapan belum terbaca. */
export const LISTENING_TEXT = 'Mendengarkan…';
