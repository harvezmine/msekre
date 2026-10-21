import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { useHome } from '@/api/useHome';
import { PLACES, useSample, type Place } from '@/sample/store';
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
  const { state, dispatch } = useSample();
  const { mode } = useApi();
  const { home, setPlace } = useHome();
  const { close } = useSheet();
  const current = home?.place ?? state.place;
  // Tempat milik pengguna dari server (`Home.places`), `Semua` lebih dulu. Mode server tidak pernah memakai tempat contoh;
  // sebelum Beranda terisi, hanya tempat yang sedang dipilih. Mode contoh memakai daftar contoh sebagai cadangan.
  const places: string[] = home
    ? ['Semua', ...home.places.filter((p) => p !== 'Semua')]
    : mode === 'contoh'
      ? [...PLACES]
      : [current];
  const pick = (place: string) =>
    close(() => {
      // Layar yang belum pindah ke kontrak membaca tempat dari data contoh, jadi ikut berubah saat itu juga (hanya mode
      // contoh); yang menentukan tetap server (`PUT /places/current`). Gagal: pilihan lama dikembalikan.
      const before = state.place;
      if (mode === 'contoh') dispatch({ type: 'setPlace', place: place as Place });
      void setPlace(place).then((failed) => {
        if (!failed) return;
        if (mode === 'contoh') dispatch({ type: 'setPlace', place: before });
        dispatch({ type: 'showToast', text: failed });
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
