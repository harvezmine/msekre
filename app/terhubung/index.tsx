import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initialServices, serviceDef, serviceGroups, serviceInfo } from '@/sample/services';
import { serviceStatus, useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';

// Daftar Terhubung (desain 2h): yang sudah tersambung, yang bisa disambungkan, Rumah, dan Lainnya.
export default function Terhubung() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useSample();
  const connected = new Set(state.services.map((s) => s.id));
  const groups = [
    ...serviceGroups,
    // Layanan awal yang sudah diputus bisa disambungkan lagi dari sini.
    { title: 'Pernah tersambung', ids: initialServices.map((s) => s.id) },
  ].flatMap((g) => {
    const items = g.ids.filter((id) => !connected.has(id));
    return items.length ? [{ title: g.title, items }] : [];
  });
  const nameOf = (id: string) => serviceDef(id)?.name ?? id;

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

        <Section>Sudah terhubung</Section>
        <ListGroup>
          {state.services.map((s, i) => (
            <ListRow
              key={s.id}
              icon={s.icon}
              title={s.name}
              subtitle={serviceStatus(s)}
              warn={!s.reachable}
              last={i === state.services.length - 1}
              onPress={() => router.push(`/terhubung/${s.id}`)}
            />
          ))}
        </ListGroup>

        {groups.map((g) => (
          <View key={g.title} style={{ gap: 12 }}>
            <Section>{g.title}</Section>
            <View
              style={{
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 24,
                paddingVertical: 4,
                paddingLeft: 16,
                paddingRight: 4,
              }}
            >
              {g.items.map((id, i) => {
                const name = nameOf(id);
                return (
                  <View
                    key={id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 60,
                      borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                      borderBottomColor: c.line,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        backgroundColor: c.paper,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt weight={700} style={{ fontSize: 13 }}>
                        {serviceInfo[id]?.mono ?? name.slice(0, 2)}
                      </Txt>
                    </View>
                    <Txt weight={500} style={{ flex: 1, minWidth: 0 }}>
                      {name}
                    </Txt>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sambungkan ${name}`}
                      onPress={() => router.push(id === 'kotak' ? '/perangkat/tambah' : `/terhubung/masuk?id=${id}`)}
                      android_ripple={{ color: c.ripple }}
                      style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
                    >
                      <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                        Sambungkan
                      </Txt>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Section>Rumah</Section>
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
          onPress={() => dispatch({ type: 'showToast', text: 'Menyambungkan layanan lain dibangun di Fase 5.' })}
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
