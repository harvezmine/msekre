import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { SPARK_H, SPARK_W, sparkPoints } from './sparkMath';

/** Garis penjualan 7 hari; titik terakhir (hari ini) ditandai. */
export function Sparkline({ series, min, span }: { series: number[]; min?: number; span?: number }) {
  const { c } = useTheme();
  const pts = sparkPoints(series, min, span);
  const last = pts[pts.length - 1]!;
  return (
    <Svg
      testID="sparkline"
      accessibilityLabel="Grafik penjualan 7 hari terakhir"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      width="100%"
      style={{ aspectRatio: SPARK_W / SPARK_H }}
    >
      <Polyline
        testID="spark-garis"
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={c.green}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        testID="spark-titik-hari-ini"
        cx={last.x}
        cy={last.y}
        r={4.5}
        fill={c.green}
        stroke={c.card}
        strokeWidth={2}
      />
    </Svg>
  );
}
