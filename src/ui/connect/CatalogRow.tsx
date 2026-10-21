import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Service } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { ServiceTile } from './ServiceTile';

/** Jalan menyambungkan: Kotak lewat Tambah perangkat, selain itu lembar masuk layanan. */
export const connectRoute = (id: string): Href =>
  id === 'kotak' ? '/perangkat/tambah' : `/terhubung/masuk?id=${encodeURIComponent(id)}`;

/** Satu baris katalog (desain 2h): ubin huruf, nama, dan "Sambungkan" atau lencana "Segera hadir". */
export function CatalogRow({ service, last }: { service: Service; last: boolean }) {
  const { c } = useTheme();
  const soon = service.status === 'soon';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}
    >
      <ServiceTile name={service.name} />
      <Txt weight={500} style={{ flex: 1, minWidth: 0 }} color={soon ? c.muted : undefined}>
        {service.name}
      </Txt>
      {soon ? (
        <View
          accessible
          accessibilityLabel={`${service.name}. Segera hadir`}
          style={{
            marginRight: 12,
            paddingHorizontal: 10,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.bg,
            justifyContent: 'center',
          }}
        >
          <Txt v="caption" color={c.muted}>
            Segera hadir
          </Txt>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sambungkan ${service.name}`}
          onPress={() => router.push(connectRoute(service.id))}
          android_ripple={{ color: c.ripple }}
          style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.brandInk} style={{ fontSize: 15 }}>
            Sambungkan
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Kartu pembungkus baris-baris katalog. */
export function CatalogGroup({ title, items }: { title: string; items: Service[] }) {
  const { c, shadow } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4, paddingTop: 12 }}>
        {title}
      </Txt>
      <View
        style={{
          backgroundColor: c.surface,
          boxShadow: shadow.e1,
          borderRadius: 24,
          paddingVertical: 4,
          paddingLeft: 16,
          paddingRight: 4,
        }}
      >
        {items.map((s, i) => (
          <CatalogRow key={s.id} service={s} last={i === items.length - 1} />
        ))}
      </View>
    </View>
  );
}
