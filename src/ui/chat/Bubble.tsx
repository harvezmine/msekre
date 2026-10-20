import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** Gelembung pengguna: hijau, rata kanan, sudut kanan bawah lancip. */
export function UserBubble({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-end',
        maxWidth: '78%',
        backgroundColor: c.green,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Txt color={c.onGreen}>{text}</Txt>
    </View>
  );
}

/** Jawaban asisten: teks polos tanpa gelembung. */
export function AssistantLine({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '86%', paddingHorizontal: 4 }}>
      <Txt>{text}</Txt>
    </View>
  );
}
