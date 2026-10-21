import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { AC_MAX, AC_MIN, useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { Dial } from '@/ui/device/Dial';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { Txt } from '@/ui/Txt';

const MODES: { mode: string; icon: IconName }[] = [
  { mode: 'Dingin', icon: 'snow' },
  { mode: 'Kering', icon: 'drop' },
  { mode: 'Kipas', icon: 'fan' },
  { mode: 'Otomatis', icon: 'auto' },
];
const FANS: readonly string[] = ['Pelan', 'Sedang', 'Kencang', 'Otomatis'];
/** Jeda setelah perubahan suhu terakhir sebelum dikirim ke server: memutar putaran tidak membanjiri server. */
export const TEMP_DEBOUNCE_MS = 500;

// Detail AC (desain 2d): putaran suhu, mode, kipas, jadwal, dan tombol nyala/mati. Semua perintah lewat server
// (`controlDevice`), jadi keadaan AC-nya sama dengan Beranda dan chat.
export default function DetailAc() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const dispatch = useSampleDispatch();
  const { home } = useHome();
  const { data, find, control } = useDeviceControl(home?.place);
  const deviceId = typeof id === 'string' ? id : '';
  const device = find(deviceId);

  // Suhu: layar langsung menampilkan angka baru, tapi ke server hanya nilai akhir, ~500 ms setelah perubahan terakhir.
  const [pendingTemp, setPendingTemp] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);
  const send = (temp: number) => {
    setPendingTemp(temp);
    if (timer.current) clearTimeout(timer.current);
    const go = () => {
      timer.current = null;
      flush.current = null;
      void control(deviceId, { temp }).finally(() => setPendingTemp((p) => (p === temp ? null : p)));
    };
    flush.current = go;
    timer.current = setTimeout(go, TEMP_DEBOUNCE_MS);
  };
  // Meninggalkan layar sebelum jedanya habis: nilai terakhir tetap dikirim.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush.current?.();
    },
    [],
  );

  if (!device || device.kind !== 'ac' || !device.ac) {
    // Belum selesai dimuat: tunggu dulu, jangan langsung bilang tidak ada.
    if (!data) {
      return (
        <View style={{ flex: 1, backgroundColor: c.paper }}>
          <BackHeader title="Perangkat" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <BackHeader title="Perangkat" />
        <View style={{ padding: 24, gap: 16, alignItems: 'flex-start' }}>
          <Txt>Perangkat ini tidak ditemukan. Mungkin sudah dihapus dari tempat ini.</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Perangkat"
            onPress={() => router.back()}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green}>
              Kembali ke Perangkat
            </Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  const { name, on, roomTemp, brand, via } = device;
  const { mode, fan } = device.ac;
  const temp = pendingTemp ?? device.ac.temp;
  const set = (patch: { on?: boolean; mode?: string; fan?: string }) => void control(device.id, patch);
  const sub =
    via === 'cloud' ? `lewat aplikasi ${brand ?? 'merek'}` : `${brand ? `${brand} · ` : ''}lewat Kotak Sekretaris AI`;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title={name} sub={sub} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(24, insets.bottom + 12), gap: 16 }}
      >
        <Dial name={name} temp={temp} caption={on ? mode : 'Mati'} dimmed={!on} onChange={send} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: -8 }}>
          <RoundButton label="Turunkan suhu" icon="minus" disabled={temp <= AC_MIN} onPress={() => send(temp - 1)} />
          <RoundButton label="Naikkan suhu" icon="plus" disabled={temp >= AC_MAX} onPress={() => send(temp + 1)} />
        </View>

        {via === 'ir' ? (
          <View
            style={{
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <View style={{ marginTop: 1 }}>
              <Icon name="info" size={22} color={c.green} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt weight={500}>
                {on ? 'Perintah terakhir' : 'AC mati · perintah terakhir'}: {temp}° {mode}
                {roomTemp !== undefined ? ` · suhu ruangan sekarang ${roomTemp}°` : ''}
              </Txt>
              <Txt v="caption" color={c.muted}>
                AC ini saya kendalikan lewat inframerah, jadi saya tahu perintah yang dikirim, bukan keadaan AC-nya.
              </Txt>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
            Mode
          </Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
            {MODES.map((m) => {
              const selected = m.mode === mode;
              return (
                <Pressable
                  key={m.mode}
                  accessibilityRole="radio"
                  accessibilityLabel={m.mode}
                  accessibilityState={{ checked: selected }}
                  onPress={() => set({ mode: m.mode })}
                  android_ripple={{ color: c.ripple }}
                  style={{
                    flex: 1,
                    height: 72,
                    borderRadius: 20,
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? c.green : c.line,
                    backgroundColor: selected ? c.mint : c.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name={m.icon} size={22} color={selected ? c.green : c.ink} />
                  <Txt v="caption" weight={selected ? 600 : 500} color={selected ? c.green : c.ink}>
                    {m.mode}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
            Kecepatan kipas
          </Txt>
          <Segmented options={FANS} value={fan} onChange={(f) => set({ fan: f })} label="Kecepatan kipas" />
        </View>

        <View style={{ gap: 8 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
            Jadwal
          </Txt>
          <View
            style={{
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 20,
              paddingVertical: 4,
              paddingLeft: 16,
              paddingRight: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 56,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <Icon name="clock" size={22} color={c.green} />
              <View style={{ flex: 1 }}>
                <Txt weight={500}>Mati sendiri jam 05.00</Txt>
                <Txt v="caption" color={c.muted}>
                  Tiap hari
                </Txt>
              </View>
              <Icon name="chevR" size={20} color={c.muted} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah jadwal"
              onPress={() => dispatch({ type: 'showToast', text: 'Jadwal baru segera hadir.' })}
              android_ripple={{ color: c.ripple }}
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Icon name="plus" size={22} color={c.green} />
              <Txt weight={600} color={c.green}>
                Tambah jadwal
              </Txt>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={on ? 'Matikan AC' : 'Nyalakan AC'}
          onPress={() => set({ on: !on })}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: c.green,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="power" size={22} color={c.onGreen} />
          <Txt v="subtitle" color={c.onGreen}>
            {on ? 'Matikan AC' : 'Nyalakan AC'}
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RoundButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconName;
  disabled: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.ripple, borderless: true, radius: 28 }}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={24} color={disabled ? c.track : c.ink} />
    </Pressable>
  );
}
