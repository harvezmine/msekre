import { useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useDataMode } from '@/api/dataMode';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Satu baris di atas layar contoh pada mode akun. */
export const SAMPLE_BANNER_TEXT = 'Contoh — segera tersambung ke akun Anda';

/** Kelompok layar contoh; menutup penanda berlaku untuk satu kelompok (misalnya Perangkat dan semua remote-nya). */
export type SampleArea = 'agenda' | 'perangkat' | 'usaha' | 'terhubung' | 'riwayat' | 'akun';

// Ditutup selama aplikasi hidup (per sesi aplikasi), tidak disimpan di HP.
let dismissed: ReadonlySet<SampleArea> = new Set();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function dismiss(area: SampleArea) {
  dismissed = new Set([...dismissed, area]);
  for (const l of [...listeners]) l();
}

/** Untuk tes: semua penanda tampil lagi. */
export function resetSampleBanners() {
  dismissed = new Set();
  for (const l of [...listeners]) l();
}

/**
 * Penanda tenang di atas layar yang isinya masih contoh pada mode akun (chat dan suara sudah asli, layar ini belum
 * tersambung ke server): satu baris redup, bisa ditutup sampai aplikasi dibuka lagi. Mode contoh dan server: tidak
 * tampil.
 */
export function SampleBanner({ area }: { area: SampleArea }) {
  const { c } = useTheme();
  const { hybrid } = useDataMode();
  const hidden = useSyncExternalStore(subscribe, () => dismissed.has(area));
  if (!hybrid || hidden) return null;
  return (
    <View
      testID="penanda-contoh"
      style={{
        marginHorizontal: 16,
        marginVertical: 4,
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: c.sunken,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        gap: 10,
      }}
    >
      <Icon name="info" size={18} color={c.muted} />
      <Txt v="caption" color={c.muted} style={{ flex: 1, paddingVertical: 8 }}>
        {SAMPLE_BANNER_TEXT}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tutup penanda contoh"
        onPress={() => dismiss(area)}
        hitSlop={4}
        android_ripple={{ color: c.ripple, borderless: true }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="x" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}
