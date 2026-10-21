import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bagian bawah layar yang mudah dijangkau jempol: 40% tinggi layar (§6). */
export const THUMB_ZONE = 0.4;

/**
 * Tata letak zona jempol (§6): bagian atas (kepala dan isi bacaan), lalu spacer lentur, lalu aksi utama yang menempel di
 * bawah, diukur dari batas aman bawah (garis gestur), bukan dari atas. Di HP panjang, tinggi lebihnya masuk ke spacer
 * sehingga aksi tetap di 40% bawah. Tanpa jarak tetap dari atas.
 */
export function ThumbZone({
  top,
  children,
  gap = 16,
  bottomPadding = 16,
  insetBottom = true,
  style,
  testID,
}: {
  /** Kepala dan isi bacaan. */
  top?: ReactNode;
  /** Aksi utama (menempel di bawah). */
  children: ReactNode;
  /** Jarak minimum antara isi atas dan aksi. */
  gap?: number;
  /** Jarak aksi dari batas aman bawah. */
  bottomPadding?: number;
  /** Tambahkan tinggi garis gestur di bawah; matikan bila tab bar sudah menanganinya. */
  insetBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[{ flex: 1 }, style]}>
      {top ? <View style={{ flexShrink: 1 }}>{top}</View> : null}
      <View testID={testID ? `${testID}-spacer` : undefined} style={{ flexGrow: 1, minHeight: gap }} />
      <View style={{ paddingBottom: (insetBottom ? insets.bottom : 0) + bottomPadding }}>{children}</View>
    </View>
  );
}
