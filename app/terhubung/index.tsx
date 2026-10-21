import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { groupByCategory, serviceLine } from '@/api/connections';
import { useConnections } from '@/api/useConnections';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { CatalogGroup } from '@/ui/connect/CatalogRow';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { iconOr } from '@/ui/icons';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';

// Daftar Terhubung (desain 2h, 2i): yang sudah tersambung, katalog menurut kelompok, Rumah, dan Lainnya.
export default function Terhubung() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useSampleDispatch();
  const { mode } = useApi();
  const { connected, catalog, formerly, status, error, retry } = useConnections();
  const attention = connected.filter((s) => s.needsAttention);
  const loaded = status === 'ready';

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 8, gap: 4 }}>
          <Txt v="display" accessibilityRole="header">
            Terhubung
          </Txt>
          <Txt v="subtitle" weight={400} color={c.muted}>
            Semua yang sudah Nadia kenal.
          </Txt>
        </View>

        {!loaded ? (
          status === 'error' ? (
            <View style={{ gap: 16, alignItems: 'flex-start', paddingHorizontal: 4 }}>
              <Txt>{error}</Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Coba lagi"
                onPress={() => void retry()}
                style={{
                  height: 48,
                  paddingHorizontal: 24,
                  borderRadius: 24,
                  backgroundColor: c.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt weight={600} color={c.onGreen}>
                  Coba lagi
                </Txt>
              </Pressable>
            </View>
          ) : (
            <Txt color={c.muted} style={{ paddingHorizontal: 4 }}>
              Sebentar ya, saya ambil dulu.
            </Txt>
          )
        ) : (
          <>
            {attention.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Perlu dilihat: ${s.name}. ${s.needsAttention}`}
                onPress={() => router.push(`/terhubung/${s.id}`)}
                android_ripple={{ color: c.ripple }}
                style={{
                  backgroundColor: c.clayBg,
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Icon name="info" size={22} color={c.clay} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight={600} color={c.clay}>
                    {s.name}
                  </Txt>
                  <Txt v="caption" color={c.clay}>
                    {s.needsAttention}
                  </Txt>
                </View>
                <Icon name="chevR" size={20} color={c.clay} />
              </Pressable>
            ))}

            <Section>Sudah terhubung</Section>
            {connected.length ? (
              <ListGroup>
                {connected.map((s, i) => (
                  <ListRow
                    key={s.id}
                    icon={iconOr(s.icon, 'link')}
                    title={s.name}
                    subtitle={serviceLine(s)}
                    warn={!!s.needsAttention}
                    last={i === connected.length - 1}
                    onPress={() => router.push(`/terhubung/${s.id}`)}
                  />
                ))}
              </ListGroup>
            ) : (
              <Txt color={c.muted} style={{ paddingHorizontal: 4 }}>
                Belum ada yang tersambung. Pilih dari daftar di bawah.
              </Txt>
            )}

            {groupByCategory(catalog).map((g) => (
              <CatalogGroup key={g.key} title={g.title} items={g.items} />
            ))}
            {formerly.length ? <CatalogGroup title="Pernah tersambung" items={formerly} /> : null}
          </>
        )}

        <Section>Perangkat rumah</Section>
        <ListGroup>
          <ListRow
            icon="bulb"
            title="Merek perangkat rumah"
            subtitle="LG, Samsung, Philips Hue, Aqara, dan 5 lainnya"
            last
            onPress={() => router.push('/perangkat/tambah')}
          />
        </ListGroup>

        <Section>Lainnya</Section>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sambungkan layanan lain"
          onPress={() =>
            dispatch({
              type: 'showToast',
              text:
                mode === 'contoh'
                  ? 'Menyambungkan layanan lain dibangun di Fase 5.'
                  : 'Menyambungkan layanan lain segera hadir.',
            })
          }
          android_ripple={{ color: c.ripple }}
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.line,
            borderRadius: 24,
            paddingHorizontal: 16,
            minHeight: 64,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon name="plus" size={22} color={c.green} />
          <Txt weight={600} color={c.green}>
            Sambungkan layanan lain
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ children }: { children: string }) {
  return (
    <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4, paddingTop: 12 }}>
      {children}
    </Txt>
  );
}
