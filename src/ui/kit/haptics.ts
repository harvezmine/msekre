import * as Haptics from 'expo-haptics';

/**
 * Getar halus (§4 spesifikasi):
 * - `selection`: sakelar, segmen, langkah dial/penggeser;
 * - `light`: tombol remote;
 * - `medium`: tombol daya, mulai tahan Inti;
 * - `success`: Kirim.
 * Getar tetap jalan walau "kurangi gerakan" aktif. Getar hanya hiasan: HP tanpa penggetar, izin getar yang tidak ada,
 * atau modul native yang menolak tidak pernah mengganggu sentuhan yang memanggilnya.
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'none';

function start(kind: HapticKind | undefined): Promise<void> | undefined {
  switch (kind) {
    case 'selection':
      return Haptics.selectionAsync();
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    default:
      return undefined;
  }
}

export function haptic(kind: HapticKind | undefined): void {
  try {
    void start(kind)?.catch(() => {});
  } catch {
    // Getar gagal: tidak apa-apa.
  }
}
