// Perangkat lain (jenis belum dikenal): satu niat, menyalakan atau mematikan; ikon besar dan keadaannya, satu tombol daya.
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { deviceIcon, tileWord } from '../device/present';
import { capOf } from './caps';
import { PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function BasicRemote() {
  const { c } = useTheme();
  const { device, control } = useRemote();
  const sizes = useRemoteSizes();
  const power = capOf(device, 'power');
  const on = device.reachable && device.on;

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead + 40, gap: 20 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 152,
          height: 152,
          borderRadius: 76,
          backgroundColor: on ? c.brandSoft : c.sunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={deviceIcon(device)} size={64} color={on ? c.brandInk : c.muted} strokeWidth={1.5} />
      </View>
      <Txt v="headline" color={on ? c.brandInk : c.muted}>
        {power ? tileWord(device) : device.status}
      </Txt>
    </View>
  );

  const bottom = power ? (
    <View style={{ alignItems: 'center' }}>
      <PowerKey size={sizes.power} on={device.on} onPress={() => void control({ on: !device.on })} />
    </View>
  ) : null;

  return <RemoteFrame top={top} bottom={bottom} />;
}
