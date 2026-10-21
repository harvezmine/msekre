import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyError } from '@/api/errors';
import { useSecurity } from '@/api/useSecurity';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { PinPad, type PinVerdict } from '@/ui/device/PinPad';
import { PinReset } from '@/ui/device/PinReset';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';

const MISMATCH = 'PIN belum sama, ulangi ya.';

/** Langkah memasukkan PIN. `current` memeriksa PIN yang ada; `new` dan `repeat` membuat PIN baru. */
type Step = 'current' | 'new' | 'repeat';
interface Flow {
  /** `create`: PIN pertama (lalu permintaan PIN dihidupkan); `change`: ganti PIN; `disable`: matikan permintaan PIN. */
  kind: 'create' | 'change' | 'disable' | 'reset';
  step: Step;
  /** PIN lama yang sudah dibuktikan (ganti PIN) dan PIN baru yang menunggu diulang. */
  current?: string;
  first?: string;
}

const COPY: Record<Step, { title: string; subtitle: string }> = {
  current: { title: 'Masukkan PIN', subtitle: 'PIN yang sekarang dipakai.' },
  new: { title: 'Buat PIN', subtitle: 'Pilih 6 angka yang mudah Anda ingat.' },
  repeat: { title: 'Ulangi PIN', subtitle: 'Masukkan 6 angka yang sama sekali lagi.' },
};

// Keamanan (di bawah Akun): PIN opsional, bawaan mati. Kalau dihidupkan, kamera, alarm rumah, dan kunci pintu minta PIN
// sebelum dimatikan atau dibuka. Pembayaran tidak pernah memakai PIN.
export default function Keamanan() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { dispatch } = useSample();
  const security = useSecurity();
  const [flow, setFlow] = useState<Flow | null>(null);
  const busy = useRef(false);
  const toast = (text: string) => dispatch({ type: 'showToast', text });
  const { state } = security;

  const finish = (text: string) => {
    setFlow(null);
    toast(text);
  };

  /** Satu langkah PIN. Kendala (sinyal, dst) kembali sebagai pesan di bawah titik, bukan toast. */
  const submit = async (f: Flow, pin: string): Promise<PinVerdict> => {
    try {
      if (f.step === 'current') {
        if (!(await security.verify(pin))) return false;
        if (f.kind === 'disable') {
          await security.setEnabled(false, pin);
          finish('Permintaan PIN dimatikan.');
        } else {
          setFlow({ kind: f.kind, step: 'new', current: pin });
        }
        return true;
      }
      if (f.step === 'new') {
        setFlow({ ...f, step: 'repeat', first: pin });
        return true;
      }
      if (pin !== f.first) return MISMATCH;
      if (f.kind === 'change') {
        await security.setPin(pin, f.current);
        finish('PIN diganti.');
      } else {
        // Satu langkah di server: PIN tersimpan dan permintaan PIN hidup, atau tidak ada yang berubah.
        await security.setPin(pin, undefined, true);
        finish('PIN dibuat. Kamera, alarm rumah, dan kunci pintu sekarang minta PIN.');
      }
      return true;
    } catch (e) {
      return friendlyError(e);
    }
  };

  const toggle = async (next: boolean) => {
    if (busy.current || !state) return;
    if (!next) {
      setFlow({ kind: 'disable', step: 'current' });
      return;
    }
    if (!state.hasPin) {
      setFlow({ kind: 'create', step: 'new' });
      return;
    }
    busy.current = true;
    try {
      await security.setEnabled(true);
      toast('Kamera, alarm rumah, dan kunci pintu sekarang minta PIN.');
    } catch (e) {
      toast(friendlyError(e));
    } finally {
      busy.current = false;
    }
  };

  if (flow?.kind === 'reset') {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <BackHeader title="Keamanan" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        >
          <PinReset onCancel={() => setFlow(null)} onDone={() => finish('PIN baru tersimpan.')} />
        </ScrollView>
      </View>
    );
  }
  if (flow) {
    const { title, subtitle } = COPY[flow.step];
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <BackHeader title="Keamanan" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        >
          <PinPad
            // Tiap langkah memulai dari titik kosong.
            key={`${flow.kind}-${flow.step}`}
            title={flow.kind === 'disable' ? 'Matikan PIN' : title}
            subtitle={flow.kind === 'disable' ? 'Masukkan PIN untuk mematikan permintaan PIN.' : subtitle}
            onSubmit={(pin) => submit(flow, pin)}
            onCancel={() => setFlow(null)}
            onForgot={flow.step === 'current' ? () => setFlow({ kind: 'reset', step: 'current' }) : undefined}
          />
        </ScrollView>
      </View>
    );
  }

  const label = 'Minta PIN untuk kamera, alarm rumah, dan kunci pintu';
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="Keamanan" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}>
        <ListGroup>
          <ListRow
            icon="lock"
            title={label}
            subtitle={state ? (state.pinEnabled ? 'Aktif' : 'Mati') : undefined}
            last={!state?.hasPin}
            trailing={
              state ? (
                <Toggle value={state.pinEnabled} onChange={(next) => void toggle(next)} label={label} />
              ) : (
                <View />
              )
            }
          />
          {state?.hasPin ? (
            <ListRow icon="lock" title="Ganti PIN" last onPress={() => setFlow({ kind: 'change', step: 'current' })} />
          ) : null}
        </ListGroup>
        {security.failed && !state ? (
          <Txt v="caption" color={c.clay} accessibilityLiveRegion="polite">
            Pengaturan keamanan belum bisa dimuat. Coba lagi sebentar ya.
          </Txt>
        ) : null}
        <Txt v="caption" color={c.muted} style={{ paddingHorizontal: 4 }}>
          Secara bawaan PIN mati, jadi perangkat langsung dijalankan. Kalau dihidupkan, PIN diminta sebelum kamera atau
          alarm rumah dimatikan dan sebelum pintu dibuka. Pembayaran tidak pernah memakai PIN.
        </Txt>
      </ScrollView>
    </View>
  );
}
