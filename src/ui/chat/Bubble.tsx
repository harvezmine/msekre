import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

/** Gelembung pengguna: hijau, rata kanan, sudut kanan bawah lancip. `startsExchange`: awal tukar-pesan baru, jarak atas ekstra 8. */
export function UserBubble({ text, startsExchange = false }: { text: string; startsExchange?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-end',
        maxWidth: '78%',
        marginTop: startsExchange ? 8 : 0,
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
