import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDevices } from '@/api/useDevices';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

// Lembar konfirmasi membuka kunci pintu saat PIN mati (bukan PIN): "Buka kunci {nama}?". Dibuka dari Perangkat dengan
// ?id=<kunci>. Kalau PIN dihidupkan, lembar PIN (/pin) yang dipakai.
export default function BukaKunci() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const { c } = useTheme();
  const toast = useToast();
  const { close } = useSheet();
  const { home } = useHome();
  const { find, controlDevice } = useDevices(home?.place);
  const [working, setWorking] = useState(false);
  const device = find(id);
  if (!device) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Perangkat ini tidak ditemukan.</Txt>;
  }
  const open = async () => {
    if (working) return;
    setWorking(true);
    const result = await controlDevice(device.id, { on: false }, { confirmed: true });
    setWorking(false);
    if (result.ok) return close();
    if (result.reason === 'pin') return close(() => router.push({ pathname: '/pin', params: { id: device.id } }));
    if (result.reason === 'confirm') return close();
    close(() => toast(result.message));
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt v="title">{`Buka kunci ${device.name}?`}</Txt>
      <Txt color={c.muted}>Kuncinya langsung terbuka. Anda bisa menguncinya lagi kapan saja dari Perangkat.</Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka"
          accessibilityState={{ disabled: working }}
          disabled={working}
          onPress={() => void open()}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: working ? 0.6 : 1,
          }}
        >
          <Txt weight={600} color={c.onBrand} style={{ fontSize: 17 }}>
            Buka
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Batal"
          onPress={() => close()}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.brandInk}>
            Batal
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
