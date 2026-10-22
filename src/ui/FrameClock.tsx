import { useFrameCallback, type FrameInfo } from 'react-native-reanimated';

/**
 * Jam frame di utas UI yang hidup tepat selama komponen ini terpasang. Pasang hanya saat gerak berjalan
 * (`{running ? <FrameClock onFrame={tick} /> : null}`): jeda = lepas, lanjut = pasang lagi. Tidak pernah memanggil
 * `setActive`, jadi registri Reanimated hanya melihat "daftar + nyalakan" saat dipasang dan "hapus" saat dilepas, untuk
 * id yang memang terdaftar. (Di build rilis kesalahan di utas UI menutup paksa aplikasi; lihat __tests__/jam-frame.)
 *
 * `onFrame` harus worklet yang stabil: `useCallback` yang hanya bergantung pada nilai stabil (shared value, fungsi
 * pelapor yang stabil). Masukan yang berubah dibaca dari shared value di dalam worklet, jadi render ulang tidak
 * mendaftar ulang jam. Keadaan gerak disimpan di shared value pemanggil, jadi setelah jeda gerak berlanjut dari tempatnya;
 * frame pertama setelah dipasang memberi `timeSincePreviousFrame: null` (pemanggil membatasinya, mis. `frameSeconds`).
 */
export function FrameClock({ onFrame }: { onFrame: (info: FrameInfo) => void }) {
  useFrameCallback(onFrame, true);
  return null;
}
