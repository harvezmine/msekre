import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { light, onVoice } from '@/theme/tokens';
import { IconButton } from '@/ui/IconButton';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

const STATES: { state: IntiState; name: string; desc: string }[] = [
  { state: 'idle', name: 'Diam', desc: 'Bernapas pelan, 1,00 → 1,04 tiap 4 detik.' },
  { state: 'listen', name: 'Mendengar', desc: 'Cincin luar mengikuti keras-pelannya suara.' },
  { state: 'think', name: 'Berpikir', desc: 'Tiga titik berdenyut bergantian.' },
  { state: 'speak', name: 'Berbicara', desc: 'Gelombang lembut keluar dari tepi Inti.' },
  { state: 'off', name: 'Tanpa sinyal', desc: 'Sinyal lemah, permintaan Anda saya simpan dulu.' },
];

export default function IntiPreview() {
  const insets = useSafeAreaInsets();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: light.voiceCanvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <IconButton icon="back" label="Kembali" color={onVoice.text} onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 40, alignItems: 'center' }}>
        {STATES.map((s) => (
          <View key={s.state} style={{ alignItems: 'center', gap: 20 }}>
            <View style={{ height: 200, justifyContent: 'center' }}>
              <Inti size={140} state={s.state} onDark />
            </View>
            <Txt v="subtitle" color={onVoice.strong}>
              {s.name}
            </Txt>
            <Txt v="caption" color={onVoice.soft} style={{ textAlign: 'center', maxWidth: 260 }}>
              {s.desc}
            </Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
