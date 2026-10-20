import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Sakelar 52×32 seperti di desain. hitSlop membuat area sentuhnya 48dp. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, padding: 4, backgroundColor: value ? c.green : c.track }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX: value ? 20 : 0 }],
        }}
      />
    </Pressable>
  );
}
