import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import type { IconName } from '@/ui/icons';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';
import { Wordmark } from '@/ui/Wordmark';

interface Row {
  icon: IconName;
  title: string;
  subtitle: string;
  /** Rute yang dibuka, atau teks toast bila layarnya belum dibangun. */
  go: { route: Href } | { toast: string };
}

// Akun (desain 2q). Baris yang layarnya belum ada memunculkan toast dengan nama fasenya.
export default function Akun() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
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
        subtitle: 'Diminta untuk mematikan kamera, alarm, dan membuka pintu',
        go: { toast: 'Pengaturan PIN dibangun di Fase 3.' },
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
        subtitle: 'Lewat aplikasi dulu. Lewat WhatsApp kalau aplikasi tidak aktif.',
        go: { toast: 'Pengaturan notifikasi dibangun di Fase 2.' },
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
            <Txt weight={700} color={c.green} style={{ fontSize: 20 }}>
              RW
            </Txt>
          </View>
          <View>
            <Txt v="subtitle">Rina Wulandari</Txt>
            <Txt color={c.muted} tabular>
              +62 812-2045-7781
            </Txt>
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
            <Txt v="subtitle">Paket Bisnis</Txt>
            <Txt v="caption" color={c.muted}>
              Aktif sampai 12 Jan 2027
            </Txt>
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
