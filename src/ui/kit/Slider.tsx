import { useEffect, useId, useRef } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { haptic } from './haptics';
import { clamp, defaultA11yStep, normalize, steppedValue } from './sliderMath';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Dipanggil tiap kali nilai bulat berganti saat digeser. */
  onChange: (value: number) => void;
  /** Dipanggil saat jari dilepas (kirim ke server di sini). */
  onChangeEnd?: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
  /** Nama untuk pembaca layar, contoh "Volume". */
  label: string;
  /** Teks nilai untuk pembaca layar dan tulisan kanan, contoh `(v) => `${v}%``. */
  valueText?: (value: number) => string;
  /** Tampilkan nilai di ujung kanan (horizontal). */
  showValue?: boolean;
  /** Ikon kiri (horizontal). */
  icon?: IconName;
  /** `brand`: isian hijau lembut (bawaan horizontal). `warm`: warna cahaya lampu itu sendiri (bawaan vertikal). */
  fill?: 'brand' | 'warm';
  /** Untuk `warm`: tiga warna cahaya dari atas ke bawah (lampu dengan suhu warna atau warna pilihan). */
  warmColors?: readonly [string, string, string];
  /** Vertikal: ikon di ujung atas dan bawah (bawaan matahari terang dan redup); `null` tanpa ikon. */
  endIcons?: { top: IconName; bottom: IconName } | null;
  /** Panjang lintasan (vertikal: tinggi). Horizontal bawaannya selebar wadah. */
  length?: number;
  /** Tebal lintasan: horizontal 56, vertikal 112. */
  thickness?: number;
  /** Getar tiap kelipatan ini; bawaan 10% rentang. */
  hapticEvery?: number;
  /** Langkah tombol naik/turun pembaca layar. */
  a11yStep?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Putih hangat 3000 K (§1.4). */
export const WARM = ['#FFE0A6', '#FFC979', '#F5A04F'] as const;

