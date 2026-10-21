import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import {
  ACCOUNT_TZ_MINUTES,
  HELP_TEXT,
  openWhatsApp,
  planText,
  RENEW_TEXT,
  STYLES,
  WA_UNAVAILABLE_TEXT,
} from '@/api/account';
import type { AccountPlan } from '@/api/contract';
import { formatPhoneDisplay } from '@/api/format';
import { useAccount } from '@/api/useAccount';
import { useAgenda } from '@/api/useAgenda';
import { useConnections } from '@/api/useConnections';
import { getAlarmScheduler } from '@/alarm';
import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { usePush, type PushPermission } from '@/api/usePush';
import { useSecurity } from '@/api/useSecurity';
import { versionText } from '@/api/version';
import { useProfile, type Profile } from '@/api/useProfile';
import { APPEARANCE_LABEL, useAppearance } from '@/theme/appearance';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { Initials } from '@/ui/Initials';
import type { IconName } from '@/ui/icons';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';
import { Wordmark } from '@/ui/Wordmark';
import { useToast } from '@/ui/toastStore';

interface Row {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Rute yang dibuka, atau teks toast bila layarnya belum dibangun. */
  go: { route: Href } | { toast: string } | { run: () => void };
}

/** Isi kepala Akun. Mode contoh memakai isian desain; mode server hanya data akun asli, tanpa nama contoh. */
function accountOf(p: Profile) {
  if (p.sample) return { title: 'Rina Wulandari', phone: '+62 812-2045-7781' };
  return { title: p.name ?? 'Akun Anda', phone: p.phone ? formatPhoneDisplay(p.phone) : null };
}

/** Baris HP: "Pixel 8 (HP ini)" bila sendiri, selain itu "Pixel 8 (HP ini) dan 1 lainnya". */
function phonesLine(phones: { name: string; current: boolean }[]): string {
  const here = phones.find((p) => p.current);
  const others = phones.length - (here ? 1 : 0);
  if (!here) return `${phones.length} HP`;
  return others > 0 ? `${here.name} (HP ini) dan ${others} lainnya` : `${here.name} (HP ini)`;
}

const NOTIF_STATUS: Record<PushPermission, string> = {
  granted: 'Aktif',
  undetermined: 'Belum diizinkan',
  denied: 'Dimatikan di pengaturan HP',
};

// Akun (desain 2q). Baris yang layarnya belum ada memunculkan toast "segera hadir".
export default function Akun() {
  const { c } = useTheme();
  const connections = useConnections();
  const { mode } = useApi();
  const profile = useProfile();
  const { account: data, status: accountStatus, retry } = useAccount();
  const { permission, canAskAgain } = usePush();
  const appearance = useAppearance();
  const security = useSecurity();
  const alarm = useAlarmStatus();
  // Hari terakhir paket dihitung di zona waktu pengguna (dari agenda bila sudah dimuat, bawaan WIB).
  const { tzOffsetMinutes } = useAgenda();
  const account = accountOf(profile);
  const plan: AccountPlan | null = data?.plan ?? null;
  const assistant = data?.assistant.name ?? profile.assistantName;
  const style = STYLES.find((s) => s.value === data?.assistant.style)?.title.toLowerCase();
  const renew = async () => {
    if (!(await openWhatsApp(RENEW_TEXT))) toast(WA_UNAVAILABLE_TEXT);
  };
  const toast = useToast();
  const demo = mode === 'contoh';
  const help = async () => {
    if (!(await openWhatsApp(HELP_TEXT))) toast(WA_UNAVAILABLE_TEXT);
  };

  const sections: Row[][] = [
    [
      {
        icon: 'user',
        title: 'Nama dan gaya asisten',
        subtitle: data ? `${assistant} · ${style ?? ''}`.replace(/ · $/, '') : undefined,
        go: { route: '/akun/asisten' },
      },
      {
        icon: 'chat',
        title: 'Sapaan harian',
        subtitle: data ? (data.greeting.daily ? `Tiap hari jam ${data.greeting.time ?? '07.00'}` : 'Mati') : undefined,
        go: { route: '/akun/sapaan' },
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
        subtitle: `Lihat dan hapus yang ${assistant} tahu, per layanan`,
        go: { route: '/akun/privasi' },
      },
    ],
    [
      {
        icon: 'bell',
        title: 'Notifikasi',
        subtitle: NOTIF_STATUS[permission === 'denied' && canAskAgain ? 'undetermined' : permission],
        go: { route: '/akun/notifikasi' },
      },
      {
        icon: 'moon',
        title: 'Tampilan',
        subtitle: APPEARANCE_LABEL[appearance.preference],
        go: { route: '/akun/tampilan' },
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
        subtitle: data ? phonesLine(data.phones) : undefined,
        go: { route: '/akun/hp' },
      },
      {
        icon: 'link',
        title: 'Terhubung',
        subtitle:
          connections.connected.length > 0 ? `${connections.connected.length} layanan dan perangkat` : undefined,
        go: { route: '/terhubung' },
      },
    ],
    [
      {
        icon: 'help',
        title: 'Bantuan',
        subtitle: 'Tanya jawab dan hubungi tim',
        // Mode server: lapor kendala lewat WhatsApp Sekretaris AI; nomor belum diatur: toast ramah.
        go: demo ? { toast: 'Bantuan segera hadir.' } : { run: () => void help() },
      },
      {
        icon: 'history',
        title: 'Riwayat',
        subtitle: `Semua yang sudah ${assistant} kerjakan`,
        go: { route: '/riwayat' },
      },
    ],
    [{ icon: 'logout', title: 'Keluar', go: { route: '/keluar' } }],
  ];
  const open = (r: Row) => {
    if ('route' in r.go) router.push(r.go.route);
    else if ('run' in r.go) r.go.run();
    else toast(r.go.toast);
  };

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

        {plan ? (
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
              <Txt v="subtitle">{`Paket ${plan.name}`}</Txt>
              <Txt v="caption" color={plan.status === 'berakhir' ? c.clay : c.muted}>
                {planText(plan, undefined, tzOffsetMinutes ?? ACCOUNT_TZ_MINUTES)}
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Perpanjang"
              onPress={() => void renew()}
              android_ripple={{ color: c.ripple }}
              style={{ height: 48, paddingHorizontal: 16, justifyContent: 'center' }}
            >
              <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                Perpanjang
              </Txt>
            </Pressable>
          </View>
        ) : accountStatus === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Muat paket lagi"
            onPress={() => void retry()}
            style={{ backgroundColor: c.mint, borderRadius: 24, padding: 16 }}
          >
            <Txt color={c.muted}>Paket belum bisa dimuat. Ketuk untuk mencoba lagi.</Txt>
          </Pressable>
        ) : null}

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
            {versionText()}
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
