import { Pressable, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { RemoteKey as Key } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { haptic } from '../kit/haptics';
import { PressableScale } from '../kit/PressableScale';
import { Txt } from '../Txt';

const ARROWS: { key: Key; icon: IconName; label: string }[] = [
  { key: 'up', icon: 'chevU', label: 'Atas' },
  { key: 'down', icon: 'chevD', label: 'Bawah' },
  { key: 'left', icon: 'chevL', label: 'Kiri' },
  { key: 'right', icon: 'chevR', label: 'Kanan' },
];

/**
 * D-pad bundar seperti remote fisik (§7, papan 12): lingkaran 264 dengan empat arah, garis pemisah diagonal halus, dan
 * OK 92 di tengah dalam cincin cekung. Tiap arah bergetar ringan saat disentuh dan menggelap sedikit selama ditekan.
 * Arah yang tidak dimiliki perangkat tidak digambar.
 */
export function DPad({ size, keys, onKey }: { size: number; keys: readonly Key[]; onKey: (key: Key) => void }) {
  const { c, shadow, scheme } = useTheme();
  const r = size / 2;
  const ok = Math.round(size * 0.35);
  const ring = Math.round(size * 0.41);
  const zone = Math.round(size * 0.3);
  const face = scheme === 'dark' ? c.raised : c.surface;
  const diag = [45, 135, 225, 315].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const from = ring / 2 + 14;
    const to = r - 18;
    return {
      x1: r + from * Math.cos(a),
      y1: r + from * Math.sin(a),
      x2: r + to * Math.cos(a),
      y2: r + to * Math.sin(a),
    };
  });
  const at = (key: Key): { left: number; top: number } => {
    const mid = r - zone / 2;
    const edge = 6;
    if (key === 'up') return { left: mid, top: edge };
    if (key === 'down') return { left: mid, top: size - zone - edge };
    if (key === 'left') return { left: edge, top: mid };
    return { left: size - zone - edge, top: mid };
  };
  return (
    <View
      testID="dpad"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: face,
        boxShadow: shadow.key,
        alignSelf: 'center',
      }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={size} height={size}>
          {diag.map((d, i) => (
            <Line key={i} {...d} stroke={c.line} strokeWidth={1.5} strokeLinecap="round" />
          ))}
        </Svg>
      </View>
      {ARROWS.filter((a) => keys.includes(a.key)).map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPressIn={() => haptic('light')}
          onPress={() => onKey(a.key)}
          style={({ pressed }) => ({
            position: 'absolute',
            ...at(a.key),
            width: zone,
            height: zone,
            borderRadius: zone / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? c.sunken : 'transparent',
          })}
        >
          <Icon name={a.icon} size={28} color={c.muted} strokeWidth={2} />
        </Pressable>
      ))}
      {keys.includes('ok') ? (
        <View
          style={{
            position: 'absolute',
            left: r - ring / 2,
            top: r - ring / 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            backgroundColor: scheme === 'dark' ? c.bg : c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="OK"
            onPress={() => onKey('ok')}
            haptic="light"
            hapticOnPressIn
            scaleTo={0.94}
            style={{
              width: ok,
              height: ok,
              borderRadius: ok / 2,
              backgroundColor: face,
              boxShadow: shadow.key,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt v="section" style={{ fontSize: 22, lineHeight: 28 }} maxFontSizeMultiplier={1.2}>
              OK
            </Txt>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}
