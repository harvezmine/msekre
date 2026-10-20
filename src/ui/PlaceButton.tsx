import { router } from 'expo-router';
import { Pressable } from 'react-native';
import type { Place } from '@/sample/types';
import { useSampleState } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Tombol tempat di kiri atas (Beranda, Perangkat, Usaha): menampilkan tempat terpilih, membuka pemilih tempat. */
export function PlaceButton({ labelFor }: { labelFor?: (place: Place) => string }) {
  const { c } = useTheme();
  const state = useSampleState();
  const label = labelFor ? labelFor(state.place) : state.place;
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
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Txt weight={600}>{label}</Txt>
      <Icon name="chevD" size={20} color={c.ink} />
    </Pressable>
  );
}
