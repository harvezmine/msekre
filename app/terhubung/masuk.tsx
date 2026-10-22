// Niat lembar: masuk ke halaman resmi layanan dengan tenang (logo layanan dan tanda S asisten berdampingan, titik hijau
// mengalir di antaranya selama menyambung). Tindakan tersering: satu tombol hijau besar paling bawah (zona jempol).
// Dibuka dari Terhubung dengan ?id=<layanan>; tombolnya membuka halaman masuk resmi di dalam aplikasi, kata sandi tidak
// lewat aplikasi.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { needsReconnect } from '@/api/connections';
import { clearJoinAnimated } from '@/api/joinSeen';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { serviceDomain } from '@/api/serviceCopy';
import { useTheme } from '@/theme/ThemeProvider';
import { JoinMark, type JoinState } from '@/ui/connect/JoinMark';
import { capabilityIcon } from '@/ui/connect/logos';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { PressableScale } from '@/ui/kit/PressableScale';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

export default function Masuk() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const { c, marker } = useTheme();
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
  const domain = serviceDomain(id);
  const working = flow.phase === 'opening' || flow.phase === 'waiting';
  const retry = flow.phase === 'failed' || flow.phase === 'cancelled';
  const soon = service.status === 'soon';
  const reconnect = needsReconnect(service);
  const already = service.status === 'connected' && !reconnect && flow.phase === 'idle';
  const join: JoinState = flow.phase === 'connected' || already ? 'joined' : working ? 'working' : 'idle';
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
    <View style={{ marginHorizontal: -20, gap: 20 }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
        <IconButton icon="x" label="Tutup" onPress={() => close()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="section" accessibilityRole="header">
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

      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        <JoinMark
          id={service.id}
          name={service.name}
          size={56}
          state={join}
          status={soon ? 'soon' : undefined}
          testID={`masuk-${service.id}`}
        />
      </View>

      {/* Satu kalimat kepercayaan: halaman milik layanan, kata sandi tidak dilihat asisten. */}
      <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ marginTop: 2 }}>
          <Icon name="shield" size={18} color={c.brandInk} />
        </View>
        <Txt color={c.muted} style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
          Ini halaman resmi {shortName}. Kata sandi Anda tidak saya lihat atau simpan.
        </Txt>
      </View>

      {mode === 'contoh' ? (
        <View
          style={{
            marginHorizontal: 16,
            height: Math.max(160, height * 0.9 - 520),
            borderRadius: 24,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 24,
          }}
        >
          <Icon name="globe" size={28} color={c.faint} />
          <Txt weight={600} color={c.muted} style={{ textAlign: 'center' }}>
            Halaman masuk {shortName}
          </Txt>
          <Txt v="caption" color={c.muted} style={{ textAlign: 'center' }}>
            Tampilan milik layanan, dibuka di dalam aplikasi
          </Txt>
        </View>
      ) : detail?.data?.what.length ? (
        <View style={{ marginHorizontal: 20, gap: 12 }}>
          <Txt weight={600}>Yang bisa {assistant} lakukan</Txt>
          {detail.data.what.slice(0, 3).map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name={capabilityIcon(line)} size={20} color={c.brandInk} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </View>
      ) : null}

      {flow.phase === 'waiting' && mode !== 'contoh' ? (
        <Txt color={c.muted} style={{ marginHorizontal: 20 }}>
          Selesaikan masuk di halaman {shortName}, lalu kembali ke sini.
        </Txt>
      ) : null}
      {retry && flow.message ? (
        <Txt color={marker.warn.ink} accessibilityLiveRegion="polite" style={{ marginHorizontal: 20 }}>
          {flow.message}
        </Txt>
      ) : null}
      {already ? (
        <Txt color={c.muted} style={{ marginHorizontal: 20 }}>
          {shortName} sudah tersambung.
        </Txt>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: working || soon }}
        disabled={working || soon}
        onPress={go}
        style={{
          marginHorizontal: 16,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.brand,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: working || soon ? 0.6 : 1,
        }}
      >
        <Txt weight={600} color={c.onBrand} style={{ fontSize: 17 }}>
          {label}
        </Txt>
      </PressableScale>
    </View>
  );
}
