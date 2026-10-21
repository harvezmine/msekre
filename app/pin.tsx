import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useDevices } from '@/api/useDevices';
import { useHome } from '@/api/useHome';
import { PinPad } from '@/ui/device/PinPad';
import { PIN_CHANGED_TEXT, PinReset } from '@/ui/device/PinReset';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

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
  const toast = useToast();
  const { close } = useSheet();
  const { home } = useHome();
  const { find, controlDevice } = useDevices(home?.place);
  const [resetting, setResetting] = useState(false);
  const device = find(id);
  if (!device) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Perangkat ini tidak ditemukan.</Txt>;
  }
  if (resetting) {
    return (
      <PinReset
        onCancel={() => setResetting(false)}
        onDone={() => {
          setResetting(false);
          toast(PIN_CHANGED_TEXT);
        }}
      />
    );
  }
  const subtitle = device.kind === 'lock' ? `Untuk membuka ${device.name}.` : `Untuk mematikan ${device.name}.`;
  return (
    <PinPad
      subtitle={subtitle}
      onCancel={() => close()}
      onForgot={() => setResetting(true)}
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
