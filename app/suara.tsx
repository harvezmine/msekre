import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { onForest } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

// Fase 0: isi contoh. Rekaman, teks langsung, dan suara balasan dibangun di Fase 6.
export default function Suara() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.voice, paddingTop: insets.top + 24 }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 28, gap: 8, minHeight: 120 }}>
        <Txt v="caption" color={onForest.soft}>
          Anda
        </Txt>
        <Txt weight={500} color={onForest.text} style={{ fontSize: 20, lineHeight: 28 }}>
          Matikan AC kamar dan ingatkan saya jam 7 pagi <Text style={{ color: onForest.hint }}>berangkat ke bandara.</Text>
        </Txt>
      </View>
      <View style={{ height: 340, alignItems: 'center', justifyContent: 'center' }}>
        <Inti size={200} state="speak" onDark />
      </View>
      <View style={{ paddingHorizontal: 28, gap: 8 }}>
        <Txt v="caption" color={onForest.soft}>
          {DEFAULT_ASSISTANT}
        </Txt>
        <Txt weight={600} color={onForest.strong} style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.26 }}>
          Siap. AC kamar sudah mati, dan alarm jam 07.00 sudah saya pasang.
        </Txt>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 36,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <RoundAction icon="micOff" label="Bisukan mic" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selesai"
          onPress={() => router.back()}
          style={{ height: 56, paddingHorizontal: 40, borderRadius: 28, backgroundColor: onForest.strong, justifyContent: 'center' }}
        >
          {/* warna forest di atas tombol terang, sama di dua mode */}
          <Txt v="subtitle" color="#0E3A2C">
            Selesai
          </Txt>
        </Pressable>
        <RoundAction icon="keyboard" label="Pindah ke ketik" onPress={() => router.replace('/chat')} />
      </View>
    </View>
  );
}

function RoundAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: onForest.buttonLine,
          backgroundColor: onForest.button,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={24} color={onForest.text} />
      </Pressable>
      <Txt v="caption" color={onForest.label}>
        {label}
      </Txt>
    </View>
  );
}
