import { router, useLocalSearchParams } from 'expo-router';
import { friendlyError } from '@/api/errors';
import { useSecurity } from '@/api/useSecurity';
import { deviceById, useSample } from '@/sample/store';
import { PinPad } from '@/ui/device/PinPad';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar PIN untuk mematikan perangkat yang dijaga (kamera, kunci). Dibuka dari Perangkat dengan ?id=<perangkat>, hanya
// bila PIN diaktifkan (Akun > Keamanan); PIN diperiksa server (POST /account/pin/verify).
export default function Pin() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const { state, dispatch } = useSample();
  const { close } = useSheet();
  const security = useSecurity({ load: false });
  const device = deviceById(state, id);
  if (!device) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Perangkat ini tidak ditemukan.</Txt>;
  }
  const subtitle = device.kind === 'kunci' ? `Untuk membuka ${device.name}.` : `Untuk mematikan ${device.name}.`;
  return (
    <PinPad
      subtitle={subtitle}
      onCancel={() => close()}
      onForgot={() => dispatch({ type: 'showToast', text: 'Atur ulang PIN segera hadir.' })}
      onSubmit={async (pin) => {
        try {
          if (!(await security.verify(pin))) return false;
        } catch (e) {
          return friendlyError(e);
        }
        dispatch({ type: 'toggleDevice', id: device.id, on: false });
        close();
        return true;
      }}
    />
  );
}
