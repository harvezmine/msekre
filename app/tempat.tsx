import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { PLACES, useSample, type Place } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar pemilih tempat. Dibuka dengan presentation transparentModal dari Stack.
export default function Tempat() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const pick = (place: Place) => {
    dispatch({ type: 'setPlace', place });
    router.back();
  };
  return (
    <Sheet onClose={() => router.back()}>
      <Txt v="title" style={{ marginBottom: 8 }}>
        Pilih tempat
      </Txt>
      <View>
        {PLACES.map((p, i) => {
          const selected = p === state.place;
          return (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={p}
              accessibilityState={{ selected }}
              onPress={() => pick(p)}
              android_ripple={{ color: c.ripple }}
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: i < PLACES.length - 1 ? 1 : 0,
                borderBottomColor: c.line,
              }}
            >
              <Txt weight={selected ? 600 : 500}>{p}</Txt>
              {selected ? <Icon name="check" size={24} color={c.green} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
