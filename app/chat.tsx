import { router } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

const SUGGESTIONS: { icon: IconName; text: string }[] = [
  { icon: 'mail', text: 'Ringkas email hari ini' },
  { icon: 'bulb', text: 'Matikan semua lampu' },
  { icon: 'store', text: 'Cek stok kedai' },
  { icon: 'bolt', text: 'Beli token listrik' },
];

// Fase 0: tampilan saja. Mengirim pesan dan riwayat chat dibangun di Fase 1.
export default function Chat() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <Inti size={36} onDark={scheme === 'dark'} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Txt v="subtitle">{DEFAULT_ASSISTANT}</Txt>
          <Txt v="caption" color={c.muted}>
            Siap membantu
          </Txt>
        </View>
        <IconButton icon="wave" label="Mode Suara" tinted onPress={() => router.replace('/suara')} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
        <Txt
          v="caption"
          color={c.muted}
          style={{ alignSelf: 'center', maxWidth: 300, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8 }}
        >
          {DEFAULT_ASSISTANT} ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.
        </Txt>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <Inti size={104} onDark={scheme === 'dark'} />
          <Txt v="title" style={{ textAlign: 'center' }}>
            Mau saya bantu urus apa?
          </Txt>
        </View>
        <View style={{ gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.text}
              accessibilityRole="button"
              accessibilityLabel={s.text}
              style={{
                height: 52,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Icon name={s.icon} size={22} color={c.green} />
              <Txt>{s.text}</Txt>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={{
          height: 88 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <IconButton icon="clip" label="Lampiran" color={c.muted} />
        <TextInput
          placeholder={`Tulis pesan untuk ${DEFAULT_ASSISTANT}`}
          placeholderTextColor={c.muted}
          cursorColor={c.green}
          selectionColor={c.green}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.card,
            paddingHorizontal: 20,
            fontFamily: FONT[400],
            fontSize: 16,
            color: c.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bicara"
          onPress={() => router.replace('/suara')}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="mic" size={24} color={c.onGreen} />
        </Pressable>
      </View>
    </View>
  );
}
