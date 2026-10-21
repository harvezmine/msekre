import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { byLayout, useLayoutClass } from '../kit/layout';
import { RemoteKey } from '../kit/RemoteKey';
import { Txt } from '../Txt';

/** Ukuran kontrol remote per kelas tata letak (§7: − / daya / + = 76 / 100 / 76; layar pendek sedikit lebih kecil). */
export function useRemoteSizes() {
  const cls = useLayoutClass();
  return {
    cls,
    power: byLayout(cls, { compact: 88, regular: 100, tall: 100 }),
    side: byLayout(cls, { compact: 64, regular: 76, tall: 76 }),
    key: byLayout(cls, { compact: 60, regular: 64, tall: 64 }),
    /** Jarak isi atas dari kepala. */
    lead: byLayout(cls, { compact: 4, regular: 12, tall: 20 }),
  };
}

/** Tombol daya bulat (hijau saat menyala), dibacakan sebagai sakelar "Daya". */
export function PowerKey({ size, on, onPress }: { size: number; on: boolean; onPress: () => void }) {
  return (
    <RemoteKey testID="tombol-daya" label="Daya" icon="power" variant="power" on={on} size={size} onPress={onPress} />
  );
}

/**
 * Tiga batang kecepatan kipas (§papan 10): `level` batang pertama bertinta, sisanya pudar. Hiasan; nama kecepatan
 * dibacakan oleh tombolnya.
 */
export function FanBars({ level, total = 3, active }: { level: number; total?: number; active: boolean }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 7 + Math.round((11 * i) / Math.max(1, total - 1)),
            borderRadius: 2.5,
            backgroundColor: i < level ? (active ? c.text : c.muted) : c.sunken2,
          }}
        />
      ))}
    </View>
  );
}

/** Satu bacaan kecil dengan ikon (baterai, suhu ruangan). */
export function SmallReading({
  icon,
  text,
  label,
}: {
  icon: 'battery' | 'thermo' | 'drop';
  text: string;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${text}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}
    >
      <Icon name={icon} size={20} color={c.muted} />
      <Txt v="label" tabular color={c.muted}>
        {text}
      </Txt>
    </View>
  );
}
