import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Penanda 3 langkah layar pertama kali. `step` mulai dari 1. */
export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Langkah ${step} dari 3`}
      style={{ flexDirection: 'row', gap: 6, alignSelf: 'center' }}
    >
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          testID={n <= step ? 'titik-aktif' : 'titik'}
          style={{
            width: 24,
            height: 4,
            borderRadius: 2,
            backgroundColor: n <= step ? c.brand : c.sunken2,
          }}
        />
      ))}
    </View>
  );
}
