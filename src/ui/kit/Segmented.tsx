import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import { haptic } from './haptics';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Nama kelompok untuk pembaca layar. */
  label?: string;
  /** Tulisan per pilihan bila berbeda dari nilainya. */
  labels?: Partial<Record<T, string>>;
  /** Pilihan selebar isinya dan bisa digeser (contoh daftar ruangan). */
  scrollable?: boolean;
  /** Isi pengganti tulisan (contoh ikon kecepatan kipas); nama pembaca layar tetap dari `labels`. */
  renderOption?: (option: T, selected: boolean) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const PAD = 4;
const SEG_H = 44;

/**
 * Pilihan bersegmen (§8): lintasan `sunken` radius 18, jempol `surface` radius 14 dengan bayangan kecil (gelap: `sunken2`
 * tanpa bayangan), jempol meluncur 200 ms. Segmen 44 dp (lintasan 52). Getar `selection` saat berganti. Isinya satu kata
 * atau ikon; untuk pilihan dengan ikon saja beri `labels` sebagai nama pembaca layar.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  labels,
  scrollable = false,
  renderOption,
  style,
  testID,
}: Props<T>) {
  const { c, shadow, scheme, radius, motion } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = useSharedValue(0);
  const target = layouts[value];
  useEffect(() => {
    if (!target) return;
    if (ready.get() === 0 || reduce) {
      x.set(target.x);
      w.set(target.w);
      ready.set(1);
      return;
    }
    x.set(withTiming(target.x, { duration: motion.segment.duration }));
    w.set(withTiming(target.w, { duration: motion.segment.duration }));
  }, [target, reduce, x, w, ready, motion.segment.duration]);

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: ready.get(),
    width: w.get(),
    transform: [{ translateX: x.get() }],
  }));

  const onLayoutOf = (o: T) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const old = prev[o];
      if (old && old.x === lx && old.w === width) return prev;
      return { ...prev, [o]: { x: lx, w: width } };
    });
  };

  const thumbBg = scheme === 'dark' ? c.sunken2 : c.surface;
  const measured = !!target;

  const row = (
    <View style={{ flexDirection: 'row', gap: 2, flexGrow: 1 }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            height: SEG_H,
            borderRadius: radius.segmentThumb,
            backgroundColor: thumbBg,
            boxShadow: shadow.thumb,
          },
          thumbStyle,
        ]}
      />
      {options.map((o) => {
        const selected = o === value;
        const text = labels?.[o] ?? o;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityLabel={text}
            accessibilityState={{ selected }}
            onLayout={onLayoutOf(o)}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(o);
            }}
            style={{
              flex: scrollable ? undefined : 1,
              height: SEG_H,
              paddingHorizontal: scrollable ? 14 : 10,
              borderRadius: radius.segmentThumb,
              alignItems: 'center',
              justifyContent: 'center',
              // Sebelum letak terukur, jempol belum tampil: segmen terpilih memakai latarnya sendiri.
              backgroundColor: selected && !measured ? thumbBg : 'transparent',
            }}
          >
            {renderOption ? (
              renderOption(o, selected)
            ) : (
              <Txt v="label" weight={selected ? 600 : 500} color={selected ? c.text : c.muted} numberOfLines={1}>
                {text}
              </Txt>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  const track: ViewStyle = { backgroundColor: c.sunken, borderRadius: radius.segmentTrack, padding: PAD };
  if (scrollable) {
    return (
      <View
        testID={testID}
        accessibilityRole="tablist"
        accessibilityLabel={label}
        style={[track, { paddingHorizontal: 0 }, style]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD }}
        >
          {row}
        </ScrollView>
      </View>
    );
  }
  return (
    <View testID={testID} accessibilityRole="tablist" accessibilityLabel={label} style={[track, style]}>
      {row}
    </View>
  );
}
