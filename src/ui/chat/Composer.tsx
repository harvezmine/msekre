import { useEffect, useState, type Ref } from 'react';
import { Keyboard, Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { useToast } from '@/ui/toastStore';
import { useOpenVoice } from '@/voice/available';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  inputRef?: Ref<TextInputInstance>;
  /** Layar kosong (desain 1d): mic hijau penuh. Di utas, mic berlatar mint dengan ikon hijau (1b, 1c). */
  strongMic?: boolean;
  /** Kalau diisi, kolom ketik dimatikan dan teks ini menjadi petunjuknya (akun tidak aktif, aplikasi perlu diperbarui). */
  disabledText?: string;
  /** Ketukan Lampiran. Bawaannya toast "segera hadir". */
  onAttach?: () => void;
}

/** Bilah ketik di bawah: lampiran, kolom teks, lalu mic (kosong) atau kirim (ada teks). */
export function Composer({ value, onChangeText, onSend, inputRef, strongMic = false, disabledText, onAttach }: Props) {
  const assistantName = useAssistantName();
  const { c } = useTheme();
  const toast = useToast();
  const openSuara = useOpenVoice();
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
  const off = disabledText !== undefined;
  const hasText = !off && value.trim().length > 0;
  const solid = !off && (hasText || strongMic);
  return (
    <View
      style={{
        height: 88 + (keyboard ? 0 : insets.bottom),
        paddingBottom: 8 + (keyboard ? 0 : insets.bottom),
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: c.paper,
      }}
    >
      <IconButton
        icon="clip"
        label="Lampiran"
        color={c.muted}
        onPress={onAttach ?? (() => toast('Lampiran segera hadir.'))}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        editable={!off}
        onSubmitEditing={off ? undefined : onSend}
        returnKeyType="send"
        submitBehavior="submit"
        accessibilityLabel={`Tulis pesan untuk ${assistantName}`}
        placeholder={disabledText ?? `Tulis pesan untuk ${assistantName}`}
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
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={hasText ? onSend : () => openSuara('replace')}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: solid ? c.green : c.mint,
          opacity: off ? 0.5 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={hasText ? 'send' : 'mic'} size={24} color={solid ? c.onGreen : c.green} />
      </Pressable>
    </View>
  );
}
