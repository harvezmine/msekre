import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { getAlarmScheduler } from '@/alarm';
import { TEST_ALARM_DELAY_MS, TEST_ALARM_ID } from '@/alarm/testAlarm';
import type { Grant } from '@/alarm/types';
import { useAlarmStatus } from '@/alarm/useAlarmStatus';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/**
 * Panduan izin alarm: kenapa HP perlu izin tambahan, tiga pemeriksaan (alarm tepat waktu, tampil di layar kunci,
 * notifikasi) dengan pintasan ke pengaturannya, penghemat baterai, dan catatan untuk merek yang suka mematikan aplikasi
 * di latar. Dibuka dari Agenda (kalau ada yang menghalangi) dan Akun → Notifikasi.
 */
export default function IzinAlarm() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

/** Catatan per merek HP, dikenali dari `Device.manufacturer`. */
export function brandTips(manufacturer: string | null): { brand: string; tips: string[] } | null {
  const m = (manufacturer ?? '').toLowerCase();
  const brand = /xiaomi|redmi|poco/.test(m)
    ? 'Xiaomi'
    : /oppo|realme|oneplus/.test(m)
      ? 'Oppo'
      : /vivo|iqoo/.test(m)
        ? 'Vivo'
        : null;
  if (!brand) return null;
  return {
    brand,
    tips: ['Izinkan "Mulai otomatis" untuk aplikasi ini.', 'Matikan penghemat baterai untuk aplikasi ini.'],
  };
}

const STATE_TEXT: Record<Grant, string> = {
  granted: 'Sudah aktif',
  denied: 'Belum aktif',
  unknown: 'Belum diketahui',
};

function Isi() {
  const { c } = useTheme();
  const { close } = useSheet();
  const toast = useSampleDispatch();
  const { native, status, openSettings } = useAlarmStatus();
  const [tested, setTested] = useState(false);
  const tips = brandTips(Device.manufacturer);

  const test = async () => {
    const scheduler = getAlarmScheduler();
    const ok = await scheduler.schedule({
      id: TEST_ALARM_ID,
      at: Date.now() + TEST_ALARM_DELAY_MS,
      title: 'Alarm percobaan',
      note: 'Kalau Anda melihat ini, alarm di HP ini sudah bekerja.',
    });
    if (ok) return setTested(true);
    // Notifikasi mati: alarm terpasang tapi tidak akan terdengar, jadi tidak dianggap berhasil (dan tidak dikabarkan ke server).
    const now = await scheduler.status();
    toast({
      type: 'showToast',
      text:
        now.notifications === 'denied'
          ? 'Notifikasi masih mati, jadi alarm tidak akan terdengar. Nyalakan notifikasinya dulu ya.'
          : 'Alarm percobaan belum bisa dipasang. Nyalakan izin di atas dulu ya.',
    });
  };

  if (!native) {
    return (
      <View style={{ gap: 8 }}>
        <Txt v="title">Alarm di HP ini</Txt>
        <Txt color={c.muted}>
          HP atau aplikasi ini belum bisa membunyikan alarm sendiri. Pengingat tetap sampai lewat notifikasi dan
          WhatsApp.
        </Txt>
        <View style={{ paddingTop: 16 }}>
          <PrimaryButton label="Tutup" onPress={() => close()} />
        </View>
      </View>
    );
  }

  const rows: {
    key: 'exact' | 'fullScreen' | 'notifications';
    icon: IconName;
    title: string;
    why: string;
  }[] = [
    { key: 'exact', icon: 'clock', title: 'Alarm tepat waktu', why: 'Supaya pengingat bunyi pas waktunya.' },
    {
      key: 'fullScreen',
      icon: 'phone',
      title: 'Tampil di layar kunci',
      why: 'Supaya pengingat muncul saat HP terkunci.',
    },
    { key: 'notifications', icon: 'bell', title: 'Notifikasi', why: 'Supaya alarm bisa muncul dan berbunyi.' },
  ];
  const battery = status?.batteryOptimized;

  return (
    <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 8 }}>
        <Txt v="title">Biar pengingat tetap bunyi</Txt>
        <Txt color={c.muted}>
          Biar pengingat tetap bunyi walau HP terkunci atau internet mati, ada beberapa hal yang perlu diizinkan.
        </Txt>

        <View style={{ paddingTop: 8 }}>
          <ListGroup>
            {rows.map((r, i) => {
              const state: Grant = status?.[r.key] ?? 'unknown';
              const ok = state === 'granted';
              return (
                <ListRow
                  key={r.key}
                  icon={r.icon}
                  title={r.title}
                  subtitle={`${STATE_TEXT[state]}. ${r.why}`}
                  warn={state === 'denied'}
                  last={battery === undefined && i === rows.length - 1}
                  onPress={ok ? undefined : () => void openSettings(r.key)}
                  trailing={ok ? <Icon name="check" size={22} color={c.green} /> : <OpenLabel />}
                />
              );
            })}
            {battery !== undefined ? (
              <ListRow
                icon="bolt"
                title="Penghemat baterai"
                subtitle={
                  battery
                    ? 'Masih membatasi aplikasi. Matikan penghemat baterai untuk aplikasi ini.'
                    : 'Aman. Aplikasi tidak dibatasi.'
                }
                warn={battery}
                last
                onPress={battery ? () => void openSettings('battery') : undefined}
                trailing={battery ? <OpenLabel /> : <Icon name="check" size={22} color={c.green} />}
              />
            ) : null}
          </ListGroup>
        </View>

        {tips ? (
          <View style={{ backgroundColor: c.mint, borderRadius: 20, padding: 16, gap: 8, marginTop: 8 }}>
            <Txt weight={600} color={c.green}>
              Khusus HP {tips.brand}
            </Txt>
            {tips.tips.map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="check" size={18} color={c.green} />
                <Txt style={{ flex: 1 }}>{t}</Txt>
              </View>
            ))}
            <Txt v="caption" color={c.muted}>
              Letaknya beda-beda di tiap HP. Cari di Pengaturan → Aplikasi → Sekretaris AI.
            </Txt>
          </View>
        ) : null}

        <View style={{ gap: 8, paddingTop: 16 }}>
          <PrimaryButton label="Selesai" onPress={() => close()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              tested ? 'Alarm akan berbunyi 1 menit lagi. Kunci HP untuk mencoba' : 'Coba alarm 1 menit lagi'
            }
            onPress={() => void test()}
            style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green}>
              {tested ? 'Alarm akan berbunyi 1 menit lagi. Kunci HP untuk mencoba' : 'Coba alarm 1 menit lagi'}
            </Txt>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function OpenLabel() {
  const { c } = useTheme();
  return (
    <Txt v="caption" weight={600} color={c.green} style={{ maxWidth: 88, textAlign: 'right' }}>
      Buka pengaturan
    </Txt>
  );
}
