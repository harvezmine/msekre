// Niat layar: memahami satu layanan dalam sekejap (logonya, keadaannya, paling banyak tiga hal yang bisa asisten
// lakukan) dan memilih izinnya. Tindakan tersering: ganti izin (segmen). Sambungkan / Sambungkan ulang menempel di zona
// jempol bila perlu; Hapus dan Putuskan sebagai tombol teks tenang di bawah.
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { needsReconnect, PERMISSION_OPTIONS, serviceLine } from '@/api/connections';
import type { ConnectionPermission, Service } from '@/api/contract';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { SampleBanner } from '@/ui/SampleBanner';
import { capabilityIcon } from '@/ui/connect/logos';
import { connectRoute, logoStatus } from '@/ui/connect/ServiceCard';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Segmented, ServiceLogo } from '@/ui/kit';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const permissionText = (assistant: string): Record<ConnectionPermission, string> => ({
  baca: `${assistant} melihat data, tidak mengubah apa pun.`,
  baca_tulis: `${assistant} boleh bertindak di sini, selalu dengan persetujuan Anda.`,
});

export default function DetailLayanan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const serviceId = typeof id === 'string' ? id : '';
  const { c, marker } = useTheme();
  const assistant = useAssistantName();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { detail, service: listed, setPermission, reloadDetail } = useConnections(serviceId);
  const back = (
    <>
      <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <SampleBanner area="terhubung" />
    </>
  );
  const data = detail?.data;
  if (!data) {
    const failed = detail?.status === 'error';
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {back}
        <Txt style={{ padding: 24, textAlign: 'center' }}>
          {failed ? (detail?.error ?? '') : 'Sebentar ya, saya ambil dulu.'}
        </Txt>
        {failed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={() => void reloadDetail()}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.brandInk} style={{ textAlign: 'center' }}>
              Coba lagi
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const service = listed ?? data.service;
  const connected = service.status === 'connected';
  const soon = service.status === 'soon';
  const warn = connected && !!service.attention;
  const reconnect = connected && needsReconnect(service);
  const change = async (permission: ConnectionPermission) => {
    const res = await setPermission(service.id, permission);
    if (!res.ok) toast(res.message);
  };
  const memory = data.memoryCount;
  const memoryNote =
    memory === undefined
      ? undefined
      : memory === 0
        ? `Tidak ada yang ${assistant} ingat dari sini.`
        : `${memory} hal diingat ${assistant}.`;
  const state = connected ? serviceLine(service) : soon ? 'Segera hadir' : 'Belum tersambung';
  const stateColor = warn ? marker.warn.ink : connected ? c.brandInk : c.muted;
  const can = data.what.slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {back}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }}>
        <Hero service={service} state={state} stateColor={stateColor} />

        {/* Paling banyak tiga baris pendek: apa yang bisa dilakukan asisten di sini, masing-masing dengan ikon kecil. */}
        <View style={{ gap: 14, paddingHorizontal: 20, marginTop: 32 }}>
          <Txt v="section" accessibilityRole="header">
            Yang bisa {assistant} lakukan
          </Txt>
          {can.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name={capabilityIcon(line)} size={20} color={c.brandInk} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </View>

        {connected ? (
          <View style={{ gap: 10, paddingHorizontal: 20, marginTop: 32 }}>
            <Txt v="section" accessibilityRole="header">
              Izin
            </Txt>
            <Segmented
              role="radio"
              label="Izin"
              options={PERMISSION_OPTIONS.map((o) => o.value)}
              labels={Object.fromEntries(PERMISSION_OPTIONS.map((o) => [o.value, o.title]))}
              value={data.permission}
              onChange={(next) => void change(next)}
            />
            <Txt v="caption" color={c.muted} accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 20 }}>
              {permissionText(assistant)[data.permission]}
            </Txt>
          </View>
        ) : null}

        <View style={{ flexGrow: 1, minHeight: 32 }} />
        {/* Zona jempol: tombol teks tenang (hapus, putuskan), lalu tombol utama bila ada yang perlu disambungkan. */}
        <View testID="zona-jempol" style={{ paddingHorizontal: 20, gap: 8 }}>
          {connected ? (
            <View>
              <QuietAction
                icon="trash"
                label={`Hapus yang ${assistant} tahu`}
                value={memory === undefined ? undefined : `${memory} hal`}
                accessibilityLabel={`Hapus yang ${assistant} tahu dari layanan ini${memoryNote ? `. ${memoryNote}` : ''}`}
                color={marker.warn.ink}
                onPress={() => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(service.id)}&aksi=lupa`)}
              />
              <QuietAction
                icon="x"
                label="Putuskan"
                color={c.text}
                onPress={() => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(service.id)}&aksi=putus`)}
              />
            </View>
          ) : null}
          {reconnect ? (
            <PrimaryButton
              label={`Sambungkan ulang ${service.name}`}
              display="Sambungkan ulang"
              onPress={() => router.push(`/terhubung/masuk?id=${encodeURIComponent(service.id)}`)}
            />
          ) : !connected && !soon ? (
            <PrimaryButton
              label={`Sambungkan ${service.name}`}
              display="Sambungkan"
              onPress={() => router.replace(connectRoute(service.id))}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Kepala: ubin logo besar 72, nama, dan satu baris keadaan. */
function Hero({ service, state, stateColor }: { service: Service; state: string; stateColor: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 4 }}>
      <ServiceLogo id={service.id} name={service.name} size={72} status={logoStatus(service)} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Txt v="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {service.name}
        </Txt>
        <Txt v="caption" color={stateColor} style={{ textAlign: 'center', fontSize: 15, lineHeight: 20 }}>
          {state}
        </Txt>
      </View>
    </View>
  );
}

function QuietAction({
  icon,
  label,
  value,
  color,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  value?: string;
  color: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        minHeight: 52,
        marginHorizontal: -8,
        paddingHorizontal: 8,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <Txt weight={600} color={color} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
        {label}
      </Txt>
      {value ? (
        <Txt v="caption" color={c.muted} tabular>
          {value}
        </Txt>
      ) : null}
    </Pressable>
  );
}
