import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Txt } from '@/ui/Txt';

// Tautan yang tidak dikenal (tautan lama, salah ketik): kabar singkat dan jalan pulang.
export default function NotFound() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <Txt v="display" accessibilityRole="header">
        Halaman ini tidak ada.
      </Txt>
      <PrimaryButton label="Ke Beranda" onPress={() => router.replace('/')} />
    </View>
  );
}
