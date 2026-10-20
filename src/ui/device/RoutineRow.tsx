import { Pressable, View } from 'react-native';
import type { Routine } from '@/sample/routines';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Satu rutinitas (desain 2c): ikon, nama, isi singkat, tombol Jalankan. Taruh di dalam `ListGroup`. */
export function RoutineRow({ routine, last, onRun }: { routine: Routine; last: boolean; onRun: () => void }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: c.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={routine.icon} size={22} color={c.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={600}>{routine.name}</Txt>
        <Txt v="caption" color={c.muted}>
          {routine.sub}
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
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.card,
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
          Jalankan
        </Txt>
      </Pressable>
    </View>
  );
}
