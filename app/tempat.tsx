import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { PLACES, useSample, type Place } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar pemilih tempat. Dibuka dengan presentation transparentModal dari Stack.
export default function Tempat() {
  return (
    <Sheet onClose={() => router.back()}>
      <Pilihan />
    </Sheet>
  );
}

function Pilihan() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const { close } = useSheet();
  const pick = (place: Place) => close(() => dispatch({ type: 'setPlace', place }));
  return (
    <>
      <Txt v="title" style={{ marginBottom: 8 }}>
        Pilih tempat
      </Txt>
      <View accessibilityRole="radiogroup">
        {PLACES.map((p, i) => {
          const selected = p === state.place;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityLabel={p}
              accessibilityState={{ checked: selected }}
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
    </>
  );
}
