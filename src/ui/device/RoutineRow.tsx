import { Pressable, View } from 'react-native';
import type { Routine } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { iconOr } from '../icons';
import { Txt } from '../Txt';

/** Satu rutinitas (desain 2c): ikon, nama, isi singkat, tombol Jalankan. Taruh di dalam `ListGroup`. */
export function RoutineRow({ routine, last, onRun }: { routine: Routine; last: boolean; onRun: () => void }) {
  const { c, shadow, marker } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.sunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={iconOr(routine.icon, 'bell')} size={22} color={marker.rumah.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={600}>{routine.name}</Txt>
        <Txt v="caption" color={c.muted}>
          {routine.summary}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Jalankan ${routine.name}`}
        onPress={onRun}
        android_ripple={{ color: c.ripple }}
        style={{
          height: 48,
          paddingHorizontal: 16,
          borderRadius: 24,
          boxShadow: shadow.e1,
          backgroundColor: c.surface,
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={c.brandInk} style={{ fontSize: 15 }}>
          Jalankan
        </Txt>
      </Pressable>
    </View>
  );
}
