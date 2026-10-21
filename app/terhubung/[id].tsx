import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { needsReconnect, PERMISSION_OPTIONS, serviceLine } from '@/api/connections';
import type { ConnectionPermission } from '@/api/contract';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { ServiceMark } from '@/ui/connect/ServiceTile';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Segmented } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const permissionText = (assistant: string): Record<ConnectionPermission, string> => ({
  baca: `${assistant} melihat data, tidak mengubah apa pun.`,
  baca_tulis: `${assistant} boleh bertindak di sini, selalu dengan persetujuan Anda.`,
});

// Niat layar: memahami satu layanan dalam sekejap (apa yang bisa asisten lakukan, dalam paling banyak tiga baris) dan
// memilih izinnya. Tindakan tersering: ganti izin (segmen). Hapus dan Putuskan sebagai tombol teks tenang di bawah.
export default function DetailLayanan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const serviceId = typeof id === 'string' ? id : '';
  const { c, marker } = useTheme();
  const assistant = useAssistantName();
  const PERMISSION_TEXT = permissionText(assistant);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { detail, service: listed, setPermission, reloadDetail } = useConnections(serviceId);
  const back = (
    <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
      <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
    </View>
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
          <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void reloadDetail()}>
            <Txt weight={600} color={c.brandInk} style={{ textAlign: 'center' }}>
              Coba lagi
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const service = listed ?? data.service;
  if (service.status !== 'connected') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {back}
        <View style={{ padding: 24, gap: 16 }}>
          <Txt style={{ textAlign: 'center' }}>{service.name} belum tersambung.</Txt>
          {service.status !== 'soon' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sambungkan ${service.name}`}
              onPress={() => router.replace(`/terhubung/masuk?id=${encodeURIComponent(service.id)}`)}
            >
              <Txt weight={600} color={c.brandInk} style={{ textAlign: 'center' }}>
                Sambungkan
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
  const warn = !!service.attention;
  const reconnect = needsReconnect(service);
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

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {back}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 }}>
          <ServiceMark name={service.name} badge={warn ? 'warn' : 'on'} size={72} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Txt v="title" accessibilityRole="header">
              {service.name}
            </Txt>
            <Txt v="caption" color={warn ? marker.warn.ink : c.brandInk}>
              {serviceLine(service)}
            </Txt>
          </View>
        </View>

        {warn ? (
          <Pressable
            accessibilityRole={reconnect ? 'button' : 'text'}
            accessibilityLabel={
              reconnect ? `Sambungkan ulang ${service.name}` : (service.attention?.text ?? service.name)
            }
            disabled={!reconnect}
            onPress={() => router.push(`/terhubung/masuk?id=${encodeURIComponent(service.id)}`)}
            style={{
              marginHorizontal: 16,
              minHeight: 56,
              backgroundColor: c.sunken,
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="info" size={22} color={marker.warn.ink} />
            <Txt style={{ flex: 1 }} color={marker.warn.ink}>
              {service.attention?.text}
              {reconnect ? '. Ketuk untuk menyambungkan ulang.' : ''}
            </Txt>
          </Pressable>
        ) : null}

        {/* Paling banyak tiga baris pendek: apa yang bisa dilakukan asisten di sini. */}
        <View style={{ gap: 12, paddingHorizontal: 20 }}>
          <Txt v="section" accessibilityRole="header">
            Yang bisa {assistant} lakukan
          </Txt>
          {data.what.slice(0, 3).map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name="check" size={20} color={c.brandInk} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </View>

        <View style={{ gap: 10, paddingHorizontal: 20 }}>
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
            {PERMISSION_TEXT[data.permission]}
          </Txt>
        </View>

        {/* Hapus dan Putuskan: tombol teks tenang di bawah, tidak bersaing dengan isi. */}
        <View style={{ flexGrow: 1 }} />
        <View style={{ paddingHorizontal: 12 }}>
          <Action
            icon="trash"
            label={`Hapus yang ${assistant} tahu dari layanan ini`}
            color={marker.warn.ink}
            onPress={() => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(service.id)}&aksi=lupa`)}
            note={memoryNote}
          />
          <Action
            icon="x"
            label="Putuskan"
            color={c.text}
            onPress={() => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(service.id)}&aksi=putus`)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Action({
  icon,
  label,
  color,
  onPress,
  note,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
  note?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note ? `${label}. ${note}` : label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        minHeight: 56,
        paddingHorizontal: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon} size={22} color={color} />
      <View style={{ flex: 1, paddingVertical: 8 }}>
        <Txt weight={600} color={color}>
          {label}
        </Txt>
        {note ? (
          <Txt v="caption" color={c.muted}>
            {note}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}
