// Keamanan: PIN untuk perangkat penting, HP yang memakai akun ini, dan apa yang diingat asisten.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ERASE_TEXT, openWhatsApp, PRIVACY_URL, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { friendlyError } from '@/api/errors';
import { useAccount } from '@/api/useAccount';
import { useAssistantName } from '@/api/useProfile';
import { useSecurity } from '@/api/useSecurity';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { SampleBanner } from '@/ui/SampleBanner';
import { PinPad, type PinVerdict } from '@/ui/device/PinPad';
import { PIN_CHANGED_TEXT, PinReset } from '@/ui/device/PinReset';
import { ListRow, SectionHeader, ServiceLogo } from '@/ui/kit';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const ICON = 46;
/** Nama sakelar PIN untuk pembaca layar: apa yang dijaga PIN. */
const PIN_LABEL = 'Minta PIN untuk kamera, alarm rumah, dan kunci pintu';

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

// PIN opsional, bawaan mati. Kalau dihidupkan, kamera, alarm rumah, dan kunci pintu minta PIN sebelum dimatikan atau
// dibuka. Pembayaran tidak pernah memakai PIN. HP lain bisa dikeluarkan (HP ini lewat Keluar); hapus akun lewat WhatsApp.
export default function Keamanan() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const security = useSecurity();
  const assistant = useAssistantName();
  const { account, status, error, retry, busy } = useAccount();
  const [flow, setFlow] = useState<Flow | null>(null);
  const working = useRef(false);
  const toast = useToast();
  const { state } = security;
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
    if (working.current || !state) return;
    if (!next) {
      setFlow({ kind: 'disable', step: 'current' });
      return;
    }
    if (!state.hasPin) {
      setFlow({ kind: 'create', step: 'new' });
      return;
    }
    working.current = true;
    try {
      await security.setEnabled(true);
      toast('Kamera, alarm rumah, dan kunci pintu sekarang minta PIN.');
    } catch (e) {
      toast(friendlyError(e));
    } finally {
      working.current = false;
    }
  };

  if (flow?.kind === 'reset') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BackHeader title="Keamanan" large />
        <SampleBanner area="akun" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        >
          <PinReset onCancel={() => setFlow(null)} onDone={() => finish(PIN_CHANGED_TEXT)} />
        </ScrollView>
      </View>
    );
  }
  if (flow) {
    const { title, subtitle } = COPY[flow.step];
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BackHeader title="Keamanan" large />
        <SampleBanner area="akun" />
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

  const services = account?.privacy.services ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Keamanan" large />
      <SampleBanner area="akun" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* PIN opsional untuk kamera, alarm rumah, dan kunci pintu; nama lengkap sakelarnya dibacakan pembaca layar. */}
        <ListRow
          icon="lock"
          tone={state?.pinEnabled ? 'brand' : 'terhubung'}
          iconSize={ICON}
          title="PIN"
          trailing={
            state ? <Toggle value={state.pinEnabled} onChange={(next) => void toggle(next)} label={PIN_LABEL} /> : null
          }
        />
        {state?.hasPin ? (
          <>
            <ListRow
              icon="edit"
              iconSize={ICON}
              title="Ganti PIN"
              onPress={() => setFlow({ kind: 'change', step: 'current' })}
            />
            <ListRow
              icon="help"
              iconSize={ICON}
              title="Lupa PIN"
              onPress={() => setFlow({ kind: 'reset', step: 'current' })}
            />
          </>
        ) : null}
        {security.failed && !state ? (
          <Txt
            v="caption"
            color={marker.warn.ink}
            accessibilityLiveRegion="polite"
            style={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            PIN belum bisa dimuat. Coba lagi sebentar ya.
          </Txt>
        ) : null}

        <SectionHeader title="HP yang terhubung" style={{ paddingHorizontal: 20, marginTop: 16 }} />
        {account ? (
          account.phones.map((p) => (
            <ListRow
              key={p.id}
              icon="phone"
              iconSize={ICON}
              title={p.name}
              accessibilityLabel={p.current ? `${p.name}, HP ini` : p.name}
              value={p.current ? 'HP ini' : undefined}
              valueColor={c.brandInk}
              trailing={
                p.current ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Keluarkan ${p.name}`}
                    accessibilityState={{ disabled: busy.phone(p.id) }}
                    disabled={busy.phone(p.id)}
                    onPress={() => router.push(`/akun/konfirmasi?aksi=hp&id=${encodeURIComponent(p.id)}`)}
                    android_ripple={{ color: c.ripple }}
                    style={{ height: 48, justifyContent: 'center', opacity: busy.phone(p.id) ? 0.5 : 1 }}
                  >
                    <Txt v="label" color={marker.warn.ink}>
                      Keluarkan
                    </Txt>
                  </Pressable>
                )
              }
            />
          ))
        ) : (
          <Loading status={status} error={error} retry={retry} />
        )}

        {/* Privasi: yang diingat asisten per layanan (dihapus lewat alur Terhubung), hapus akun lewat WhatsApp. */}
        <SectionHeader title={`Yang ${assistant} tahu`} style={{ paddingHorizontal: 20, marginTop: 16 }} />
        {account ? (
          services.length ? (
            // Satu baris tenang per layanan: nama dan jumlah yang diingat. Ketuk membuka lembar konfirmasi hapus.
            services.map((s) => (
              <ListRow
                key={s.id}
                leading={
                  // Logo 40 di kolom ikon 46, supaya nama sejajar dengan baris lain.
                  <View style={{ width: ICON, alignItems: 'center' }}>
                    <ServiceLogo id={s.id} name={s.name} size={40} />
                  </View>
                }
                iconSize={ICON}
                title={s.name}
                value={`${s.memoryCount} hal`}
                chevron={s.memoryCount > 0}
                accessibilityLabel={
                  s.memoryCount > 0
                    ? `Hapus yang ${assistant} tahu dari ${s.name}. ${s.memoryCount} hal`
                    : `${s.name}. ${s.memoryCount} hal`
                }
                onPress={
                  s.memoryCount > 0
                    ? () => router.push(`/terhubung/konfirmasi?id=${encodeURIComponent(s.id)}&aksi=lupa`)
                    : undefined
                }
              />
            ))
          ) : (
            <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              Belum ada.
            </Txt>
          )
        ) : null}
        <ListRow
          icon="trash"
          tone="warn"
          iconSize={ICON}
          title="Hapus akun"
          value="WhatsApp"
          chevron
          onPress={() => void erase()}
        />
        <ListRow icon="info" iconSize={ICON} title="Kebijakan privasi" role="link" onPress={() => void policy()} />
      </ScrollView>
    </View>
  );
}

function Loading({ status, error, retry }: { status: string; error: string | null; retry: () => Promise<void> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}>
      <Txt color={c.muted}>{status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}</Txt>
      {status === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Coba lagi"
          onPress={() => void retry()}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Txt weight={600} color={c.brandInk}>
            Coba lagi
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
