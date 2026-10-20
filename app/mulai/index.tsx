import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Inti } from '@/ui/inti/Inti';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';
import { Wordmark } from '@/ui/Wordmark';

// Layar pertama kali 1 (desain 2n): Inti menyapa.
export default function Mulai() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.paper,
        alignItems: 'center',
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
      }}
    >
      <Wordmark size={18} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <Inti size={180} onDark={scheme === 'dark'} />
        <View style={{ gap: 12 }}>
          <Txt v="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
            Halo, saya Nadia, sekretaris AI Anda.
          </Txt>
          <Txt weight={400} color={c.muted} style={{ fontSize: 17, lineHeight: 26, textAlign: 'center' }}>
            Saya bantu urus jadwal, pesan, rumah, dan usaha Anda. Dari sini atau dari WhatsApp.
          </Txt>
        </View>
      </View>
      <View style={{ alignSelf: 'stretch', gap: 20 }}>
        <StepDots step={1} />
        <PrimaryButton label="Mulai" onPress={() => router.push('/mulai/masuk')} />
      </View>
    </View>
  );
}
