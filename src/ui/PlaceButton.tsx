import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useHome } from '@/api/useHome';
import type { Place } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Tombol tempat di kiri atas (Beranda, Perangkat, Usaha): menampilkan tempat terpilih, membuka pemilih tempat. */
export function PlaceButton({ labelFor }: { labelFor?: (place: Place) => string }) {
  const { c, shadow } = useTheme();
  // Tempat dari Beranda (`GET /home`); sebelum terisi, `Semua`.
  const { home } = useHome();
  const place = home?.place ?? 'Semua';
  const label = labelFor ? labelFor(place) : place;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tempat: ${label}`}
      onPress={() => router.push('/tempat')}
      android_ripple={{ color: c.ripple }}
      style={{
        height: 48,
        paddingLeft: 16,
        paddingRight: 12,
        borderRadius: 24,
        boxShadow: shadow.e1,
        backgroundColor: c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Txt weight={600}>{label}</Txt>
      <Icon name="chevD" size={20} color={c.text} />
    </Pressable>
  );
}
