import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useHome } from '@/api/useHome';
import type { Place } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

/**
 * Tombol tempat: menampilkan tempat terpilih, membuka pemilih tempat. `quiet` (kepala Usaha, papan 18): hanya tulisan dan
 * chevron tanpa permukaan.
 */
export function PlaceButton({ labelFor, quiet = false }: { labelFor?: (place: Place) => string; quiet?: boolean }) {
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
        minHeight: 48,
        maxWidth: 200,
        paddingLeft: quiet ? 8 : 16,
        paddingRight: quiet ? 4 : 12,
        borderRadius: 24,
        boxShadow: quiet ? undefined : shadow.e1,
        backgroundColor: quiet ? 'transparent' : c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Txt v={quiet ? 'row' : 'body'} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Icon name="chevD" size={20} color={c.text} />
    </Pressable>
  );
}
