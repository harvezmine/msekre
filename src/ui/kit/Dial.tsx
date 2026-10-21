import { useEffect, useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { BigNumber } from './BigNumber';
import {
  ARC_START,
  ARC_SWEEP,
  angleForValue,
  arcD,
  arcForValue,
  arcPosition,
  nudgeArc,
  onBand,
  pointOn,
  touchAngle,
  valueForArc,
} from './dialGeometry';
import { haptic } from './haptics';
import { useLayoutClass } from './layout';

/** Busur aktif: pucat → warna. `cool` (bawaan AC dingin, detail biru langit), `brand` hijau, `warm` hangat/kipas. */
export type DialArc = 'cool' | 'brand' | 'warm';
const STROKE = 18;
const KNOB = 17;
const MARGIN = 26;

export interface DialProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Nama untuk pembaca layar, contoh "Suhu AC kamar". */
  label: string;
  unit?: string;
  /** Warna busur aktif; bawaan `cool`. */
  arc?: DialArc;
  /** Jari-jari; bawaannya menurut kelas tata letak (108 / 122 / 134). */
  radius?: number;
  /** Ikon mode di atas angka (contoh salju), tanpa tulisan. */
  modeIcon?: IconName;
  /** Satu kata mode bila memang perlu (jarang). */
  caption?: string;
  /** Nilai kecil di bawah angka, contoh "Kamar 27°". */
  sub?: string;
  subIcon?: IconName;
  /** Perangkat mati: busur dan angka diredupkan. */
  dimmed?: boolean;
  /** Teks nilai untuk pembaca layar; bawaan "24 derajat". */
  valueText?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Dial suhu 270° (§8): busur r 134 tebal 18, lintasan `sunken2`, busur aktif bergradasi (biru langit dingin sebagai
 * detail), jempol putih r 17 dengan titik warna, tanpa label skala: hanya angka raksasa di tengah. Geser cincin untuk
 * mengubah (getar tiap langkah); pembaca layar memakai naik/turun.
 */
export function Dial({
  value,
  min = 16,
  max = 30,
  step = 1,
  onChange,
  label,
  unit = '°',
  arc = 'cool',
  radius,
  modeIcon,
  caption,
  sub,
  subIcon,
  dimmed = false,
  valueText,
  style,
  testID,
}: DialProps) {
  const { c, marker, shadow, scheme } = useTheme();
  const cls = useLayoutClass();
  const r = radius ?? (cls === 'compact' ? 108 : cls === 'regular' ? 122 : 134);
  const size = 2 * (r + MARGIN);
  const cx = size / 2;
  const cy = size / 2;
  // Pangkal busur pucat di terang, redup di gelap (papan 11), ujungnya warna penuh.
  const dark = scheme === 'dark';
  const tint =
    arc === 'cool'
      ? { pale: dark ? '#2A7891' : '#A7E1F4', base: marker.terhubung.base, ink: marker.terhubung.ink }
      : arc === 'warm'
        ? { pale: dark ? '#8A5A2B' : '#FFD5A8', base: marker.rumah.base, ink: marker.rumah.ink }
        : { pale: dark ? '#2F6E4E' : '#B5E3C6', base: c.brand, ink: c.brandInk };
  const gradId = `dial${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const last = useSharedValue(value);
  const pos = useSharedValue(arcForValue(value, min, max));
  const prevAngle = useSharedValue(0);
  const dragging = useSharedValue(false);
  useEffect(() => {
    if (dragging.get()) return;
    last.set(value);
    pos.set(arcForValue(value, min, max));
  }, [value, min, max, last, pos, dragging]);

  const emit = (v: number) => {
    haptic('selection');
    onChange(v);
  };
  const publish = () => {
    'worklet';
    const v = valueForArc(pos.get(), min, max, step);
    if (v === last.get()) return;
    last.set(v);
    scheduleOnRN(emit, v);
  };
  const pan = usePanGesture({
    manualActivation: true,
    onTouchesDown: (e) => {
      'worklet';
      const t = e.changedTouches[0];
      if (!t || !onBand(cx, cy, r, 28, t.x, t.y)) {
        GestureStateManager.fail(e.handlerTag);
        return;
      }
      const angle = touchAngle(cx, cy, t.x, t.y);
      const jump = arcPosition(angle);
      pos.set(jump ?? arcForValue(last.get(), min, max));
      prevAngle.set(angle);
      dragging.set(true);
      GestureStateManager.activate(e.handlerTag);
    },
    onActivate: () => {
      'worklet';
      publish();
    },
    onUpdate: (e) => {
      'worklet';
      const angle = touchAngle(cx, cy, e.x, e.y);
      pos.set(nudgeArc(pos.get(), prevAngle.get(), angle));
      prevAngle.set(angle);
      publish();
    },
    onFinalize: () => {
      'worklet';
      dragging.set(false);
    },
  });

  const nudge = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) emit(next);
  };

  const av = angleForValue(value, min, max);
  const end = ARC_START + ARC_SWEEP;
  const p0 = pointOn(cx, cy, r, ARC_START);
  const knob = pointOn(cx, cy, r, av);
  const activeEnd = dimmed ? c.faint : tint.base;
  const activeStart = dimmed ? c.sunken2 : tint.pale;
  const readoutSize = cls === 'compact' ? 80 : cls === 'regular' ? 92 : 100;
  const text = valueText ? valueText(value) : unit === '°' ? `${value} derajat` : `${value}${unit}`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') nudge(step);
        else if (e.nativeEvent.actionName === 'decrement') nudge(-step);
      }}
      style={[{ width: size, height: size, alignSelf: 'center' }, style]}
    >
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={p0.x} y1={p0.y} x2={knob.x} y2={knob.y}>
                <Stop offset="0" stopColor={activeStart} />
                <Stop offset="1" stopColor={activeEnd} />
              </LinearGradient>
            </Defs>
            <Path
              d={arcD(cx, cy, r, ARC_START, end)}
              stroke={c.sunken2}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
            {av > ARC_START + 0.5 ? (
              <Path
                d={arcD(cx, cy, r, ARC_START, av)}
                stroke={`url(#${gradId})`}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: knob.x - KNOB,
              top: knob.y - KNOB,
              width: KNOB * 2,
              height: KNOB * 2,
              borderRadius: KNOB,
              backgroundColor: '#FFFFFF',
              boxShadow: shadow.knob,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: activeEnd }} />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {modeIcon || caption ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}>
                {modeIcon ? (
                  <Icon name={modeIcon} size={28} color={dimmed ? c.muted : tint.ink} strokeWidth={2} />
                ) : null}
                {caption ? (
                  <Txt v="label" color={dimmed ? c.muted : tint.ink}>
                    {caption}
                  </Txt>
                ) : null}
              </View>
            ) : null}
            <BigNumber
              value={value}
              unit={unit}
              variant="readout"
              size={readoutSize}
              color={dimmed ? c.muted : c.text}
              style={{ marginLeft: unit === '°' ? readoutSize * 0.18 : 0 }}
            />
            {sub ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {subIcon ? <Icon name={subIcon} size={18} color={c.muted} /> : null}
                <Txt v="caption" tabular color={c.muted} style={{ fontSize: 15 }}>
                  {sub}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
