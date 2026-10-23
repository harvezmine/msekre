// Pemberitahuan: apakah kabar dan alarm sampai ke HP ini, dan kabar jenis apa saja yang dikirim.
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AccountNotifications } from '@/api/contract';
import { useAccount } from '@/api/useAccount';
import { useSoundSettings } from '@/reminders/soundSettings';
import { useTheme } from '@/theme/ThemeProvider';
import { useNotifications } from '@/ui/akun/notifications';
import { BackHeader } from '@/ui/BackHeader';
import { SampleBanner } from '@/ui/SampleBanner';
import type { IconName } from '@/ui/icons';
import { ListRow, type AccentTone } from '@/ui/kit';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const ICON = 46;
/** Ikon tiap jenis kabar: penanda kategori di lingkaran netral; pesan dari asisten hijau brand. */
const KIND_ICON: Record<keyof AccountNotifications, { icon: IconName; tone: AccentTone }> = {
  pesan: { icon: 'chat', tone: 'brand' },
  pengingat: { icon: 'bell', tone: 'agenda' },
  ringkasanHarian: { icon: 'sun', tone: 'agenda' },
  rumah: { icon: 'home', tone: 'rumah' },
  usaha: { icon: 'store', tone: 'usaha' },
};

export default function Notifikasi() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { account, status, error, retry, setNotifications } = useAccount();
  const { kinds, phoneOn, alarm, alarmReady } = useNotifications(account);
  const sound = useSoundSettings();
  const change = async (key: keyof AccountNotifications, on: boolean) => {
    const res = await setNotifications({ [key]: on });
    if (!res.ok && res.message) toast(res.message);
  };
  const warn = (ok: boolean) => (ok ? undefined : marker.warn.ink);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Pemberitahuan" large />
      <SampleBanner area="akun" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Izin HP: sudah menyala cukup dibaca; belum, ketuk untuk meminta izin atau membuka pengaturan HP. */}
        <ListRow
          icon="phone"
          tone={phoneOn ? 'brand' : 'neutral'}
          iconSize={ICON}
          title="Izin HP"
          value={phoneOn ? 'Nyala' : 'Perlu izin'}
          valueColor={warn(phoneOn)}
          chevron={!phoneOn}
          onPress={phoneOn ? undefined : () => router.push('/izin-notifikasi')}
        />
        {/* Hanya di HP yang punya alarm sendiri (build Android dengan modul alarm). */}
        {alarm.native ? (
          <ListRow
            icon="clock"
            tone="agenda"
            iconSize={ICON}
            title="Alarm"
            value={alarm.status ? (alarmReady ? 'Siap' : 'Perlu izin') : undefined}
            valueColor={warn(alarmReady)}
            chevron
            onPress={() => router.push('/izin-alarm')}
          />
        ) : null}
        {/* Di HP ini saja: pengingat dan layar alarm bergetar. */}
        <ListRow
          icon="wave"
          tone="agenda"
          iconSize={ICON}
          title="Getar"
          trailing={
            <Toggle value={sound.vibrate} onChange={(next) => void sound.set({ vibrate: next })} label="Getar" />
          }
        />

        <View style={{ height: 16 }} />

        {account ? (
          kinds.map((k) => (
            <ListRow
              key={k.key}
              icon={KIND_ICON[k.key].icon}
              tone={KIND_ICON[k.key].tone}
              iconSize={ICON}
              title={k.title}
              trailing={
                <Toggle
                  value={account.notifications[k.key]}
                  onChange={(next) => void change(k.key, next)}
                  label={k.title}
                />
              }
            />
          ))
        ) : (
          <View style={{ gap: 8, paddingHorizontal: 20, paddingTop: 8 }}>
            <Txt color={c.muted}>{status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}</Txt>
            {status === 'error' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Coba lagi"
                onPress={() => void retry()}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Txt weight={600} color={c.brandInk}>
                  Coba lagi
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
