import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import { friendlyError } from '@/api/errors';
import { useSecurity } from '@/api/useSecurity';
import { isApiFailure } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { PrimaryButton } from '../PrimaryButton';
import { Txt } from '../Txt';
import { PinPad, type PinVerdict } from './PinPad';

/** Kabar setelah PIN diganti lewat lupa PIN (server juga mengirim pemberitahuan ke WhatsApp). */
export const PIN_CHANGED_TEXT = 'PIN sudah diganti. Kami kirim pemberitahuan ke WhatsApp Anda.';

const MISMATCH = 'PIN belum sama, ulangi ya.';
/** Mode contoh tidak mengirim WhatsApp sungguhan; hanya kode ini yang cocok. */
export const SAMPLE_RESET_HINT = 'Mode contoh: kodenya 123456.';
const WRONG_CODE = 'Kodenya belum cocok. Coba lagi ya.';

type Step = 'ask' | 'code' | 'new' | 'repeat';

interface Props {
  /** PIN baru tersimpan. */
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Lupa PIN: kode 6 angka dikirim ke WhatsApp pemilik (seperti kode masuk), lalu pemilik membuat PIN baru. Kode dan PIN
 * baru dikirim bersama di langkah terakhir; kode yang salah kembali ke langkah kode dengan pesan.
 */
export function PinReset({ onDone, onCancel }: Props) {
  const { c } = useTheme();
  const { mode } = useApi();
  const security = useSecurity({ load: false });
  const [step, setStep] = useState<Step>('ask');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const code = useRef('');
  const first = useRef('');

  const send = async () => {
    if (sending) return;
    setSending(true);
    setProblem(null);
    try {
      await security.resetStart();
      setStep('code');
    } catch (e) {
      setProblem(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  if (step === 'ask') {
    return (
      <View style={{ gap: 12 }}>
        <Txt v="title" accessibilityRole="header">
          Lupa PIN?
        </Txt>
        <Txt color={c.muted}>
          Saya kirim kode 6 angka ke WhatsApp Anda. Dengan kode itu Anda bisa membuat PIN yang baru.
        </Txt>
        {problem ? (
          <Txt accessibilityRole="alert" accessibilityLiveRegion="polite" color={c.clay} weight={600}>
            {problem}
          </Txt>
        ) : null}
        <View style={{ gap: 8, paddingTop: 8 }}>
          <PrimaryButton
            label={sending ? 'Mengirim…' : 'Kirim kode ke WhatsApp'}
            disabled={sending}
            onPress={() => void send()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Batal"
            onPress={onCancel}
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

  const submit = async (pin: string): Promise<PinVerdict> => {
    if (step === 'code') {
      code.current = pin;
      setStep('new');
      return true;
    }
    if (step === 'new') {
      first.current = pin;
      setStep('repeat');
      return true;
    }
    if (pin !== first.current) return MISMATCH;
    try {
      await security.resetVerify(code.current, pin);
      onDone();
      return true;
    } catch (e) {
      if (isApiFailure(e) && e.code === 'kode_salah') {
        // Kode salah atau kedaluwarsa: kembali ke langkah kode.
        code.current = '';
        first.current = '';
        setStep('code');
        setProblem(WRONG_CODE);
        return true;
      }
      return friendlyError(e);
    }
  };

  const copy = {
    code: { title: 'Masukkan kode', subtitle: 'Kode dikirim ke WhatsApp Anda.' },
    new: { title: 'Buat PIN baru', subtitle: 'Pilih 6 angka yang mudah Anda ingat.' },
    repeat: { title: 'Ulangi PIN', subtitle: 'Masukkan 6 angka yang sama sekali lagi.' },
  }[step];
  return (
    <View style={{ gap: 8 }}>
      {step === 'code' && mode === 'contoh' ? (
        <Txt v="caption" color={c.muted} style={{ textAlign: 'center' }}>
          {SAMPLE_RESET_HINT}
        </Txt>
      ) : null}
      {step === 'code' && problem ? (
        <Txt
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          color={c.clay}
          weight={600}
          style={{ textAlign: 'center' }}
        >
          {problem}
        </Txt>
      ) : null}
      <PinPad
        key={step}
        title={copy.title}
        subtitle={copy.subtitle}
        noun={step === 'code' ? 'Kode' : 'PIN'}
        onSubmit={(value) => {
          if (step === 'code') setProblem(null);
          return submit(value);
        }}
        onCancel={onCancel}
      />
    </View>
  );
}
