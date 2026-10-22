import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { logoFor, type LogoDef } from '../connect/logos';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { toneForName } from './toneForName';

const MARK = require('../../../assets/brand/s-mark.png');
const MARK_LIGHT = require('../../../assets/brand/s-mark-light.png');

/** Ukuran ubin yang dipakai: 28 (deretan kecil), 40 (baris, kartu), 56 (lembar), 72 (kepala detail, Tersambung). */
export const LOGO_SIZES = [28, 40, 56, 72] as const;

/** `connected` = takik centang hijau di pojok; `attention` = titik koral kecil; `soon` = ubin diredupkan. */
export type LogoStatus = 'connected' | 'attention' | 'soon';

/** Sudut ubin: 28% sisi, seperti ikon aplikasi. */
export const logoRadius = (size: number) => Math.round(size * 0.28);

function Mark({ def, box, ink }: { def: Exclude<LogoDef, { kind: 'stack' | 'initial' }>; box: number; ink: string }) {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  if (def.kind === 'svg') {
    return <SvgXml xml={def.xml} width={box} height={box} color={def.mono ? (dark ? ink : def.mono) : undefined} />;
  }
  if (def.kind === 'png') {
    return (
      <Image
        testID="logo-gambar"
        source={def.source}
        resizeMode="contain"
        style={{ width: box, height: box, ...(def.mono && dark ? { tintColor: ink } : null) }}
      />
    );
  }
  // Tanda S: 282 × 310.
  return (
    <Image
      source={dark ? MARK_LIGHT : MARK}
      resizeMode="contain"
      style={{ height: box, width: Math.round((box * 282) / 310) }}
    />
  );
}

/**
 * Logo layanan dalam ubin persegi membulat seperti ikon aplikasi (bukan lingkaran): putih di mode terang, permukaan
 * timbul di mode gelap, garis tipis dan bayangan halus. Merek tanpa logo bebas pakai = ubin berwarna merek dengan huruf
 * putih; layanan yang tidak dikenal = ubin netral dengan huruf berwarna penanda. Hiasan: nama layanan dibacakan oleh
 * baris atau kartu pembungkusnya.
 */
export function ServiceLogo({
  id,
  name,
  size = 40,
  status,
  ring,
  shadow = size >= 40,
  testID,
  style,
}: {
  /** id layanan (`gmail`, `moka`, ...); id lain dicocokkan lewat nama. */
  id: string;
  name?: string;
  size?: number;
  status?: LogoStatus;
  /** Warna di belakang ubin (cincin pemisah lencana dan deretan); bawaan latar layar. */
  ring?: string;
  /** Bayangan halus di bawah ubin; bawaan untuk 40 ke atas. */
  shadow?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, marker, scheme } = useTheme();
  const dark = scheme === 'dark';
  const def = logoFor(id, name);
  const r = logoRadius(size);
  const brandTile = def.kind === 'initial' && def.color;
  const tile: ViewStyle = brandTile
    ? { backgroundColor: def.color! }
    : {
        backgroundColor: dark ? c.raised : '#FFFFFF',
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.07)' : c.line,
      };
  const lift = shadow
    ? dark
      ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 10px -4px rgba(0,0,0,0.6)'
      : '0 1px 2px rgba(21,24,27,0.05), 0 6px 14px -6px rgba(21,24,27,0.14)'
    : undefined;

  let content: React.ReactNode;
  if (def.kind === 'initial') {
    const text = def.text;
    const fontSize = Math.round(size * (text.length >= 3 ? 0.28 : text.length === 2 ? 0.36 : 0.46));
    content = (
      <Txt
        // Huruf logo hiasan: nama layanan dibacakan pembungkusnya, jangan dibaca lagi sendiri.
        accessibilityElementsHidden
        importantForAccessibility="no"
        weight={700}
        maxFontSizeMultiplier={1}
        color={def.color ? '#FFFFFF' : marker[toneForName(name || id)].ink}
        style={{ fontSize, lineHeight: Math.round(fontSize * 1.15), letterSpacing: text.length >= 3 ? 0.2 : -0.4 }}
      >
        {text}
      </Txt>
    );
  } else if (def.kind === 'stack') {
    // Tiga logo kecil dalam segitiga: dua di atas, satu di tengah bawah.
    const part = Math.round(size * 0.38);
    const spots = [
      { left: size * 0.1, top: size * 0.12 },
      { left: size * 0.52, top: size * 0.12 },
      { left: size * 0.31, top: size * 0.5 },
    ];
    content = def.parts.slice(0, 3).map((p, i) => (
      <View key={p.key} style={{ position: 'absolute', ...spots[i] }}>
        {p.kind === 'stack' || p.kind === 'initial' ? null : <Mark def={p} box={part} ink={c.text} />}
      </View>
    ));
  } else {
    content = <Mark def={def} box={Math.round(size * def.scale)} ink={c.text} />;
  }

  const badge = Math.max(14, Math.min(24, Math.round(size * 0.36)));
  const dot = Math.max(10, Math.min(16, Math.round(size * 0.24)));
  const ringColor = ring ?? c.bg;
  return (
    <View testID={testID} style={[{ width: size, height: size }, style]}>
      <View
        testID={`logo-${def.key}`}
        style={[
          {
            width: size,
            height: size,
            borderRadius: r,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: lift,
          },
          tile,
          status === 'soon' ? { opacity: 0.45, filter: [{ grayscale: 1 }] } : null,
        ]}
      >
        {content}
      </View>
      {status === 'connected' ? (
        <View
          testID="lencana-tersambung"
          style={{
            position: 'absolute',
            right: -Math.round(badge * 0.28),
            bottom: -Math.round(badge * 0.28),
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            borderWidth: 2,
            borderColor: ringColor,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={Math.round(badge * 0.62)} color={c.onBrand} strokeWidth={3} />
        </View>
      ) : status === 'attention' ? (
        <View
          testID="lencana-perhatian"
          style={{
            position: 'absolute',
            right: -Math.round(dot * 0.3),
            top: -Math.round(dot * 0.3),
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: 2,
            borderColor: ringColor,
            backgroundColor: marker.warn.base,
          }}
        />
      ) : null}
    </View>
  );
}
