import { router, useLocalSearchParams } from 'expo-router';
import { useDevices } from '@/api/useDevices';
import { useHome } from '@/api/useHome';
import { useSampleDispatch } from '@/sample/store';
import { PinPad } from '@/ui/device/PinPad';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar PIN untuk mematikan perangkat yang dijaga (kamera, kunci). Dibuka dari Perangkat dengan ?id=<perangkat>, hanya
// bila PIN diaktifkan (Akun > Keamanan). PIN dikirim bersama perintahnya (POST /home/devices/:id) dan diperiksa server;
// salah: pesan di lembar ini, benar: perangkat dimatikan dan lembar menutup.
export default function Pin() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const dispatch = useSampleDispatch();
  const { close } = useSheet();
  const { home } = useHome();
  const { find, controlDevice } = useDevices(home?.place);
  const device = find(id);
  if (!device) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Perangkat ini tidak ditemukan.</Txt>;
  }
  const subtitle = device.kind === 'lock' ? `Untuk membuka ${device.name}.` : `Untuk mematikan ${device.name}.`;
  return (
    <PinPad
      subtitle={subtitle}
      onCancel={() => close()}
      onForgot={() => dispatch({ type: 'showToast', text: 'Atur ulang PIN segera hadir.' })}
      onSubmit={async (pin) => {
        const result = await controlDevice(device.id, { on: false, pin });
        if (result.ok) {
          close();
          return true;
        }
        // PIN salah: pesan bawaan lembar; kendala lain: teks ramahnya.
        return result.reason === 'error' ? result.message : false;
      }}
    />
  );
}
