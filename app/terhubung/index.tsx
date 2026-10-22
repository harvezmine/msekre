// Niat layar: melihat sekilas layanan mana yang sudah dikenal asisten (dok logo di atas, centang hijau di kartu) dan
// menyambungkan yang baru. Tindakan tersering: ketuk satu kartu logo (tersambung: buka rinciannya; belum: sambungkan).
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, serviceLine } from '@/api/connections';
import type { Service, ServiceCategory } from '@/api/contract';
import { useConnections } from '@/api/useConnections';
import { useTheme } from '@/theme/ThemeProvider';
import { SampleBanner } from '@/ui/SampleBanner';
import {
  AttentionBanner,
  CardFrame,
  CardGroup,
  CatalogCard,
  LogoDock,
  PlusTile,
  ServiceCard,
  useCardWidth,
} from '@/ui/connect/ServiceCard';
import { IconButton } from '@/ui/IconButton';
import { PressableScale, ServiceLogo } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

/** Urutan dalam kelompok: tersambung dulu, lalu yang bisa disambungkan (termasuk yang pernah), lalu yang segera hadir. */
const RANK: Record<Service['status'], number> = { connected: 0, available: 1, formerly: 1, soon: 2 };

/** Semua layanan menurut kelompok; kelompok kosong dibuang, kecuali Rumah dan Lainnya (kartu tambahannya selalu ada). */
function groups(services: Service[]): { key: ServiceCategory; title: string; items: Service[] }[] {
  return CATEGORIES.flatMap((c) => {
    const items = services.filter((s) => s.category === c.key).sort((a, b) => RANK[a.status] - RANK[b.status]);
    return items.length || c.key === 'rumah' || c.key === 'lainnya' ? [{ ...c, items }] : [];
  });
}

export default function Terhubung() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const card = useCardWidth();
  const { connected, catalog, formerly, status, error, retry } = useConnections();
  const attention = connected.filter((s) => s.attention);
  const loaded = status === 'ready';
  const open = (id: string) => router.push(`/terhubung/${encodeURIComponent(id)}`);
  const count = connected.length;
  const heroLine = count ? `${count} layanan tersambung` : 'Belum ada yang tersambung';

  const extra = (key: ServiceCategory) =>
    key === 'rumah' ? (
      <CardFrame
        key="merek"
        width={card}
        label="Merek perangkat rumah. LG, Samsung, Philips Hue, Aqara, dan 5 lainnya"
        onPress={() => router.push('/perangkat/tambah')}
      >
        <ServiceLogo id="merek" size={40} ring={c.surface} />
        <Txt weight={600} numberOfLines={2} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
          Merek perangkat
        </Txt>
      </CardFrame>
    ) : key === 'lainnya' ? (
      <CardFrame
        key="lain"
        width={card}
        label="Sambungkan layanan lain"
        onPress={() => toast('Menyambungkan layanan lain segera hadir.')}
      >
        <PlusTile />
        <Txt weight={600} numberOfLines={2} color={c.muted} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
          Layanan lain
        </Txt>
      </CardFrame>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top, minHeight: 64 + insets.top, justifyContent: 'center', paddingLeft: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <SampleBanner area="terhubung" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 28 }}>
        {!loaded ? (
          <View style={{ gap: 16, paddingHorizontal: 20 }}>
            <Txt v="title" accessibilityRole="header">
              Terhubung
            </Txt>
            {status === 'error' ? (
              <View style={{ gap: 16, alignItems: 'flex-start' }}>
                <Txt>{error}</Txt>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Coba lagi"
                  onPress={() => void retry()}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 28,
                    borderRadius: 28,
                    backgroundColor: c.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt weight={600} color={c.onBrand}>
                    Coba lagi
                  </Txt>
                </PressableScale>
              </View>
            ) : (
              <Txt color={c.muted}>Sebentar ya, saya ambil dulu.</Txt>
            )}
          </View>
        ) : (
          <>
            {/* Sekilas: judul, dok logo yang tersambung, satu baris jumlahnya. */}
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={`Terhubung. ${heroLine}`}
              style={{ gap: 14, paddingHorizontal: 20 }}
            >
              <Txt v="title">Terhubung</Txt>
              {count ? <LogoDock items={connected} size={40} max={7} /> : null}
              <Txt v="row" color={c.muted}>
                {heroLine}
              </Txt>
            </View>

            {attention.map((s) => (
              <AttentionBanner key={s.id} service={s} onPress={() => open(s.id)} />
            ))}

            {groups([...connected, ...catalog, ...formerly]).map((g) => (
              <CardGroup key={g.key} title={g.title} category={g.key}>
                {g.items.map((s) =>
                  s.status === 'connected' ? (
                    <ServiceCard
                      key={s.id}
                      testID={`layanan-${s.id}`}
                      service={s}
                      width={card}
                      label={`${s.name}. ${serviceLine(s)}`}
                      onPress={() => open(s.id)}
                    />
                  ) : (
                    <CatalogCard key={s.id} service={s} width={card} />
                  ),
                )}
                {extra(g.key)}
              </CardGroup>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
