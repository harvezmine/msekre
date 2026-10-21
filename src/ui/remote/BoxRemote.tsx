// Kotak Sekretaris AI: satu niat, mic menyala atau mati (privasi); keadaan dan suhu ruangan di atas, tombol mic besar di
// zona jempol.
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { BigNumber } from '../kit/BigNumber';
import type { MoreItem } from '../kit/MoreSheet';
import { RemoteKey } from '../kit/RemoteKey';
import { Txt } from '../Txt';
import { decimal } from '../device/present';
import { useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function BoxRemote() {
  const { c, marker } = useTheme();
  const { box, setBoxMic } = useRemote();
  const sizes = useRemoteSizes();
  const online = box?.online ?? false;
  const mic = box?.micOn ?? false;

  const more: MoreItem[] = box ? [{ icon: 'speaker', label: 'Speaker', value: box.speaker }] : [];

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead + 32, gap: 18 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: c.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="box" size={52} color={c.bg} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          testID="titik-online"
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? c.brand : marker.warn.base }}
        />
        <Txt v="label" color={online ? c.brandInk : marker.warn.ink}>
          {online ? 'Online' : 'Terputus'}
        </Txt>
      </View>
      {box ? (
        <View style={{ flexDirection: 'row', gap: 40, paddingTop: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <BigNumber
              value={decimal(box.roomTemp)}
              unit="°"
              size={56}
              accessibilityLabel={`Suhu ${decimal(box.roomTemp)} derajat`}
            />
            <Txt v="caption" color={c.muted}>
              Suhu
            </Txt>
          </View>
          <View style={{ alignItems: 'center' }}>
            <BigNumber
              value={decimal(box.humidity)}
              unit="%"
              size={56}
              accessibilityLabel={`Kelembapan ${decimal(box.humidity)}%`}
            />
            <Txt v="caption" color={c.muted}>
              Kelembapan
            </Txt>
          </View>
        </View>
      ) : null}
    </View>
  );

  const bottom = box ? (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <RemoteKey
        testID="tombol-mic"
        label="Mic"
        icon={mic ? 'mic' : 'micOff'}
        variant="power"
        on={mic}
        size={sizes.power}
        onPress={() => setBoxMic(!mic)}
      />
      <Txt v="label" color={mic ? c.brandInk : c.muted} importantForAccessibility="no" accessibilityElementsHidden>
        {mic ? 'Mic nyala' : 'Mic mati'}
      </Txt>
    </View>
  ) : null;

  return <RemoteFrame top={top} bottom={bottom} more={more} favorite={false} />;
}
