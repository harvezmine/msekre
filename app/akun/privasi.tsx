import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { ERASE_TEXT, openWhatsApp, PRIVACY_URL, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { useAccount } from '@/api/useAccount';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

// Privasi (di bawah Akun): apa yang diingat asisten dari tiap layanan, dengan jalan menghapusnya. Hapus akun tetap lewat
// WhatsApp.
export default function Privasi() {
  const { c } = useTheme();
  const assistant = useAssistantName();
  const { account, status, error, retry } = useAccount();
  const toast = useToast();
  const erase = async () => {
    if (!(await openWhatsApp(ERASE_TEXT))) toast(WA_UNAVAILABLE_TEXT);
  };
  const policy = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      toast('Halaman kebijakan privasi belum bisa dibuka. Coba lagi sebentar ya.');
    }
  };
  const services = account?.privacy.services ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="Privasi" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}>
        <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
          {`Yang ${assistant} tahu, per layanan`}
        </Txt>
        {account ? (
          services.length ? (
            <ListGroup>
              {services.map((s, i) => (
                <ListRow
                  key={s.id}
                  icon="shield"
                  title={s.name}
                  subtitle={s.memoryCount > 0 ? `${s.memoryCount} hal diingat` : 'Tidak ada yang diingat'}
                  last={i === services.length - 1}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus yang ${assistant} tahu dari ${s.name}`}
                      accessibilityState={{ disabled: s.memoryCount === 0 }}
                      disabled={s.memoryCount === 0}
                      onPress={() => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(s.id)}&aksi=lupa`)}
                      android_ripple={{ color: c.ripple }}
                      style={{
                        minHeight: 48,
                        maxWidth: 140,
                        paddingHorizontal: 8,
                        justifyContent: 'center',
                        opacity: s.memoryCount === 0 ? 0.4 : 1,
                      }}
                    >
                      <Txt weight={600} color={c.clay} style={{ fontSize: 14, lineHeight: 18, textAlign: 'right' }}>
                        {`Hapus yang ${assistant} tahu`}
                      </Txt>
                    </Pressable>
                  }
                />
              ))}
            </ListGroup>
          ) : (
            <Txt color={c.muted} style={{ paddingHorizontal: 4 }}>
              {`Belum ada yang ${assistant} ingat dari layanan yang tersambung.`}
            </Txt>
          )
        ) : (
          <View style={{ gap: 8 }}>
            <Txt color={c.muted}>{status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}</Txt>
            {status === 'error' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void retry()}>
                <Txt weight={600} color={c.green}>
                  Coba lagi
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}

        <View
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 24,
            padding: 16,
            gap: 8,
            marginTop: 8,
          }}
        >
          <Txt weight={600}>Hapus akun</Txt>
          <Txt color={c.muted}>{`Untuk menghapus akun, kirim pesan ke ${assistant} di WhatsApp.`}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka WhatsApp"
            onPress={() => void erase()}
            android_ripple={{ color: c.ripple }}
            style={{ height: 48, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green}>
              Buka WhatsApp
            </Txt>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Baca kebijakan privasi"
          onPress={() => void policy()}
          android_ripple={{ color: c.ripple }}
          style={{ height: 48, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Txt weight={600} color={c.green}>
            Baca kebijakan privasi
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}
