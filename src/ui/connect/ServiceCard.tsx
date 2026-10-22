import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { Service, ServiceCategory } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category } from '@/theme/tokens';
import { Icon } from '../Icon';
import { PressableScale } from '../kit/PressableScale';
import { logoRadius, ServiceLogo, type LogoStatus } from '../kit/ServiceLogo';
import { Txt } from '../Txt';
import { cardName } from './logos';

/** Jalan menyambungkan: Kotak lewat Tambah perangkat, selain itu lembar masuk layanan. */
export const connectRoute = (id: string): Href =>
  id === 'kotak' ? '/perangkat/tambah' : `/terhubung/masuk?id=${encodeURIComponent(id)}`;

/** Keadaan logo sebuah layanan: tersambung (centang), perlu dilihat (titik koral), segera hadir (redup). */
export function logoStatus(s: Service): LogoStatus | undefined {
  if (s.status === 'soon') return 'soon';
  if (s.status !== 'connected') return undefined;
  return s.attention ? 'attention' : 'connected';
}

const EDGE = 20;
const GAP = 12;

/** Lebar satu kartu: dua kolom di HP, tiga di layar lebar (≥ 600). */
export function useCardWidth(): number {
  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 3 : 2;
  return Math.floor((width - EDGE * 2 - GAP * (cols - 1)) / cols);
}

/**
 * Deretan logo yang sedikit bertumpuk seperti dok aplikasi. Lebih dari `max`: ubin "+N" (atau dipotong saja bila
 * `more` mati, misalnya karena jumlahnya sudah tertulis di sebelahnya). Hiasan: pembungkusnya yang dibacakan.
 */
export function LogoDock({
  items,
  size = 40,
  max = 6,
  more = true,
  ring,
}: {
  items: { id: string; name: string }[];
  size?: number;
  max?: number;
  more?: boolean;
  /** Warna latar di belakang deretan (cincin pemisah antarubin). */
  ring?: string;
}) {
  const { c } = useTheme();
  const shown = items.slice(0, more && items.length > max ? max - 1 : max);
  const rest = more ? items.length - shown.length : 0;
  const edge = size >= 40 ? 3 : 2;
  const overlap = Math.round(size * 0.22);
  const back = ring ?? c.bg;
  const cell = (key: string, i: number, child: ReactNode) => (
    <View
      key={key}
      style={{
        marginLeft: i === 0 ? 0 : -overlap,
        padding: edge,
        borderRadius: logoRadius(size) + edge,
        backgroundColor: back,
        zIndex: max - i,
      }}
    >
      {child}
    </View>
  );
  return (
    <View testID="dok-layanan" style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -edge }}>
      {shown.map((s, i) => cell(s.id, i, <ServiceLogo id={s.id} name={s.name} size={size} shadow={false} />))}
      {rest > 0
        ? cell(
            'lainnya',
            shown.length,
            <View
              style={{
                width: size,
                height: size,
                borderRadius: logoRadius(size),
                backgroundColor: c.sunken,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt
                weight={600}
                color={c.muted}
                maxFontSizeMultiplier={1}
                style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.42) }}
              >
                +{rest}
              </Txt>
            </View>,
          )
        : null}
    </View>
  );
}

/** Penanda kecil kategori di judul kelompok (titik, bukan permukaan berwarna). */
const GROUP_MARKER: Partial<Record<ServiceCategory, Category>> = {
  kerja: 'agenda',
  catatan: 'terhubung',
  usaha: 'usaha',
  rumah: 'rumah',
};

/** Satu kelompok katalog: judul kecil bertitik penanda, lalu kartu dua kolom. */
export function CardGroup({
  title,
  category,
  children,
}: {
  title: string;
  category?: ServiceCategory;
  children: ReactNode;
}) {
  const { c, marker } = useTheme();
  const tone = category ? GROUP_MARKER[category] : undefined;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: EDGE }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone ? marker[tone].base : c.faint }} />
        <Txt v="section" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: EDGE }}>{children}</View>
    </View>
  );
}

/**
 * Kartu layanan: ubin logo + nama pendek (≤ 2 baris). Tersambung = takik centang hijau di logo; perlu dilihat = titik
 * koral; segera hadir = redup dengan kata "Segera", tidak bisa diketuk.
 */
export function ServiceCard({
  service,
  width,
  label,
  onPress,
  testID,
}: {
  service: Service;
  width: number;
  /** Nama lengkap untuk pembaca layar. */
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const status = logoStatus(service);
  const soon = status === 'soon';
  return (
    <CardFrame width={width} label={label} onPress={soon ? undefined : onPress} testID={testID} quiet={soon}>
      <ServiceLogo id={service.id} name={service.name} size={40} status={status} ring={soon ? c.bg : c.surface} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={600} numberOfLines={2} color={soon ? c.muted : c.text} style={{ fontSize: 15, lineHeight: 20 }}>
          {cardName(service.id, service.name)}
        </Txt>
        {soon ? (
          <Txt v="micro" color={c.muted}>
            Segera
          </Txt>
        ) : null}
      </View>
    </CardFrame>
  );
}

/** Bingkai kartu: permukaan putih (tenang = tanpa permukaan, untuk yang segera hadir). */
export function CardFrame({
  width,
  label,
  onPress,
  testID,
  quiet = false,
  children,
}: {
  width: number;
  label: string;
  onPress?: () => void;
  testID?: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  const { c, shadow } = useTheme();
  const style = {
    width,
    minHeight: 72,
    borderRadius: 22,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    ...(quiet ? { boxShadow: `inset 0 0 0 1px ${c.line}` } : { backgroundColor: c.surface, boxShadow: shadow.e1 }),
  };
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={style}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={style}
    >
      {children}
    </PressableScale>
  );
}

/** Kartu katalog: Sambungkan (lembar masuk, Kotak lewat Tambah perangkat) atau "Segera". */
export function CatalogCard({ service, width }: { service: Service; width: number }) {
  const soon = service.status === 'soon';
  return (
    <ServiceCard
      service={service}
      width={width}
      label={soon ? `${service.name}. Segera hadir` : `Sambungkan ${service.name}`}
      onPress={() => router.push(connectRoute(service.id))}
    />
  );
}

/** Ubin "tambah": garis putus-putus dengan plus, untuk "Layanan lain". */
export function PlusTile({ size = 40 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: logoRadius(size),
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.faint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="plus" size={Math.round(size * 0.5)} color={c.muted} />
    </View>
  );
}

/** Satu baris tenang untuk layanan yang perlu dilihat: logo, nama, kalimatnya dalam koral, chevron. */
export function AttentionBanner({ service, onPress }: { service: Service; onPress: () => void }) {
  const { c, marker } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Perlu dilihat: ${service.name}. ${service.attention?.text}`}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        marginHorizontal: 16,
        minHeight: 64,
        backgroundColor: c.sunken,
        borderRadius: 20,
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <ServiceLogo id={service.id} name={service.name} size={40} shadow={false} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={600} numberOfLines={1}>
          {cardName(service.id, service.name)}
        </Txt>
        <Txt v="caption" color={marker.warn.ink} numberOfLines={2}>
          {service.attention?.text}
        </Txt>
      </View>
      <Icon name="chevR" size={20} color={c.muted} />
    </Pressable>
  );
}
