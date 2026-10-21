// Niat layar: melihat sekilas layanan mana yang sudah dikenal asisten (centang hijau) dan menyambungkan yang baru.
// Tindakan tersering: ketuk satu logo (tersambung: buka rinciannya; belum: sambungkan).
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByCategory, serviceLine } from '@/api/connections';
import { useConnections } from '@/api/useConnections';
import { useTheme } from '@/theme/ThemeProvider';
import { CatalogTile, ServiceTile, TileGrid, useTileWidth } from '@/ui/connect/ServiceTile';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { iconOr } from '@/ui/icons';
import { PressableScale } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

export default function Terhubung() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const tile = useTileWidth();
  const { connected, catalog, formerly, status, error, retry } = useConnections();
  const attention = connected.filter((s) => s.attention);
  const loaded = status === 'ready';
  const open = (id: string) => router.push(`/terhubung/${encodeURIComponent(id)}`);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top, minHeight: 64 + insets.top, justifyContent: 'center', paddingLeft: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 24 }}>
        <Txt v="title" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
          Terhubung
        </Txt>

        {!loaded ? (
          status === 'error' ? (
            <View style={{ gap: 16, alignItems: 'flex-start', paddingHorizontal: 20 }}>
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
            <Txt color={c.muted} style={{ paddingHorizontal: 20 }}>
              Sebentar ya, saya ambil dulu.
            </Txt>
          )
        ) : (
          <>
            {/* Yang perlu dilihat: satu baris tenang per layanan, di atas kisi. */}
            {attention.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Perlu dilihat: ${s.name}. ${s.attention?.text}`}
                onPress={() => open(s.id)}
                android_ripple={{ color: c.ripple }}
                style={{
                  marginHorizontal: 16,
                  minHeight: 56,
                  backgroundColor: c.sunken,
                  borderRadius: 20,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Icon name="info" size={22} color={marker.warn.ink} />
                <Txt weight={600} color={marker.warn.ink} style={{ flex: 1 }} numberOfLines={2}>
                  {s.name}
                </Txt>
                <Icon name="chevR" size={20} color={c.muted} />
              </Pressable>
            ))}

            <TileGrid title="Tersambung">
              {connected.length ? (
                connected.map((s) => (
                  <ServiceTile
                    key={s.id}
                    testID={`layanan-${s.id}`}
                    name={s.name}
                    badge={s.attention ? 'warn' : 'on'}
                    width={tile}
                    label={`${s.name}. ${serviceLine(s)}`}
                    onPress={() => open(s.id)}
                  />
                ))
              ) : (
                <Txt color={c.muted}>Belum ada yang tersambung.</Txt>
              )}
            </TileGrid>

            {groupByCategory(catalog).map((g) => (
              <TileGrid key={g.key} title={g.title}>
                {g.items.map((s) => (
                  <CatalogTile key={s.id} service={s} width={tile} />
                ))}
              </TileGrid>
            ))}
            {formerly.length ? (
              <TileGrid title="Pernah tersambung">
                {formerly.map((s) => (
                  <CatalogTile key={s.id} service={s} width={tile} />
                ))}
              </TileGrid>
            ) : null}
          </>
        )}

        <TileGrid title="Perangkat rumah">
          <ServiceTile
            name="Merek perangkat"
            icon={iconOr('bulb', 'link')}
            width={tile}
            label="Merek perangkat rumah. LG, Samsung, Philips Hue, Aqara, dan 5 lainnya"
            onPress={() => router.push('/perangkat/tambah')}
          />
          <ServiceTile
            name="Layanan lain"
            icon="plus"
            width={tile}
            label="Sambungkan layanan lain"
            onPress={() => toast('Menyambungkan layanan lain segera hadir.')}
          />
        </TileGrid>
      </ScrollView>
    </View>
  );
}
