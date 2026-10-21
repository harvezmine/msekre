import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

interface UserBubbleProps {
  text: string;
  /** Awal tukar-pesan baru: jarak atas ekstra 8. */
  startsExchange?: boolean;
  /** Pesan optimistis: `sending` ("mengirim…") atau `failed` ("Belum terkirim · Coba lagi"). Tersimpan: kosong. */
  status?: 'sending' | 'failed';
  onRetry?: () => void;
}

/** Gelembung pengguna: netral (`sunken`), rata kanan, sudut kanan bawah lancip. Hijau hanya untuk aksi utama. */
export function UserBubble({ text, startsExchange = false, status, onRetry }: UserBubbleProps) {
  const { c, marker } = useTheme();
  const bubble = (
    <View
      style={{
        alignSelf: 'flex-end',
        maxWidth: '78%',
        marginTop: startsExchange ? 8 : 0,
        backgroundColor: c.sunken,
        opacity: status === 'sending' ? 0.7 : 1,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Txt color={c.text}>{text}</Txt>
    </View>
  );
  if (!status) return bubble;
  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'flex-end', gap: 2 }}>
      {bubble}
      {status === 'sending' ? (
        <Txt v="caption" color={c.muted} style={{ paddingHorizontal: 4 }}>
          mengirim…
        </Txt>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Coba kirim lagi pesan ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`}
          onPress={onRetry}
          hitSlop={{ top: 8, bottom: 8, left: 8 }}
          style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Txt v="caption" weight={600} color={marker.warn.ink}>
            Belum terkirim · Coba lagi
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Jawaban asisten: gelembung permukaan (`surface`) rata kiri, sudut kiri atas lancip; tenang tanpa bayangan. */
export function AssistantLine({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '86%',
        backgroundColor: c.surface,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Txt>{text}</Txt>
    </View>
  );
}

/** Tanda kecil di bawah pesan yang ditulis atau dijawab lewat WhatsApp. */
export function ViaTag({ align }: { align: 'left' | 'right' }) {
  const { c } = useTheme();
  return (
    <Txt
      v="caption"
      color={c.muted}
      style={{ alignSelf: align === 'right' ? 'flex-end' : 'flex-start', paddingHorizontal: 4 }}
    >
      lewat WhatsApp
    </Txt>
  );
}
