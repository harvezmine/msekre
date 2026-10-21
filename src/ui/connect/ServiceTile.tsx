import { router, type Href } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import type { Service } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { PressableScale } from '../kit/PressableScale';
import { Txt } from '../Txt';

/** Jalan menyambungkan: Kotak lewat Tambah perangkat, selain itu lembar masuk layanan. */
export const connectRoute = (id: string): Href =>
  id === 'kotak' ? '/perangkat/tambah' : `/terhubung/masuk?id=${encodeURIComponent(id)}`;

/** Huruf logo layanan: huruf pertama dua kata pertama ("Google Drive" -> "GD", "Notion" -> "No"). */
export function monoOf(name: string): string {
  const words = name.split(/[\s·&]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2);
}

const EDGE = 20;
const GAP = 12;

/** Lebar satu ubin di kisi: tiga kolom di HP biasa, empat di layar lebar (≥ 520). */
export function useTileWidth(): number {
  const { width } = useWindowDimensions();
  const cols = width >= 520 ? 4 : 3;
  return Math.floor((width - EDGE * 2 - GAP * (cols - 1)) / cols);
}

/** Lingkaran logo 56: huruf layanan (atau ikon), dengan lencana kecil hijau (tersambung) atau koral (perlu dilihat). */
export function ServiceMark({
  name,
  icon,
  badge,
  size = 56,
}: {
  name: string;
  icon?: IconName;
  badge?: 'on' | 'warn';
  size?: number;
}) {
  const { c, marker } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.sunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Icon name={icon} size={Math.round(size * 0.43)} color={c.text} />
      ) : (
        <Txt
          weight={700}
          maxFontSizeMultiplier={1.1}
          style={{ fontSize: Math.round(size * 0.3), lineHeight: size * 0.4 }}
        >
          {monoOf(name)}
        </Txt>
      )}
      {badge ? (
        <View
          testID={badge === 'on' ? 'lencana-tersambung' : 'lencana-perhatian'}
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: c.bg,
            backgroundColor: badge === 'on' ? c.brand : marker.warn.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={badge === 'on' ? 'check' : 'info'} size={13} color={c.onBrand} strokeWidth={2.6} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Satu ubin di kisi Terhubung: logo, nama pendek (≤ 2 baris). Tersambung = lencana centang hijau; yang segera hadir
 * diredupkan dan tidak bisa diketuk.
 */
export function ServiceTile({
  name,
  icon,
  badge,
  soon = false,
  label,
  onPress,
  width,
  testID,
}: {
  name: string;
  icon?: IconName;
  badge?: 'on' | 'warn';
  soon?: boolean;
  /** Nama lengkap untuk pembaca layar. */
  label: string;
  onPress?: () => void;
  width: number;
  testID?: string;
}) {
  const { c } = useTheme();
  const content = (
    <>
      <ServiceMark name={name} icon={icon} badge={badge} />
      <Txt
        v="caption"
        weight={600}
        numberOfLines={2}
        color={soon ? c.muted : c.text}
        style={{ textAlign: 'center', fontSize: 14, lineHeight: 18 }}
      >
        {name}
      </Txt>
      {soon ? (
        <Txt v="micro" color={c.muted} style={{ textAlign: 'center' }}>
          Segera hadir
        </Txt>
      ) : null}
    </>
  );
  const style = { width, minHeight: 112, alignItems: 'center' as const, gap: 8, paddingVertical: 8 };
  if (!onPress || soon) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={[style, soon ? { opacity: 0.6 } : null]}>
        {content}
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
      {content}
    </PressableScale>
  );
}

/** Kisi ubin tanpa kotak, dengan judul bagian kecil di atasnya. */
export function TileGrid({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Txt v="section" accessibilityRole="header" style={{ paddingHorizontal: EDGE }}>
          {title}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 8, paddingHorizontal: EDGE }}>
        {children}
      </View>
    </View>
  );
}

/** Ubin katalog: Sambungkan (lembar masuk) atau "Segera hadir". */
export function CatalogTile({ service, width }: { service: Service; width: number }) {
  const soon = service.status === 'soon';
  return (
    <ServiceTile
      name={service.name}
      soon={soon}
      width={width}
      label={soon ? `${service.name}. Segera hadir` : `Sambungkan ${service.name}`}
      onPress={() => router.push(connectRoute(service.id))}
    />
  );
}
