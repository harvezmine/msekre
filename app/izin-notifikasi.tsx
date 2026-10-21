import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { usePush } from '@/api/usePush';
import { useTheme } from '@/theme/ThemeProvider';
import { IntiOrb } from '@/ui/inti/IntiOrb';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar ajakan izin notifikasi: sekali otomatis selesai pengenalan, dan dari Akun → Notifikasi. Dibuka dengan
// presentation transparentModal dari Stack.
export default function IzinNotifikasi() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

function Isi() {
  const { c } = useTheme();
  const { permission, canAskAgain, ask, openSettings } = usePush();
  const { close } = useSheet();
  const busy = useRef(false);
  // Ditolak sekali masih boleh ditanya lagi lewat jendela sistem (Android 13+); baru setelah sistem tidak mau
  // menanyakannya lagi, arahkan ke pengaturan HP.
  const denied = permission === 'denied' && !canAskAgain;
  const granted = permission === 'granted';
  const title = granted
    ? 'Notifikasi sudah aktif'
    : denied
      ? 'Notifikasi sedang dimatikan'
      : 'Biar pengingat dan kabar penting sampai';
  const body = granted
    ? 'Pengingat dan kabar penting akan sampai ke HP ini.'
    : denied
      ? 'Nyalakan lewat pengaturan HP supaya pengingat dan kabar penting sampai.'
      : 'Izinkan notifikasi ya. Saya hanya mengirim yang perlu Anda tahu.';
  const primary = granted ? 'Tutup' : denied ? 'Buka pengaturan' : 'Izinkan';
  const run = () => {
    if (busy.current) return;
    if (granted) return close();
    if (denied) {
      openSettings();
      return close();
    }
    busy.current = true;
    void ask().finally(() => close());
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignItems: 'flex-start', paddingBottom: 8 }}>
        <IntiOrb size={48} glow={false} />
      </View>
      <Txt v="title">{title}</Txt>
      <Txt color={c.muted}>{body}</Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <PrimaryButton label={primary} onPress={run} />
        {granted ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nanti saja"
            onPress={() => close()}
            style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.brandInk}>
              Nanti saja
            </Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}
