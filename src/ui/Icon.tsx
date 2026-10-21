import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { DOT_ICONS, FILLED_ICONS, ICON_PATHS, type IconName } from './icons';

/** Ikon garis seperti di desain: ketebalan 1,75 (ikon titik 3), ujung membulat. Ikon pemutar diisi padat. */
export function Icon({
  name,
  size = 24,
  color,
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { c } = useTheme();
  return (
    <Svg
      testID={`ikon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={FILLED_ICONS.has(name) ? (color ?? c.text) : 'none'}
      stroke={color ?? c.text}
      strokeWidth={strokeWidth ?? (DOT_ICONS.has(name) ? 3 : 1.75)}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}
