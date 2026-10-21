import { Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Sheet, useSheet } from '../Sheet';
import { Txt } from '../Txt';
import { haptic } from './haptics';

export interface Choice {
  id: string;
  label: string;
}

/**
 * Lembar pilihan satu dari beberapa (sumber input, timer): judul satu kata, baris 64 tinggi dengan centang hijau pada
 * yang terpilih. Memilih menutup lembar lalu menjalankan `onPick`.
 */
export function ChoiceSheet({
  visible,
  title,
  choices,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  choices: readonly Choice[];
  value?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {visible ? (
          <Sheet onClose={onClose} testID="lembar-pilihan">
            <Rows title={title} choices={choices} value={value} onPick={onPick} />
          </Sheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Rows({
  title,
  choices,
  value,
  onPick,
}: {
  title: string;
  choices: readonly Choice[];
  value?: string;
  onPick: (id: string) => void;
}) {
  const { c } = useTheme();
  const { close } = useSheet();
  return (
    <>
      <Txt v="section" accessibilityRole="header" style={{ marginBottom: 8 }}>
        {title}
      </Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        {choices.map((o) => {
          const selected = o.id === value;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                haptic('selection');
                close(() => onPick(o.id));
              }}
              android_ripple={{ color: c.ripple }}
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Txt v="row" weight={selected ? 600 : 500} color={selected ? c.brandInk : c.text}>
                {o.label}
              </Txt>
              {selected ? <Icon name="check" size={24} color={c.brandInk} /> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
