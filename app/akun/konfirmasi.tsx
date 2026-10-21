import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAccount } from '@/api/useAccount';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar konfirmasi dari pengaturan Akun: keluarkan HP lain (aksi=hp).
export default function Konfirmasi() {
  const { id } = useLocalSearchParams<{ id?: string; aksi?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const { c } = useTheme();
  const dispatch = useSampleDispatch();
  const { account, removePhone, busy } = useAccount();
  const { close } = useSheet();
  const phone = account?.phones.find((p) => p.id === id);
  if (!phone || phone.current) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>HP ini tidak ditemukan.</Txt>;
  }
  const run = async () => {
    const res = await removePhone(id);
    close(() => {
      if (res.ok) dispatch({ type: 'showToast', text: `${phone.name} dikeluarkan.` });
      else if (res.message) dispatch({ type: 'showToast', text: res.message });
    });
  };
  const working = busy.phone(id);
  return (
    <View style={{ gap: 8 }}>
      <Txt v="title">{`Keluarkan ${phone.name}?`}</Txt>
      <Txt color={c.muted}>
        HP itu langsung keluar dari akun ini dan tidak lagi menerima notifikasi. Anda bisa masuk lagi dari HP itu kapan
        saja.
      </Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ya, keluarkan"
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
            Ya, keluarkan
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
