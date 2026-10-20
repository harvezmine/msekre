import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { serviceDef, serviceInfo } from '@/sample/services';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Inti } from '@/ui/inti/Inti';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Halaman masuk layanan (desain 2j), dibuka dari Terhubung dengan ?id=<layanan>. Di Fase 0b hanya tampilan contoh.
export default function Masuk() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const { c, scheme } = useTheme();
  const { dispatch } = useSample();
  const { close } = useSheet();
  const { height } = useWindowDimensions();
  const service = serviceDef(id);
  const info = serviceInfo[id];
  if (!service || !info) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>;
  }
  const shortName = service.name.replace(' & Tokopedia', '');
  const connect = () =>
    close(() => {
      dispatch({ type: 'connect', id });
      router.replace(`/terhubung/tersambung?id=${id}`);
    });
  return (
    <View style={{ marginHorizontal: -20, gap: 16 }}>
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
        <IconButton icon="x" label="Tutup" onPress={() => close()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={600} accessibilityRole="header">
            Masuk ke {shortName}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={12} color={c.muted} />
            <Txt v="caption" color={c.muted}>
              {info.domain}
            </Txt>
          </View>
        </View>
      </View>
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: c.mint,
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Inti size={36} onDark={scheme === 'dark'} />
        <Txt style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
          Ini halaman resmi {shortName}. Kata sandi Anda tidak saya lihat atau simpan.
        </Txt>
      </View>
      <View
        style={{
          marginHorizontal: 16,
          height: Math.max(220, height * 0.9 - 400),
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.line,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 24,
        }}
      >
        <Icon name="globe" size={32} color={c.muted} />
        <Txt weight={600} color={c.muted} style={{ textAlign: 'center' }}>
          Halaman masuk {shortName}
        </Txt>
        <Txt v="caption" color={c.muted} style={{ textAlign: 'center' }}>
          Tampilan milik layanan, dibuka di dalam aplikasi
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Masuk (contoh)"
        onPress={connect}
        style={{
          marginHorizontal: 16,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={c.onGreen} style={{ fontSize: 17 }}>
          Masuk (contoh)
        </Txt>
      </Pressable>
    </View>
  );
}
