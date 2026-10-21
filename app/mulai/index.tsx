import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { IntiOrb } from '@/ui/inti/IntiOrb';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';
import { Wordmark } from '@/ui/Wordmark';

// Niat layar: berkenalan dengan asisten dalam satu kalimat. Tindakan tersering: Mulai, tombol besar paling bawah (zona
// jempol). Layar pertama kali 1 (desain 2n): Inti menyapa.
export default function Mulai() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const assistant = useAssistantName();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
      }}
    >
      <Wordmark size={18} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <IntiOrb size={92} />
        <View style={{ gap: 12 }}>
          <Txt v="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
            Halo, saya {assistant}, sekretaris AI Anda.
          </Txt>
          <Txt weight={400} color={c.muted} style={{ fontSize: 17, lineHeight: 26, textAlign: 'center' }}>
            Jadwal, pesan, rumah, dan usaha. Dari sini atau WhatsApp.
          </Txt>
        </View>
      </View>
      <View testID="zona-jempol" style={{ alignSelf: 'stretch', gap: 20 }}>
        <StepDots step={1} />
        <PrimaryButton label="Mulai" onPress={() => router.push('/mulai/masuk')} />
      </View>
    </ScrollView>
  );
}
