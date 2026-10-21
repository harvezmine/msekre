// Remote kunci pintu: satu niat, memastikan pintu terkunci; gembok besar dan keadaannya di atas, satu tombol Kunci atau
// Buka di zona jempol (Buka selalu dijaga: PIN bila aktif, selain itu ditanya dulu; tidak pernah dari chat).
import { View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { byLayout } from '../kit/layout';
import type { MoreItem } from '../kit/MoreSheet';
import { PressableScale } from '../kit/PressableScale';
import { Txt } from '../Txt';
import { isLocked } from '../device/present';
import { capOf } from './caps';
import { useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function LockRemote() {
  const { c, shadow, scheme } = useTheme();
  const { device, control } = useRemote();
  const sizes = useRemoteSizes();
  const s = deviceStateOf(device);
  const locked = isLocked(device);
  const lockCap = capOf(device, 'lock');
  const battery = capOf(device, 'battery');
  const circle = byLayout(sizes.cls, { compact: 136, regular: 160, tall: 176 });

  // Membuka kunci lewat aturan yang sama dengan Beranda: server/aplikasi meminta PIN (`/pin`) atau bertanya dulu
  // (`/buka-kunci`); keadaan kunci tidak berubah sebelum itu.
  const toggle = () => {
    if (locked) void control(lockCap ? { locked: false } : { on: false });
    else void control(lockCap ? { locked: true } : { on: true });
  };

  const more: MoreItem[] =
    battery && s.battery !== undefined ? [{ icon: 'battery', label: 'Baterai', value: `${s.battery}%` }] : [];

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead + 40, gap: 20 }}>
      <View
        testID="gembok"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: circle,
          height: circle,
          borderRadius: circle / 2,
          backgroundColor: locked ? c.brandSoft : c.sunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={locked ? 'lock' : 'unlock'}
          size={circle * 0.42}
          color={locked ? c.brandInk : c.muted}
          strokeWidth={1.5}
        />
      </View>
      <Txt v="headline" color={locked ? c.brandInk : c.text} accessibilityLiveRegion="polite">
        {locked ? 'Terkunci' : 'Terbuka'}
      </Txt>
    </View>
  );

  const bottom = (
    <View style={{ paddingHorizontal: 20 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={locked ? 'Buka' : 'Kunci'}
        onPress={toggle}
        haptic="medium"
        style={{
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          // Mengunci = aksi aman yang dianjurkan (hijau). Membuka = netral.
          backgroundColor: locked ? (scheme === 'dark' ? c.raised : c.surface) : c.brand,
          boxShadow: locked ? shadow.key : shadow.power,
        }}
      >
        <Icon name={locked ? 'unlock' : 'lock'} size={24} color={locked ? c.text : c.onBrand} />
        <Txt v="subtitle" color={locked ? c.text : c.onBrand} style={{ fontSize: 17 }}>
          {locked ? 'Buka' : 'Kunci'}
        </Txt>
      </PressableScale>
    </View>
  );

  return <RemoteFrame top={top} bottom={bottom} more={more} />;
}
