// Niat layar: merayakan dengan tenang bahwa layanan sudah tersambung (logonya meluncur ke tanda S asisten, garis hijau
// tergambar, lalu centang). Tindakan tersering: Selesai, tombol besar paling bawah (zona jempol).
// Juga tujuan alamat kembali dari halaman masuk resmi (`sekretarisai://terhubung/tersambung?id=<id>&ok=1`, atau
// `ok=0&reason=`), termasuk saat aplikasi dibuka olehnya.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { failureText } from '@/api/connections';
import { joinAnimated, markJoinAnimated } from '@/api/joinSeen';
import { useConnections } from '@/api/useConnections';
import { serviceJoined } from '@/api/serviceCopy';
import { useTheme } from '@/theme/ThemeProvider';
import { JoinMark } from '@/ui/connect/JoinMark';
import { GradientField } from '@/ui/kit';
import { useLayoutClass } from '@/ui/kit/layout';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Txt } from '@/ui/Txt';

export default function Tersambung() {
  const { id, ok, reason } = useLocalSearchParams<{ id?: string; ok?: string; reason?: string }>();
  const serviceId = typeof id === 'string' ? id : '';
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useLayoutClass() === 'compact';
  const { service, detail, flow, status, handleCallback, retry } = useConnections(serviceId);
  const fromCallback = typeof ok === 'string';
  // Gerak bergabung hanya sekali per sambungan, juga kalau layar ini terbuka dua kali (lembar dan alamat kembali).
  const [alreadyAnimated] = useState(() => joinAnimated(serviceId));
  const connected = service?.status === 'connected';
  const animate = connected && !alreadyAnimated;
  useEffect(() => {
    if (animate) markJoinAnimated(serviceId);
  }, [animate, serviceId]);
  useEffect(() => {
    if (fromCallback && serviceId) {
      void handleCallback({ id: serviceId, ok: ok === '1', reason: typeof reason === 'string' ? reason : null });
    }
    // Sekali saat dibuka oleh alamat kembali.
  }, [fromCallback, serviceId, ok, reason, handleCallback]);

  const done = () => router.dismissTo('/');
  const frame = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 24, gap: 16 }}>{children}</View>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <Txt weight={600} color={c.brandInk} style={{ textAlign: 'center' }}>
        {label}
      </Txt>
    </Pressable>
  );

  const failed = (fromCallback && ok !== '1') || flow.phase === 'failed';
  if (failed) {
    const name = service?.name ?? 'layanan ini';
    return frame(
      <>
        {service ? (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <JoinMark id={service.id} name={service.name} size={56} state="idle" />
          </View>
        ) : null}
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
  const joined = serviceJoined(service.id) ?? 'Mulai sekarang saya bisa membantu dari sini.';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Cahaya hijau lembut di atas: perayaan yang tenang. */}
      <GradientField recipe="hero" height={compact ? 320 : 420} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (compact ? 32 : 96),
          paddingBottom: Math.max(32, insets.bottom + 16),
          paddingHorizontal: 24,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <JoinMark
            id={service.id}
            name={service.name}
            size={compact ? 56 : 72}
            state="joined"
            animate={animate}
            testID={`sambungan-${service.id}`}
          />
        </View>
        <View style={{ gap: 8, marginTop: compact ? 24 : 40 }}>
          <Txt v="title" style={{ textAlign: 'center' }} accessibilityRole="header">
            {name} sudah terhubung
          </Txt>
          <Txt v="subtitle" weight={400} color={c.muted} style={{ textAlign: 'center', lineHeight: 26 }}>
            {joined}
          </Txt>
        </View>
        <View
          style={{
            marginTop: 28,
            backgroundColor: c.surface,
            boxShadow: shadow.e1,
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
            <Txt weight={600} color={c.brandInk} style={{ fontSize: 15 }}>
              Ubah
            </Txt>
          </Pressable>
        </View>
        <View style={{ flex: 1, minHeight: 24 }} />
        <View testID="zona-jempol">
          <PrimaryButton label="Selesai" onPress={done} />
        </View>
      </ScrollView>
    </View>
  );
}
