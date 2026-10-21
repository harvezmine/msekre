import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useDevices } from '@/api/useDevices';
import { useHome } from '@/api/useHome';
import { ConfirmBody } from '@/ui/kit';
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
    <ConfirmBody
      tone="brand"
      icon="unlock"
      title={`Buka kunci ${device.name}?`}
      message="Kuncinya langsung terbuka. Anda bisa menguncinya lagi kapan saja dari Perangkat."
      confirm="Buka"
      busy={working}
      onConfirm={() => void open()}
      onCancel={() => close()}
    />
  );
}
