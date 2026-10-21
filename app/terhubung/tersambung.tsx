import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { failureText } from '@/api/connections';
import { joinAnimated, markJoinAnimated } from '@/api/joinSeen';
import { useConnections } from '@/api/useConnections';
import { useHome } from '@/api/useHome';
import { serviceInfo } from '@/sample/services';
import { useTheme } from '@/theme/ThemeProvider';
import { Orbit } from '@/ui/orbit/Orbit';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

// Setelah masuk (desain 2k): simpul baru masuk ke cincin. Juga tujuan alamat kembali dari halaman masuk resmi
// (`sekretarisai://terhubung/tersambung?id=<id>&ok=1`, atau `ok=0&reason=`), termasuk saat aplikasi dibuka olehnya.
export default function Tersambung() {
  const { id, ok, reason } = useLocalSearchParams<{ id?: string; ok?: string; reason?: string }>();
  const serviceId = typeof id === 'string' ? id : '';
  const { c } = useTheme();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const { ring } = useHome();
  const { service, detail, flow, status, handleCallback, retry } = useConnections(serviceId);
  const fromCallback = typeof ok === 'string';
  // Simpul baru hanya dianimasikan sekali per sambungan, juga kalau layar ini terbuka dua kali (lembar dan alamat kembali).
  const [alreadyAnimated] = useState(() => joinAnimated(serviceId));
  // Kunci simpul cincin layanan = id layanan (kontrak). Belum ada di cincin: tidak ada yang dianimasikan; begitu event
  // `home` membawanya, simpul itu masuk dengan animasinya.
  const joinKey = service?.ring && !alreadyAnimated ? ring.find((n) => n.key === service.id)?.key : undefined;
  useEffect(() => {
    if (joinKey) markJoinAnimated(joinKey);
  }, [joinKey]);
  useEffect(() => {
    if (fromCallback && serviceId) {
      void handleCallback({ id: serviceId, ok: ok === '1', reason: typeof reason === 'string' ? reason : null });
    }
    // Sekali saat dibuka oleh alamat kembali.
  }, [fromCallback, serviceId, ok, reason, handleCallback]);

  const done = () => router.dismissTo('/');
  const frame = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.paper, justifyContent: 'center', padding: 24, gap: 16 }}>
      {children}
    </View>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <Txt weight={600} color={c.green} style={{ textAlign: 'center' }}>
        {label}
      </Txt>
    </Pressable>
  );

  const failed = (fromCallback && ok !== '1') || flow.phase === 'failed';
  if (failed) {
    const name = service?.name ?? 'layanan ini';
    return frame(
      <>
        <Txt v="title" style={{ textAlign: 'center' }} accessibilityRole="header">
          Belum tersambung
        </Txt>
        <Txt color={c.muted} style={{ textAlign: 'center' }}>
          {flow.message ?? failureText(name, typeof reason === 'string' ? reason : null)}
        </Txt>
        {serviceId
          ? link('Coba lagi', () => router.replace(`/terhubung/masuk?id=${encodeURIComponent(serviceId)}`))
          : null}
        {link('Selesai', done)}
      </>,
    );
  }

  const connected = service?.status === 'connected';
  if (!connected) {
    // Alamat kembali baru tiba: daftar masih dimuat atau menunggu event; setelah selesai dimuat, tak ada yang tersambung.
    const waiting = status === 'loading' || flow.phase === 'waiting' || (fromCallback && flow.phase !== 'idle');
    return frame(
      <>
        <Txt style={{ textAlign: 'center' }}>
          {waiting ? 'Sebentar ya, saya cek dulu.' : 'Layanan ini tidak ditemukan.'}
        </Txt>
        {!waiting && fromCallback ? link('Cek lagi', () => void retry()) : null}
        {link('Selesai', done)}
      </>,
    );
  }

  const name = service.name.replace(' & Tokopedia', '');
  const permission = detail?.data?.permission;
  const permissionText = permission === 'baca_tulis' ? 'Baca dan tulis' : 'Baca saja';
  const joined = serviceInfo[service.id]?.joined ?? 'Mulai sekarang saya bisa membantu dari sini.';
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
        <Orbit nodes={ring} joinKey={joinKey} paused={!live} />
      </View>
      <View style={{ gap: 8, marginTop: 32 }}>
        <Txt v="title" style={{ textAlign: 'center' }} accessibilityRole="header">
          {name} sudah terhubung
        </Txt>
        <Txt v="subtitle" weight={400} color={c.muted} style={{ textAlign: 'center', lineHeight: 26 }}>
          {joined}
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
        <Txt style={{ flex: 1 }} accessibilityLabel={`Izin: ${permissionText}`}>
          <Txt color={c.muted}>Izin: </Txt>
          <Txt weight={600}>{permissionText}</Txt>
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ubah"
          onPress={() => router.push(`/terhubung/${encodeURIComponent(service.id)}`)}
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
        onPress={done}
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
