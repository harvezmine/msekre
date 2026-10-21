import * as Haptics from 'expo-haptics';

/**
 * Getar halus (§4 spesifikasi):
 * - `selection`: sakelar, segmen, langkah dial/penggeser;
 * - `light`: tombol remote;
 * - `medium`: tombol daya, mulai tahan Inti;
 * - `success`: Kirim.
 * Getar tetap jalan walau "kurangi gerakan" aktif.
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'none';

export function haptic(kind: HapticKind | undefined): void {
  switch (kind) {
    case 'selection':
      void Haptics.selectionAsync();
      return;
    case 'light':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'medium':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case 'success':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    default:
      return;
  }
}
