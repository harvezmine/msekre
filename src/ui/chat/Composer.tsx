import { router } from 'expo-router';
import { useEffect, useState, type Ref } from 'react';
import { Keyboard, Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  inputRef?: Ref<TextInputInstance>;
}

/** Bilah ketik di bawah: lampiran, kolom teks, lalu mic (kosong) atau kirim (ada teks). */
export function Composer({ value, onChangeText, onSend, inputRef }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Saat keyboard terbuka, area gestur di bawah tertutup keyboard: tak perlu jarak tambahan.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const hasText = value.trim().length > 0;
  return (
    <View
      style={{
        minHeight: 80 + (keyboard ? 0 : insets.bottom),
        paddingTop: 12,
        paddingBottom: 8 + (keyboard ? 0 : insets.bottom),
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: c.paper,
      }}
    >
      <IconButton icon="clip" label="Lampiran" color={c.muted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSend}
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        accessibilityLabel={`Tulis pesan untuk ${DEFAULT_ASSISTANT}`}
        placeholder={`Tulis pesan untuk ${DEFAULT_ASSISTANT}`}
        placeholderTextColor={c.muted}
        cursorColor={c.green}
        selectionColor={c.green}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.card,
          paddingHorizontal: 20,
          fontFamily: FONT[400],
          fontSize: 16,
          color: c.ink,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasText ? 'Kirim pesan' : 'Bicara'}
        onPress={hasText ? onSend : () => router.replace('/suara')}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={hasText ? 'send' : 'mic'} size={24} color={c.onGreen} />
      </Pressable>
    </View>
  );
}
