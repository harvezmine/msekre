import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { ICON_PATHS, type IconName } from './icons';

/** Ikon garis seperti di desain: ketebalan 1,75, ujung membulat. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Svg
      testID={`ikon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? c.ink}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}
