import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serviceInfo } from '@/sample/services';
import { ringNodes, useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Orbit } from '@/ui/orbit/Orbit';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

// Setelah masuk (desain 2k): simpul baru masuk ke cincin. Selesai kembali ke Beranda.
export default function Tersambung() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const { state } = useSample();
  const service = state.services.find((s) => s.id === id);
  const info = id ? serviceInfo[id] : undefined;
  if (!service || !info) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Txt style={{ textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Selesai" onPress={() => router.dismissTo('/')}>
          <Txt weight={600} color={c.green} style={{ textAlign: 'center' }}>
            Selesai
          </Txt>
        </Pressable>
      </View>
    );
  }
  const name = service.name.replace(' & Tokopedia', '');
  return (
    <ScrollView
      style={{ backgroundColor: c.paper }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 72,
        paddingBottom: Math.max(32, insets.bottom + 16),
        paddingHorizontal: 24,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Orbit nodes={ringNodes(state)} joinKey={service.ring?.key} paused={!live} />
      </View>
      <View style={{ gap: 8, marginTop: 32 }}>
        <Txt v="title" style={{ textAlign: 'center' }} accessibilityRole="header">
          {name} sudah terhubung
        </Txt>
        <Txt v="subtitle" weight={400} color={c.muted} style={{ textAlign: 'center', lineHeight: 26 }}>
          {info.joined}
        </Txt>
      </View>
      <View
        style={{
          marginTop: 24,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 20,
          paddingVertical: 4,
          paddingLeft: 16,
          paddingRight: 8,
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Txt
          style={{ flex: 1 }}
          accessibilityLabel={`Izin: ${service.permission === 'read' ? 'Hanya membaca' : 'Boleh bertindak'}`}
        >
          <Txt color={c.muted}>Izin: </Txt>
          <Txt weight={600}>{service.permission === 'read' ? 'Hanya membaca' : 'Boleh bertindak'}</Txt>
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ubah"
          onPress={() => router.push(`/terhubung/${service.id}`)}
          android_ripple={{ color: c.ripple }}
          style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
            Ubah
          </Txt>
        </Pressable>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Selesai"
        onPress={() => router.dismissTo('/')}
        style={{
          height: 56,
          borderRadius: 28,
          backgroundColor: c.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={c.onGreen} style={{ fontSize: 17 }}>
          Selesai
        </Txt>
      </Pressable>
    </ScrollView>
  );
}
