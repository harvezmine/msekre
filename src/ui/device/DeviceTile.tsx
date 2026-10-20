import { Pressable, StyleSheet, View } from 'react-native';
import { deviceStatus, type Device } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
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
 * Ubin perangkat 2 kolom (desain 2c): lingkaran ikon, sakelar, nama, keadaan. Yang tidak terjangkau abu-abu, dengan
 * titik clay dan tanpa sakelar. Ubin AC bisa diketuk untuk membuka detail; sakelarnya tetap berdiri sendiri.
 */
export function DeviceTile({ device, width, onToggle, onOpen }: Props) {
  const { c, scheme } = useTheme();
  const { name, icon, on, reachable } = device;
  const status = deviceStatus(device);
  const active = reachable && on;
  return (
    <View
      style={{
        width,
        minHeight: 140,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: reachable ? c.card : scheme === 'dark' ? c.paper : '#EEF0EA',
        padding: 16,
        justifyContent: 'space-between',
      }}
    >
      {onOpen && reachable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}. ${status}. Buka pengaturan`}
          onPress={onOpen}
          android_ripple={{ color: c.ripple }}
          style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
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
            backgroundColor: active ? c.mint : c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} color={active ? c.green : c.muted} />
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
                backgroundColor: c.clay,
                borderWidth: 2,
                borderColor: scheme === 'dark' ? c.paper : '#EEF0EA',
              }}
            />
          ) : null}
        </View>
        {reachable ? <Toggle label={name} value={on} onChange={onToggle} /> : null}
      </View>
      <View pointerEvents="none">
        <Txt weight={600} color={reachable ? c.ink : c.muted}>
          {name}
        </Txt>
        <Txt v="caption" weight={active ? 600 : 500} color={active ? c.green : c.muted}>
          {status}
        </Txt>
      </View>
    </View>
  );
}
