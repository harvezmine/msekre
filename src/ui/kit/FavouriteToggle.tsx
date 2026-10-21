import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { AccentIcon } from './AccentIcon';
import { Surface } from './Surface';

export interface FavouriteToggleProps {
  icon: IconName;
  /** Nama pendek ("AC kamar", "Teras"). */
  name: string;
  /** Satu kata keadaan ("24°", "Nyala", "Mati"). */
  state: string;
  on: boolean;
  reachable?: boolean;
  /** Layar pendek: ubin 104, lingkaran ikon 40. */
  compact?: boolean;
  /** Ketuk: nyala/mati. Tidak terjangkau: tidak ada. */
  onToggle: () => void;
  /** Tahan: buka halaman perangkat (remote). */
  onOpen?: () => void;
  testID?: string;
}

/**
 * Sakelar besar perangkat favorit (§8 `FavToggle`): ikon, nama pendek, satu kata keadaan. Menyala = hijau (terang:
 * hijau lembut tanpa bayangan; gelap: arang dengan cahaya hijau di pojok); mati = netral; tidak terjangkau = cincin garis.
 * Ketuk menyalakan/mematikan, tahan membuka remote.
 */
export function FavouriteToggle({
  icon,
  name,
  state,
  on,
  reachable = true,
  compact = false,
  onToggle,
  onOpen,
  testID,
}: FavouriteToggleProps) {
  const { c } = useTheme();
  const active = reachable && on;
  return (
    <Surface
      testID={testID}
      variant={active ? 'on' : reachable ? 'plain' : 'ghost'}
      radius={26}
      padding={compact ? 12 : 14}
      onPress={reachable ? onToggle : undefined}
      onLongPress={onOpen}
      haptic={reachable ? 'selection' : undefined}
      accessibilityRole="switch"
      accessibilityLabel={name}
      accessibilityState={{ checked: on, disabled: !reachable }}
      accessibilityValue={{ text: state }}
      accessibilityHint={onOpen ? 'Tahan untuk membuka remote' : undefined}
      style={{ flex: 1, minHeight: compact ? 104 : 132, justifyContent: 'space-between' }}
    >
      <AccentIcon icon={icon} tone={active ? 'on' : 'neutral'} size={compact ? 40 : 46} />
      <View style={{ gap: 2, paddingTop: 8 }}>
        <Txt
          weight={600}
          numberOfLines={1}
          style={{ fontSize: 15.5, lineHeight: 20 }}
          color={reachable ? c.text : c.muted}
        >
          {name}
        </Txt>
        <Txt
          weight={600}
          tabular
          numberOfLines={1}
          style={{ fontSize: 13.5, lineHeight: 18 }}
          color={active ? c.brandInk : c.muted}
        >
          {state}
        </Txt>
      </View>
    </Surface>
  );
}
