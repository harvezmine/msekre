import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { getAlarmScheduler } from '@/alarm';
import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { NOTIFICATION_KINDS } from '@/api/account';
import { usePush, type PushPermission } from '@/api/usePush';
import { useAccount } from '@/api/useAccount';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const PERMISSION_TEXT: Record<PushPermission, string> = {
  granted: 'Aktif di HP ini',
  undetermined: 'Belum diizinkan di HP ini',
  denied: 'Dimatikan di pengaturan HP',
};

// Notifikasi (di bawah Akun): izin dari HP, izin alarm, dan jenis notifikasi mana yang dikirim.
export default function Notifikasi() {
  const { c } = useTheme();
  const { permission, canAskAgain } = usePush();
  const alarm = useAlarmStatus();
  const { account, status, error, retry, setNotifications } = useAccount();
  const toast = useToast();
  const change = async (key: (typeof NOTIFICATION_KINDS)[number]['key'], on: boolean) => {
    const res = await setNotifications({ [key]: on });
    if (!res.ok && res.message) toast(res.message);
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Notifikasi" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}>
        <ListGroup>
          <ListRow
            icon="bell"
            title="Izin notifikasi"
            subtitle={PERMISSION_TEXT[permission === 'denied' && canAskAgain ? 'undetermined' : permission]}
            last={!getAlarmScheduler().native}
            onPress={() => router.push('/izin-notifikasi')}
          />
          {getAlarmScheduler().native ? (
            <ListRow
              icon="clock"
              title="Alarm tepat waktu"
              subtitle={
                alarm.status
                  ? alarmBlocked(alarm.status)
                    ? 'Ada izin yang perlu dinyalakan'
                    : 'Siap, bunyi walau HP terkunci'
                  : undefined
              }
              last
              onPress={() => router.push('/izin-alarm' as Href)}
            />
          ) : null}
        </ListGroup>

        <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4, paddingTop: 8 }}>
          Kabar yang dikirim ke HP
        </Txt>
        {account ? (
          <ListGroup>
            {NOTIFICATION_KINDS.map((k, i) => (
              <ListRow
                key={k.key}
                icon="bell"
                title={k.title}
                subtitle={k.note}
                last={i === NOTIFICATION_KINDS.length - 1}
                trailing={
                  <Toggle
                    value={account.notifications[k.key]}
                    onChange={(next) => void change(k.key, next)}
                    label={k.title}
                  />
                }
              />
            ))}
          </ListGroup>
        ) : (
          <View style={{ gap: 8 }}>
            <Txt color={c.muted}>{status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}</Txt>
            {status === 'error' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void retry()}>
                <Txt weight={600} color={c.brandInk}>
                  Coba lagi
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}
        <Txt v="caption" color={c.muted} style={{ paddingHorizontal: 4 }}>
          Alarm yang sudah dijadwalkan di HP tetap berbunyi walau notifikasinya dimatikan di sini.
        </Txt>
      </ScrollView>
    </View>
  );
}
