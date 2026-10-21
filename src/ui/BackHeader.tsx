import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from './IconButton';
import { Txt } from './Txt';

/** Kepala layar dalam: tombol kembali, judul, dan keterangan satu baris (desain 2d, 2f). */
export function BackHeader({ title, sub }: { title: string; sub?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
      <View style={{ height: 64, justifyContent: 'center' }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="section" accessibilityRole="header">
          {title}
        </Txt>
        {sub ? (
          <Txt v="caption" color={c.muted}>
            {sub}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