/**
 * Penggeser (§8). Horizontal 56 tinggi (volume): lintasan `sunken`, isian hijau lembut dengan pegangan hijau 4 dp.
 * Vertikal 112×440 (lampu): isian warna cahaya lampu dari bawah, garis pegangan putih, ikon matahari di dua ujung;
 * vertikal `brand` (tirai): isian hijau lembut dengan garis pegangan hijau.
 * Sentuh di mana saja untuk lompat lalu geser; getar halus tiap 10%. Untuk pembaca layar: kontrol `adjustable`.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onChangeEnd,
  orientation = 'horizontal',
  label,
  valueText,
  showValue = false,
  icon,
  fill = orientation === 'vertical' ? 'warm' : 'brand',
  warmColors = WARM,
  endIcons = { top: 'sun', bottom: 'sunLo' },
  length,
  thickness,
  hapticEvery,
  a11yStep,
  style,
  testID,
}: SliderProps) {
  const { c, radius } = useTheme();
  const reduce = useReducedMotion();
  const gradId = `isian${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const vertical = orientation === 'vertical';
  const thick = thickness ?? (vertical ? 112 : 56);
  const len = useSharedValue(length ?? 0);
  const pos = useSharedValue(normalize(value, min, max));
  const last = useSharedValue(value);
  const dragging = useSharedValue(false);
  const tickEvery = hapticEvery ?? (max - min) / 10;
  const lastTick = useRef(Math.floor((value - min) / tickEvery));

  useEffect(() => {
    if (dragging.get()) return;
    last.set(value);
    const target = normalize(value, min, max);
    pos.set(reduce ? target : withTiming(target, { duration: 160 }));
  }, [value, min, max, reduce, pos, last, dragging]);

  const emit = (v: number) => {
    const tick = Math.floor((v - min) / tickEvery);
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      haptic('selection');
    }
    onChange(v);
  };
  const end = (v: number) => onChangeEnd?.(v);

  const posAt = (x: number, y: number) => {
    'worklet';
    const L = len.get();
    if (L <= 0) return pos.get();
    return clamp(vertical ? 1 - y / L : x / L, 0, 1);
  };
  const publish = () => {
    'worklet';
    const v = steppedValue(pos.get(), min, max, step);
    if (v === last.get()) return;
    last.set(v);
    scheduleOnRN(emit, v);
  };

  const pan = usePanGesture({
    manualActivation: true,
    onTouchesDown: (e) => {
      'worklet';
      const t = e.changedTouches[0];
      if (!t) {
        GestureStateManager.fail(e.handlerTag);
        return;
      }
      dragging.set(true);
      pos.set(posAt(t.x, t.y));
      GestureStateManager.activate(e.handlerTag);
    },
    onActivate: () => {
      'worklet';
      publish();
    },
    onUpdate: (e) => {
      'worklet';
      pos.set(posAt(e.x, e.y));
      publish();
    },
    onFinalize: () => {
      'worklet';
      if (!dragging.get()) return;
      dragging.set(false);
      // Isian menempel ke nilai bulat terakhir.
      pos.set(normalize(last.get(), min, max));
      scheduleOnRN(end, last.get());
    },
  });

  const fillStyle = useAnimatedStyle(() => {
    const L = len.get();
    const size = Math.max(vertical ? 28 : thick, pos.get() * L);
    return vertical ? { height: size } : { width: size };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    if (length) return;
    const L = vertical ? e.nativeEvent.layout.height : e.nativeEvent.layout.width;
    len.set(L);
  };

  const shown = valueText ? valueText(value) : String(value);
  const step11y = a11yStep ?? defaultA11yStep(min, max, step);
  const nudge = (d: number) => {
    const next = clamp(value + d, min, max);
    if (next === value) return;
    haptic('selection');
    onChange(next);
    onChangeEnd?.(next);
  };

  const trackStyle: ViewStyle = vertical
    ? { width: thick, height: length ?? '100%', borderRadius: radius.sliderVertical }
    : { height: thick, width: length ?? '100%', borderRadius: thick / 2 };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') nudge(step11y);
        else if (e.nativeEvent.actionName === 'decrement') nudge(-step11y);
      }}
      style={style}
    >
      <GestureDetector gesture={pan}>
        <View
          collapsable={false}
          onLayout={onLayout}
          style={[trackStyle, { backgroundColor: c.sunken, overflow: 'hidden', justifyContent: 'center' }]}
        >
          <Animated.View
            style={[
              vertical
                ? { position: 'absolute', left: 0, right: 0, bottom: 0 }
                : { position: 'absolute', left: 0, top: 0, bottom: 0 },
              { borderRadius: vertical ? 0 : thick / 2, overflow: 'hidden' },
              fill === 'brand' ? { backgroundColor: c.brandSoft } : null,
              fillStyle,
            ]}
          >
            {fill === 'warm' ? (
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
              >
                <Defs>
                  <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={warmColors[0]} />
                    <Stop offset="0.3" stopColor={warmColors[1]} />
                    <Stop offset="1" stopColor={warmColors[2]} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradId})`} />
              </Svg>
            ) : null}
            {/* Pegangan: garis kecil di ujung isian. */}
            <View
              style={
                vertical
                  ? {
                      position: 'absolute',
                      top: 12,
                      left: (thick - 36) / 2,
                      width: 36,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: fill === 'brand' ? c.brand : 'rgba(255,255,255,0.85)',
                    }
                  : {
                      position: 'absolute',
                      right: 10,
                      top: 14,
                      bottom: 14,
                      width: 4,
                      borderRadius: 2,
                      backgroundColor: c.brand,
                    }
              }
            />
          </Animated.View>
          {vertical ? (
            endIcons ? (
              <>
                <View pointerEvents="none" style={{ position: 'absolute', top: 24, alignSelf: 'center' }}>
                  <Icon name={endIcons.top} size={24} color={c.muted} />
                </View>
                <View pointerEvents="none" style={{ position: 'absolute', bottom: 22, alignSelf: 'center' }}>
                  {/* Di atas isian warna cahaya (selalu terang), jadi warnanya tetap gelap di dua mode. */}
                  <Icon name={endIcons.bottom} size={22} color={fill === 'warm' ? '#A64F08' : c.brandInk} />
                </View>
              </>
            ) : null
          ) : (
            <View
              pointerEvents="none"
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 }}
            >
              {icon ? <Icon name={icon} size={22} color={c.brandInk} /> : null}
              <View style={{ flex: 1 }} />
              {showValue ? (
                <Txt v="label" weight={600} tabular color={c.muted}>
                  {shown}
                </Txt>
              ) : null}
            </View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}
