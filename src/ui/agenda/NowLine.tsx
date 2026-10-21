import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** Garis biru "sekarang" di antara item yang sudah lewat dan yang akan datang (desain 2a). */
export function NowLine({ now }: { now: string }) {
  const { marker } = useTheme();
  const a = marker.agenda;
  return (
    <View
      testID="garis-sekarang"
      accessible
      accessibilityLabel={`Sekarang ${now}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingHorizontal: 4 }}
    >
      <Txt v="caption" weight={600} tabular color={a.ink} style={{ width: 48 }}>
        {now}
      </Txt>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.base }} />
      <View style={{ flex: 1, height: 1.5, backgroundColor: a.base }} />
    </View>
  );
}
