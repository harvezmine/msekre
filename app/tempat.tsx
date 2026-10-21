import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useHome } from '@/api/useHome';
import { useToast } from '@/ui/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar pemilih tempat. Dibuka dengan presentation transparentModal dari Stack.
export default function Tempat() {
  return (
    <Sheet onClose={() => router.back()}>
      <Pilihan />
    </Sheet>
  );
}

function Pilihan() {
  const { c } = useTheme();
  const toast = useToast();
  const { home, setPlace } = useHome();
  const { close } = useSheet();
  const current = home?.place ?? 'Semua';
  // Tempat milik pengguna dari server (`Home.places`), `Semua` lebih dulu; sebelum Beranda terisi, hanya yang sedang dipilih.
  const places: string[] = home ? ['Semua', ...home.places.filter((p) => p !== 'Semua')] : [current];
  const pick = (place: string) =>
    close(() => {
      // Yang menentukan server (`PUT /places/current`); gagal: pilihan lama tetap dan ada toast.
      void setPlace(place).then((failed) => {
        if (failed) toast(failed);
      });
    });
  return (
    <>
      <Txt v="title" style={{ marginBottom: 8 }}>
        Pilih tempat
      </Txt>
      <View accessibilityRole="radiogroup">
        {places.map((p, i) => {
          const selected = p === current;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityLabel={p}
              accessibilityState={{ checked: selected }}
              onPress={() => pick(p)}
              android_ripple={{ color: c.ripple }}
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: i < places.length - 1 ? 1 : 0,
                borderBottomColor: c.line,
              }}
            >
              <Txt weight={selected ? 600 : 500}>{p}</Txt>
              {selected ? <Icon name="check" size={24} color={c.green} /> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
