import { Pressable, StyleSheet, View } from 'react-native';
import type { Device } from '@/api/contract';
import { canSwitch } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { iconOr } from '../icons';
import { Icon } from '../Icon';
import { Surface } from '../kit/Surface';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';

interface Props {
  device: Device;
  width: number;
  onToggle: (next: boolean) => void;
  /** Hanya untuk AC: membuka detailnya. */
  onOpen?: () => void;
}

/**
 * Ubin perangkat 2 kolom: lingkaran ikon, sakelar, nama, keadaan. Menyala = hijau (lingkaran ikon `brand`, kata keadaan
 * hijau). Yang tidak terjangkau hanya bercincin garis, dengan titik koral dan tanpa sakelar. Ubin AC bisa diketuk untuk membuka detail; sakelarnya tetap berdiri sendiri.
 */
export function DeviceTile({ device, width, onToggle, onOpen }: Props) {
  const { c, marker } = useTheme();
  const { name, on, reachable, status } = device;
  const icon = iconOr(device.icon, 'bulb');
  const active = reachable && on;
  return (
    // Menyala: `on` (terang hijau lembut, gelap arang + cahaya hijau). Mati: permukaan biasa. Tak terjangkau: cincin.
    <Surface
      variant={active ? 'on' : reachable ? 'plain' : 'ghost'}
      padding={16}
      style={{ width, minHeight: 140, justifyContent: 'space-between' }}
    >
      {onOpen && reachable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${status}`}
          accessibilityHint="Buka pengaturan"
          onPress={onOpen}
          android_ripple={{ color: c.ripple }}
          style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View
          pointerEvents="none"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: active ? c.brand : c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} color={active ? c.onBrand : c.muted} />
          {!reachable ? (
            <View
              testID="titik-tak-terjangkau"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: marker.warn.base,
                borderWidth: 2,
                borderColor: c.bg,
              }}
            />
          ) : null}
        </View>
        {reachable && canSwitch(device) ? <Toggle label={`${name}, ${status}`} value={on} onChange={onToggle} /> : null}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden={!!onOpen}
        importantForAccessibility={onOpen ? 'no-hide-descendants' : 'auto'}
      >
        <Txt weight={600} color={reachable ? c.text : c.muted}>
          {name}
        </Txt>
        <Txt v="caption" weight={active ? 600 : 500} color={active ? c.brandInk : c.muted}>
          {status}
        </Txt>
      </View>
    </Surface>
  );
}
