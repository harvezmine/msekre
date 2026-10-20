import { View } from 'react-native';
import { NOW } from '@/sample/agenda';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** Garis hijau "sekarang" di antara item yang sudah lewat dan yang akan datang (desain 2a). */
export function NowLine() {
  const { c } = useTheme();
  return (
    <View
      testID="garis-sekarang"
      accessible
      accessibilityLabel={`Sekarang ${NOW}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingHorizontal: 4 }}
    >
      <Txt v="caption" weight={600} tabular color={c.green} style={{ width: 48 }}>
        {NOW}
      </Txt>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.green }} />
      <View style={{ flex: 1, height: 1.5, backgroundColor: c.green }} />
    </View>
  );
}
