import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serviceInfo } from '@/sample/services';
import { serviceStatus, useSample, type Permission } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Txt } from '@/ui/Txt';

// Detail satu layanan (desain 2i): apa yang bisa Nadia lakukan, izin, dan hapus data atau putuskan.
export default function DetailLayanan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useSample();
  const service = state.services.find((s) => s.id === id);
  const info = id ? serviceInfo[id] : undefined;
  const back = (
    <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
      <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
    </View>
  );
  if (!service || !info) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        {back}
        <Txt style={{ padding: 24, textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>
      </View>
    );
  }
  const warn = !service.reachable;
  const forgotten = state.forgotten.includes(service.id);
  const options: { value: Permission; title: string; text: string }[] = [
    { value: 'read', title: 'Hanya membaca', text: 'Nadia melihat data, tidak mengubah apa pun.' },
    { value: 'act', title: 'Boleh bertindak', text: info.act },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {back}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: warn ? c.clayBg : c.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={service.icon} size={30} color={warn ? c.clay : c.green} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="title" accessibilityRole="header">
              {service.name}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: warn ? c.clay : c.leaf }} />
              <Txt v="caption" color={warn ? c.clay : c.leafText} style={{ flexShrink: 1 }}>
                {serviceStatus(service)}
              </Txt>
            </View>
          </View>
        </View>

        <Card style={{ gap: 12 }}>
          <Txt v="subtitle">Yang bisa Nadia lakukan</Txt>
          {info.can.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ marginTop: 2 }}>
                <Icon name="check" size={20} color={c.green} />
              </View>
              <Txt style={{ flex: 1 }}>{line}</Txt>
            </View>
          ))}
        </Card>

        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
            Izin
          </Txt>
          {options.map((o) => {
            const on = service.permission === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={o.title}
                accessibilityHint={o.text}
                accessibilityState={{ checked: on }}
                onPress={() => dispatch({ type: 'setPermission', id: service.id, permission: o.value })}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? c.green : c.line,
                  backgroundColor: on ? c.mint : c.card,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: on ? c.green : c.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.green }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt weight={600}>{o.title}</Txt>
                  <Txt color={on ? c.ink : c.muted}>{o.text}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 24,
            paddingVertical: 4,
            paddingHorizontal: 16,
          }}
        >
          <Action
            icon="trash"
            label="Hapus semua yang Nadia tahu dari layanan ini"
            color={c.clay}
            border
            onPress={() => router.push(`/terhubung/konfirmasi?id=${service.id}&aksi=lupa`)}
            note={forgotten ? 'Sudah dihapus.' : undefined}
          />
          <Action
            icon="x"
            label="Putuskan"
            color={c.ink}
            onPress={() => router.push(`/terhubung/konfirmasi?id=${service.id}&aksi=putus`)}
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
