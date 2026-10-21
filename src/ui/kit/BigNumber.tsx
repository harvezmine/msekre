import { useEffect, useState } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT, motion, typeScale } from '@/theme/tokens';

const AnimatedText = Animated.createAnimatedComponent(Text);

export interface BigNumberProps {
  /** Angka atau teks angka yang sudah diformat ("4,25"). */
  value: number | string;
  /** Satuan sesudah angka ("°", "%", "jt"). */
  unit?: string;
  /** Awalan ("Rp"). */
  prefix?: string;
  /** `readout` 96/300 (suhu, persen lampu) atau `figure` 44/600 (uang). */
  variant?: 'readout' | 'figure';
  /** Ganti ukuran huruf (contoh 84 untuk lampu, 52 di ubin AC, 36 di Beranda). */
  size?: number;
  color?: string;
  /** `top`: satuan kecil di atas seperti derajat; `baseline`: sejajar bawah seperti "%" dan "jt". */
  unitPosition?: 'top' | 'baseline';
  /** Bacaan pembaca layar; bawaannya awalan + angka + satuan. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Angka besar dengan angka tabular (lebar tetap) dan batas skala huruf 1,1. Saat nilai berganti, angka lama naik 6 dp
 * dan memudar, angka baru masuk dari bawah dalam 160 ms (§4). Dengan "kurangi gerakan" langsung berganti.
 */
export function BigNumber({
  value,
  unit,
  prefix,
  variant = 'readout',
  size,
  color,
  unitPosition,
  accessibilityLabel,
  style,
  testID,
}: BigNumberProps) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const text = String(value);
  // Nilai sebelumnya disimpan di state (pola "sesuaikan state saat prop berubah"), supaya bisa keluar beranimasi.
  const [cur, setCur] = useState(text);
  const [prev, setPrev] = useState<string | null>(null);
  if (text !== cur) {
    setPrev(cur);
    setCur(text);
  }
  const p = useSharedValue(1);
  useEffect(() => {
    if (prev === null || reduce) {
      p.set(1);
      return;
    }
    p.set(0);
    p.set(withTiming(1, { duration: motion.number.duration, easing: Easing.out(Easing.cubic) }));
  }, [cur, prev, reduce, p]);

  const shift = motion.number.shift;
  const inStyle = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: shift * (1 - p.get()) }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.get(),
    transform: [{ translateY: -shift * p.get() }],
  }));

  const base = typeScale[variant];
  const fontSize = size ?? base.fontSize;
  const k = fontSize / base.fontSize;
  const numStyle: TextStyle = {
    ...base,
    fontSize,
    lineHeight: Math.round(base.lineHeight * k),
    letterSpacing: base.letterSpacing * k,
    color: color ?? c.text,
    fontVariant: ['tabular-nums'],
  };
  const pos = unitPosition ?? (unit === '°' ? 'top' : 'baseline');
  // Uang ("Rp 4,25 jt"): satuan sebesar angka. Suhu/persen: satuan kecil.
  const unitSize = variant === 'figure' ? fontSize : Math.round(fontSize * (pos === 'top' ? 0.42 : 0.45));
  const unitStyle: TextStyle = {
    fontFamily: variant === 'readout' ? FONT[300] : FONT[600],
    fontSize: unitSize,
    lineHeight: variant === 'figure' ? numStyle.lineHeight : Math.round(unitSize * 1.15),
    color: color ?? c.text,
    letterSpacing: variant === 'figure' ? -unitSize * 0.02 : 0,
  };
  const label = accessibilityLabel ?? [prefix, text, unit].filter(Boolean).join(prefix ? ' ' : '');

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', alignItems: pos === 'top' ? 'flex-start' : 'flex-end' }, style]}
    >
      {prefix ? (
        <Text maxFontSizeMultiplier={1.1} style={[numStyle, { marginRight: fontSize * 0.18 }]}>
          {prefix}
        </Text>
      ) : null}
      <View>
        <AnimatedText maxFontSizeMultiplier={1.1} style={[numStyle, inStyle]}>
          {cur}
        </AnimatedText>
        {prev !== null ? (
          <AnimatedText
            maxFontSizeMultiplier={1.1}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[numStyle, { position: 'absolute', left: 0, top: 0 }, outStyle]}
          >
            {prev}
          </AnimatedText>
        ) : null}
      </View>
      {unit ? (
        <Text
          maxFontSizeMultiplier={1.1}
          style={[
            unitStyle,
            pos === 'top'
              ? { marginTop: Math.round(fontSize * 0.08), marginLeft: Math.round(fontSize * 0.02) }
              : variant === 'figure'
                ? { marginLeft: Math.round(fontSize * 0.18) }
                : { marginBottom: Math.round(fontSize * 0.1), marginLeft: Math.round(fontSize * 0.04) },
          ]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}
