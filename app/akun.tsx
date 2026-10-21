import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { formatPhoneDisplay, formatTanggal } from '@/api/format';
import { getAlarmScheduler } from '@/alarm';
import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { usePush, type PushPermission } from '@/api/usePush';
import { useSecurity } from '@/api/useSecurity';
import { useProfile, type Profile } from '@/api/useProfile';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { Initials } from '@/ui/Initials';
import type { IconName } from '@/ui/icons';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';
import { Wordmark } from '@/ui/Wordmark';

interface Row {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Rute yang dibuka, atau teks toast bila layarnya belum dibangun. */
  go: { route: Href } | { toast: string };
}

/** Isi kepala Akun. Mode contoh memakai isian desain; mode server hanya data akun asli, tanpa nama contoh. */
function accountOf(p: Profile) {
  if (p.sample) {
    return {
      title: 'Rina Wulandari',
      phone: '+62 812-2045-7781',
      plan: 'Paket Bisnis',
      until: 'Aktif sampai 12 Jan 2027' as string | null,
    };
  }
  const until = p.plan?.activeUntil ? formatTanggal(p.plan.activeUntil) : null;
  return {
    title: p.name ?? 'Akun Anda',
    phone: p.phone ? formatPhoneDisplay(p.phone) : null,
    plan: p.plan ? `Paket ${p.plan.name}` : 'Paket Anda',
    until: until ? `Aktif sampai ${until}` : null,
  };
}

const NOTIF_STATUS: Record<PushPermission, string> = {
  granted: 'Aktif',
  undetermined: 'Belum diizinkan',
  denied: 'Dimatikan di pengaturan HP',
};

// Akun (desain 2q). Baris yang layarnya belum ada memunculkan toast: di mode contoh dengan nama fasenya, di mode server
// cukup "segera hadir" (pengguna tidak perlu tahu soal fase).
export default function Akun() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const { mode } = useApi();
  const profile = useProfile();
  const { permission, canAskAgain } = usePush();
  const security = useSecurity();
  const alarm = useAlarmStatus();
  const account = accountOf(profile);
  const toast = (text: string) => dispatch({ type: 'showToast', text });
  const demo = mode === 'contoh';
  /** Toast layar yang belum ada: teks contoh bernama fase, atau teks netral di mode server. */
  const later = (contoh: string, server: string) => (demo ? contoh : server);

  const sections: Row[][] = [
    [
      {
        icon: 'user',
        title: 'Nama dan gaya asisten',
        subtitle: demo ? 'Nadia · ramah dan singkat' : undefined,
        go: { toast: later('Pengaturan asisten dibangun di Fase 2.', 'Pengaturan asisten segera hadir.') },
      },
    ],
    [
      {
        icon: 'lock',
        title: 'PIN',
        subtitle: security.state ? (security.state.pinEnabled ? 'Aktif' : 'Mati') : undefined,
        go: { route: '/akun/keamanan' },
      },
      {
        icon: 'shield',
        title: 'Privasi',
        subtitle: 'Lihat dan hapus yang Nadia tahu, per layanan',
        go: { toast: later('Pengaturan privasi dibangun di Fase 5.', 'Pengaturan privasi segera hadir.') },
      },
    ],
    [
      {
        icon: 'bell',
        title: 'Notifikasi',
        subtitle: NOTIF_STATUS[permission === 'denied' && canAskAgain ? 'undetermined' : permission],
        go: { route: '/izin-notifikasi' },
      },
      // Hanya di HP yang punya alarm sendiri (build Android dengan modul alarm).
      ...(getAlarmScheduler().native
        ? [
            {
              icon: 'clock' as const,
              title: 'Alarm tepat waktu',
              subtitle: alarm.status
                ? alarmBlocked(alarm.status)
                  ? 'Ada izin yang perlu dinyalakan'
                  : 'Siap, bunyi walau HP terkunci'
                : undefined,
              go: { route: '/izin-alarm' as Href },
            },
          ]
        : []),
    ],
    [
      {
        icon: 'phone',
        title: 'HP yang terhubung',
        subtitle: demo ? 'Pixel 8 (HP ini) dan 1 lainnya' : undefined,
        go: { toast: later('Daftar HP dibangun di Fase 2.', 'Daftar HP segera hadir.') },
      },
      {
        icon: 'link',
        title: 'Terhubung',
        subtitle: demo ? `${state.services.length} layanan dan perangkat` : undefined,
        go: { route: '/terhubung' },
      },
    ],
    [
      {
        icon: 'help',
        title: 'Bantuan',
        subtitle: 'Tanya jawab dan hubungi tim',
        go: { toast: later('Bantuan dibangun di Fase 5.', 'Bantuan segera hadir.') },
      },
      { icon: 'history', title: 'Riwayat', subtitle: 'Semua yang sudah Nadia kerjakan', go: { route: '/riwayat' } },
    ],
    [{ icon: 'logout', title: 'Keluar', go: { route: '/keluar' } }],
  ];
  const open = (r: Row) => ('route' in r.go ? router.push(r.go.route) : toast(r.go.toast));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="Akun" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4, paddingBottom: 8 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: c.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Initials size={20} />
          </View>
          <View>
            <Txt v="subtitle">{account.title}</Txt>
            {account.phone ? (
              <Txt color={c.muted} tabular>
                {account.phone}
              </Txt>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: c.mint,
            borderRadius: 24,
            paddingVertical: 16,
            paddingLeft: 20,
            paddingRight: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt v="caption" weight={600} color={c.green}>
              Langganan
            </Txt>
            <Txt v="subtitle">{account.plan}</Txt>
            {account.until ? (
              <Txt v="caption" color={c.muted}>
                {account.until}
              </Txt>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kelola"
            onPress={() => toast(later('Kelola langganan dibangun di Fase 5.', 'Kelola langganan segera hadir.'))}
            android_ripple={{ color: c.ripple }}
            style={{ height: 48, paddingHorizontal: 16, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
              Kelola
            </Txt>
          </Pressable>
        </View>

        {sections.map((rows, i) => (
          <ListGroup key={i}>
            {rows.map((r, j) => (
              <ListRow
                key={r.title}
                icon={r.icon}
                title={r.title}
                subtitle={r.subtitle}
                last={j === rows.length - 1}
                onPress={() => open(r)}
              />
            ))}
          </ListGroup>
        ))}

        {__DEV__ ? (
          <View style={{ gap: 8 }}>
            <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4, paddingTop: 8 }}>
              Coba
            </Txt>
            <ListGroup>
              <ListRow icon="auto" title="Layar pertama kali" onPress={() => router.push('/mulai')} />
              <ListRow
                icon="globe"
                title="Mode data"
                subtitle={mode === 'server' ? 'Server' : 'Contoh'}
                onPress={() => router.push('/mode')}
              />
              <ListRow icon="clock" title="Alarm" onPress={() => router.push('/alarm')} />
              <ListRow icon="info" title="Pemeriksa Inti" last onPress={() => router.push('/inti')} />
            </ListGroup>
          </View>
        ) : null}

        <View style={{ alignItems: 'center', gap: 8, paddingTop: 16 }}>
          <Wordmark size={16} />
          <Txt v="caption" color={c.muted}>
            Versi 1.0
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
