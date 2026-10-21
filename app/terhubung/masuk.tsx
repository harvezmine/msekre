import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { needsReconnect } from '@/api/connections';
import { clearJoinAnimated } from '@/api/joinSeen';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { serviceInfo } from '@/sample/services';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Inti } from '@/ui/inti/Inti';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Masuk ke layanan (desain 2j), dibuka dari Terhubung dengan ?id=<layanan>. Tombolnya membuka halaman masuk resmi layanan
// di dalam aplikasi; kata sandi tidak lewat aplikasi.
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
  const assistant = useAssistantName();
  const { mode } = useApi();
  const { close } = useSheet();
  const { height } = useWindowDimensions();
  const { service, detail, flow, connect, resetFlow, status } = useConnections(id);
  // Hanya ketukan pada tombol di lembar ini yang boleh membawa ke "Tersambung"; sisa alur lama tidak.
  const armed = useRef(false);
  useEffect(() => {
    resetFlow(id);
  }, [id, resetFlow]);
  useEffect(() => {
    if (flow.phase === 'connected' && armed.current) {
      armed.current = false;
      close(() => router.replace(`/terhubung/tersambung?id=${encodeURIComponent(id)}`));
    }
  }, [flow.phase, id, close]);

  if (!service) {
    return (
      <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>
        {status === 'ready' || status === 'error' ? 'Layanan ini tidak ditemukan.' : 'Sebentar ya, saya ambil dulu.'}
      </Txt>
    );
  }
  const shortName = service.name.replace(' & Tokopedia', '');
  const domain = serviceInfo[id]?.domain;
  const working = flow.phase === 'opening' || flow.phase === 'waiting';
  const retry = flow.phase === 'failed' || flow.phase === 'cancelled';
  const soon = service.status === 'soon';
  const reconnect = needsReconnect(service);
  const already = service.status === 'connected' && !reconnect && flow.phase === 'idle';
  const go = () => {
    armed.current = true;
    clearJoinAnimated(id);
    void connect(id);
  };
  const label = soon
    ? 'Segera hadir'
    : working
      ? 'Menyambungkan…'
      : retry
        ? 'Coba lagi'
        : reconnect
          ? 'Sambungkan ulang'
          : mode === 'contoh'
            ? 'Masuk (contoh)'
            : `Buka halaman ${shortName}`;
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
          {domain ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="lock" size={12} color={c.muted} />
              <Txt v="caption" color={c.muted}>
                {domain}
              </Txt>
            </View>
          ) : null}
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
      {mode === 'contoh' ? (
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
      ) : detail?.data?.what.length ? (
        <View style={{ marginHorizontal: 16, gap: 8 }}>
          <Txt weight={600}>Yang bisa {assistant} lakukan</Txt>
          {detail.data.what.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name="check" size={20} color={c.green} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </View>
      ) : null}
      {flow.phase === 'waiting' && mode !== 'contoh' ? (
        <Txt color={c.muted} style={{ marginHorizontal: 16 }}>
          Selesaikan masuk di halaman {shortName}, lalu kembali ke sini.
        </Txt>
      ) : null}
      {retry && flow.message ? (
        <Txt color={c.clay} accessibilityLiveRegion="polite" style={{ marginHorizontal: 16 }}>
          {flow.message}
        </Txt>
      ) : null}
      {already ? (
        <Txt color={c.muted} style={{ marginHorizontal: 16 }}>
          {shortName} sudah tersambung.
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: working || soon }}
        disabled={working || soon}
        onPress={go}
        style={{
          marginHorizontal: 16,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.green,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: working || soon ? 0.6 : 1,
        }}
      >
        <Txt weight={600} color={c.onGreen} style={{ fontSize: 17 }}>
          {label}
        </Txt>
      </Pressable>
    </View>
  );
}
