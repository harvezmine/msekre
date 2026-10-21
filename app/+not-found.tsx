// Niat layar: tautan yang tidak dikenal (tautan lama, salah ketik) tidak membuat bingung. Tindakan tersering: Ke Beranda,
// tombol besar di zona jempol paling bawah.
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AccentIcon } from '@/ui/kit';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Txt } from '@/ui/Txt';

export default function NotFound() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <AccentIcon icon="link" tone="neutral" size={52} />
        <Txt v="title" accessibilityRole="header">
          Halaman ini tidak ada.
        </Txt>
      </View>
      <View testID="zona-jempol">
        <PrimaryButton label="Ke Beranda" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}
