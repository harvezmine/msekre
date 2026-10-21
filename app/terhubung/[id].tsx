import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { needsReconnect, PERMISSION_OPTIONS, serviceLine } from '@/api/connections';
import type { ConnectionPermission } from '@/api/contract';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { iconOr, type IconName } from '@/ui/icons';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const permissionText = (assistant: string): Record<ConnectionPermission, string> => ({
  baca: `${assistant} melihat data, tidak mengubah apa pun.`,
  baca_tulis: `${assistant} boleh bertindak di sini, selalu dengan persetujuan Anda.`,
});

// Detail satu layanan (desain 2j): apa yang bisa Nadia lakukan, izin, dan hapus yang Nadia tahu atau putuskan.
export default function DetailLayanan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const serviceId = typeof id === 'string' ? id : '';
  const { c, shadow, marker } = useTheme();
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: c.sunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={iconOr(service.icon, 'link')} size={30} color={warn ? marker.warn.ink : marker.terhubung.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="title" accessibilityRole="header">
              {service.name}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: warn ? marker.warn.ink : c.brand }}
              />
              <Txt v="caption" color={warn ? marker.warn.ink : c.brandInk} style={{ flexShrink: 1 }}>
                {serviceLine(service)}
              </Txt>
            </View>
          </View>
        </View>

        {warn && reconnect ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sambungkan ulang ${service.name}`}
            onPress={() => router.push(`/terhubung/masuk?id=${encodeURIComponent(service.id)}`)}
            style={{
              backgroundColor: c.sunken,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="info" size={22} color={marker.warn.ink} />
            <Txt style={{ flex: 1 }} color={marker.warn.ink}>
              {service.attention?.text}. Ketuk untuk menyambungkan ulang.
            </Txt>
          </Pressable>
        ) : warn ? (
          <View
            accessible
            accessibilityRole="text"
            style={{
              backgroundColor: c.sunken,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="info" size={22} color={marker.warn.ink} />
            <Txt style={{ flex: 1 }} color={marker.warn.ink}>
              {service.attention?.text}
            </Txt>
          </View>
        ) : null}

        <Card style={{ gap: 12 }}>
          <Txt v="subtitle">Yang bisa {assistant} lakukan</Txt>
          {data.what.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name="check" size={20} color={c.brandInk} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </Card>

        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
            Izin
          </Txt>
          {PERMISSION_OPTIONS.map((o) => {
            const on = data.permission === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={o.title}
                accessibilityHint={PERMISSION_TEXT[o.value]}
                accessibilityState={{ checked: on }}
                onPress={() => void change(o.value)}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: on ? c.brand : 'transparent',
                  backgroundColor: on ? c.brandSoft : c.surface,
                  boxShadow: on ? undefined : shadow.e1,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: on ? c.brand : c.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt weight={600}>{o.title}</Txt>
                  <Txt color={on ? c.text : c.muted}>{PERMISSION_TEXT[o.value]}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            backgroundColor: c.surface,
            boxShadow: shadow.e1,
            borderRadius: 24,
            paddingVertical: 4,
            paddingHorizontal: 16,
          }}
        >
          <Action
            icon="trash"
            label={`Hapus yang ${assistant} tahu dari layanan ini`}
            color={marker.warn.ink}
            border
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
  border = false,
  onPress,
  note,
}: {
  icon: IconName;
  label: string;
  color: string;
  border?: boolean;
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
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: border ? 1 : 0,
        borderBottomColor: c.line,
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
