import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '@/theme/tokens';

/**
 * Deretan geser horizontal: mulai di tepi halaman (20), jarak 12, berhenti per butir bila `itemWidth` diberikan.
 * Butir terakhir yang terlihat terpotong di tepi kanan, jadi jelas bahwa deretan bisa digeser.
 */
export function HScroller({
  children,
  itemWidth,
  gap = space.tileGap,
  inset = space.gutter,
  style,
  contentContainerStyle,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  /** Lebar satu butir; dipakai untuk berhenti tepat per butir. */
  itemWidth?: number;
  gap?: number;
  /** Jarak tepi kiri dan kanan isi. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <ScrollView
      horizontal
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={itemWidth ? itemWidth + gap : undefined}
      snapToAlignment="start"
      disableIntervalMomentum={!!itemWidth}
      style={style}
      contentContainerStyle={[{ paddingHorizontal: inset, gap, alignItems: 'stretch' }, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}
