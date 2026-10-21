import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar konfirmasi dari detail layanan: hapus yang Nadia pelajari (aksi=lupa) atau putuskan (aksi=putus).
export default function Konfirmasi() {
  const { id, aksi } = useLocalSearchParams<{ id?: string; aksi?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} putus={aksi === 'putus'} />
    </Sheet>
  );
}

function Isi({ id, putus }: { id: string; putus: boolean }) {
  const { c } = useTheme();
  const assistant = useAssistantName();
  const dispatch = useSampleDispatch();
  const { service, forget, disconnect, busy } = useConnections(id);
  const { close } = useSheet();
  if (!service) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>;
  }
  const toast = (text: string) => dispatch({ type: 'showToast', text });
  const run = async () => {
    if (putus) {
      const res = await disconnect(id);
      close(() => {
        if (!res.ok) return toast(res.message);
        toast(`${service.name} diputuskan.`);
        // Tumpukan bisa berisi Tersambung/detail layanan yang kini tak tersambung; mulai dari Beranda supaya "kembali" tak mendarat di sana.
        router.dismissTo('/');
        router.push('/terhubung');
      });
    } else {
      const res = await forget(id);
      close(() =>
        toast(
          res.ok
            ? `Yang ${assistant} pelajari dari ${service.name} sudah dihapus.`
            : res.message || 'Belum bisa menghapus. Coba lagi sebentar ya.',
        ),
      );
    }
  };
  const working = putus ? busy.disconnect : busy.forget;
  return (
    <View style={{ gap: 8 }}>
      <Txt v="title">
        {putus ? `Putuskan ${service.name}?` : `Hapus yang ${assistant} pelajari dari ${service.name}?`}
      </Txt>
      <Txt color={c.muted}>
        {putus
          ? `${assistant} tidak lagi membaca atau bertindak di layanan ini. Anda bisa menyambungkannya lagi kapan saja.`
          : `Sambungannya tetap ada. Semua yang ${assistant} ingat dari layanan ini dihapus.`}
      </Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={putus ? 'Ya, putuskan' : 'Ya, hapus'}
          accessibilityState={{ disabled: working }}
          disabled={working}
          onPress={() => void run()}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: c.clay,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: working ? 0.6 : 1,
          }}
        >
          <Txt weight={600} color={c.onGreen} style={{ fontSize: 17 }}>
            {putus ? 'Ya, putuskan' : 'Ya, hapus'}
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={() => close()}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.green}>
            Batal
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
