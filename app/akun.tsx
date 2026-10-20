import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { formatPhoneDisplay, formatTanggal } from '@/api/format';
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

// Akun (desain 2q). Baris yang layarnya belum ada memunculkan toast dengan nama fasenya.
export default function Akun() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const { mode } = useApi();
  const profile = useProfile();
  const { permission, canAskAgain } = usePush();
  const security = useSecurity();
  const account = accountOf(profile);
  const toast = (text: string) => dispatch({ type: 'showToast', text });

  const sections: Row[][] = [
    [
      {
        icon: 'user',
        title: 'Nama dan gaya asisten',
        subtitle: 'Nadia · ramah dan singkat',
        go: { toast: 'Pengaturan asisten dibangun di Fase 2.' },
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
        go: { toast: 'Pengaturan privasi dibangun di Fase 5.' },
      },
    ],
    [
      {
        icon: 'bell',
        title: 'Notifikasi',
        subtitle: NOTIF_STATUS[permission === 'denied' && canAskAgain ? 'undetermined' : permission],
        go: { route: '/izin-notifikasi' },
      },
    ],
    [
      {
        icon: 'phone',
        title: 'HP yang terhubung',
        subtitle: 'Pixel 8 (HP ini) dan 1 lainnya',
        go: { toast: 'Daftar HP dibangun di Fase 2.' },
      },
      {
        icon: 'link',
        title: 'Terhubung',
        subtitle: `${state.services.length} layanan dan perangkat`,
        go: { route: '/terhubung' },
      },
    ],
    [
      {
        icon: 'help',
        title: 'Bantuan',
        subtitle: 'Tanya jawab dan hubungi tim',
        go: { toast: 'Bantuan dibangun di Fase 5.' },
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
            onPress={() => toast('Kelola langganan dibangun di Fase 5.')}
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
