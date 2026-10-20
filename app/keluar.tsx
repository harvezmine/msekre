import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAuth } from '@/api/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar konfirmasi keluar dari akun. Dibuka dengan presentation transparentModal dari Stack.
export default function Keluar() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

function Isi() {
  const { c } = useTheme();
  const { logout } = useAuth();
  const { close } = useSheet();
  const run = () =>
    close(() => {
      void logout().then(() => {
        // Tumpukan dibersihkan: dari layar masuk, "kembali" tidak mendarat di isi akun yang baru ditinggalkan.
        router.dismissTo('/');
        router.replace('/mulai');
      });
    });
  return (
    <View style={{ gap: 8 }}>
      <Txt v="title">Keluar dari akun ini?</Txt>
      <Txt color={c.muted}>Riwayat tetap tersimpan, dan Anda bisa masuk lagi kapan saja.</Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keluar"
          onPress={run}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: c.clay,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={600} color={c.onGreen} style={{ fontSize: 17 }}>
            Keluar
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={() => close()}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.green}>
            Batal
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
