/**
 * Apakah layar chat sedang terbuka dan terlihat. Diisi `app/chat.tsx`, dibaca penangan notifikasi (usePush.ts):
 * selagi chat terbuka, balasan sudah tampil di layar, jadi notifikasinya diredam.
 */
let chatFocused = false;

export function setChatFocused(focused: boolean) {
  chatFocused = focused;
}

export function isChatFocused(): boolean {
  return chatFocused;
}
