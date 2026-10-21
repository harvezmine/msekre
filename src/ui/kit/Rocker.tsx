import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';
import { PressableScale } from './PressableScale';

/**
 * Tombol jungkit tegak (§5, dilonggarkan untuk kenyamanan): kapsul 80×232 radius 40 dengan dua tombol 64 dp dan label
 * tengah (VOL / CH). Tiap tombol terbaca sendiri oleh pembaca layar, contoh "Volume naik".
 */
export function Rocker({
  label,
  name,
  onUp,
  onDown,
  upIcon = 'plus',
  downIcon = 'minus',
  upLabel,
  downLabel,
  height = 232,
  style,
}: {
  /** Tulisan tengah, contoh "VOL". */
  label: string;
  /** Nama untuk pembaca layar, contoh "Volume". */
  name: string;
  onUp: () => void;
  onDown: () => void;
  upIcon?: IconName;
  downIcon?: IconName;
  upLabel?: string;
  downLabel?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, shadow, scheme } = useTheme();
  const key = (icon: IconName, a11y: string, onPress: () => void) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      scaleTo={motion.press.keyScale}
      haptic="light"
      hapticOnPressIn
      style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={26} color={c.text} strokeWidth={2} />
    </PressableScale>
  );
  return (
    <View
      style={[
        {
          width: 80,
          height,
          borderRadius: 40,
          backgroundColor: scheme === 'dark' ? c.raised : c.surface,
          boxShadow: shadow.key,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
        },
        style,
      ]}
    >
      {key(upIcon, upLabel ?? `${name} naik`, onUp)}
      <Txt
        v="caption"
        weight={700}
        color={c.muted}
        maxFontSizeMultiplier={1.2}
        style={{ fontSize: 13, letterSpacing: 0.8 }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Txt>
      {key(downIcon, downLabel ?? `${name} turun`, onDown)}
    </View>
  );
}
