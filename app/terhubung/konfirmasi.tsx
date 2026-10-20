import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar konfirmasi dari detail layanan: hapus yang Nadia tahu (aksi=lupa) atau putuskan (aksi=putus).
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
  const { state, dispatch } = useSample();
  const { close } = useSheet();
  const service = state.services.find((s) => s.id === id);
  if (!service) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>;
  }
  const run = () =>
    close(() => {
      if (putus) {
        dispatch({ type: 'disconnect', id });
        dispatch({ type: 'showToast', text: `${service.name} diputuskan.` });
        // Tumpukan bisa berisi Tersambung/detail layanan yang kini tak ada; mulai dari Beranda supaya "kembali" tak mendarat di "tidak ditemukan".
        router.dismissTo('/');
        router.push('/terhubung');
      } else {
        dispatch({ type: 'forget', id });
        dispatch({ type: 'showToast', text: `Yang Nadia tahu dari ${service.name} sudah dihapus.` });
      }
    });
  return (
    <View style={{ gap: 8 }}>
      <Txt v="title">{putus ? `Putuskan ${service.name}?` : `Hapus yang Nadia tahu dari ${service.name}?`}</Txt>
      <Txt color={c.muted}>
        {putus
          ? 'Nadia tidak lagi membaca atau bertindak di layanan ini. Anda bisa menyambungkannya lagi kapan saja.'
          : 'Semua yang Nadia ingat dari layanan ini dihapus. Layanannya tetap tersambung.'}
      </Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={putus ? 'Ya, putuskan' : 'Ya, hapus'}
          onPress={run}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: c.clay,
            alignItems: 'center',
            justifyContent: 'center',
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
