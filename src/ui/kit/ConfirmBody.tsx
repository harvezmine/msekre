import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { AccentIcon } from './AccentIcon';
import { PressableScale } from './PressableScale';

/**
 * Isi lembar konfirmasi yang tenang (Keluar, Putuskan, Hapus, Keluarkan HP, Buka kunci): ikon kecil di lingkaran, judul
 * 20, satu kalimat, lalu tombol 56 (koral untuk yang menghapus, hijau untuk yang biasa) dan Batal sebagai tulisan hijau.
 * Tombol paling bawah: zona jempol.
 */
export function ConfirmBody({
  icon,
  title,
  message,
  confirm,
  onConfirm,
  onCancel,
  busy = false,
  tone = 'warn',
}: {
  icon: IconName;
  title: string;
  message: string;
  /** Tulisan tombol koral, contoh "Ya, putuskan". */
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** `warn` (hapus, putuskan, keluar) atau `brand` (tindakan biasa yang perlu dipastikan, contoh buka kunci). */
  tone?: 'warn' | 'brand';
}) {
  const { c, marker } = useTheme();
  const fill = tone === 'warn' ? marker.warn.ink : c.brand;
  return (
    <View style={{ gap: 12 }}>
      <AccentIcon icon={icon} tone={tone} size={52} />
      <Txt v="header" accessibilityRole="header">
        {title}
      </Txt>
      <Txt color={c.muted}>{message}</Txt>
      <View style={{ gap: 4, paddingTop: 12 }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={confirm}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          haptic="medium"
          onPress={onConfirm}
          style={{
            minHeight: 56,
            borderRadius: 28,
            backgroundColor: fill,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Txt weight={600} color={c.onBrand} style={{ fontSize: 17 }}>
            {confirm}
          </Txt>
        </PressableScale>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={onCancel}
          android_ripple={{ color: c.ripple }}
          style={{ minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.brandInk}>
            Batal
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
