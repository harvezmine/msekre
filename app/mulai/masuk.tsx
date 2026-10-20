import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { friendlyError } from '@/api/errors';
import { isApiFailure } from '@/api/transport';
import { useAuth } from '@/api/useAuth';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from '@/ui/IconButton';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';

const CODE_LENGTH = 6;

/** Hanya angka, tanpa 0 atau 62 di depan, paling banyak 13 angka. */
function cleanPhone(text: string): string {
  return text
    .replace(/\D/g, '')
    .replace(/^(0|62)/, '')
    .slice(0, 13);
}
/** 8122045781 -> 812-2045-781 (tiga, empat, sisanya). */
function formatPhone(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean).join('-');
}
/** Nomor E.164 tanpa "+": 62 di depan angka yang sudah dibersihkan. */
const toE164 = (digits: string) => `62${digits}`;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => `${pad(Math.floor(s / 60))}.${pad(s % 60)}`;

// Layar pertama kali 2 (desain 2o): nomor WhatsApp dan kode. "Kirim kode" meminta kode ke server (auth/start); "Masuk"
// mencocokkannya (auth/verify). Nomor contoh terisi hanya di mode contoh; di mode server mulai dari kosong.
export default function MulaiMasuk() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { dispatch } = useSample();
  const { mode } = useApi();
  const { start, verify } = useAuth();
  const [phone, setPhone] = useState(mode === 'contoh' ? '81220457781' : '');
  const [code, setCode] = useState('');
  /** Detik sampai boleh minta kode lagi; `null` selama kode belum diminta. */
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<'start' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const phoneRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const counting = left !== null;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [counting]);

  const phoneOk = phone.length >= 9;
  const ready = phoneOk && code.length === CODE_LENGTH;

  /** Satu permintaan pada satu waktu: ketukan kedua selagi menunggu diabaikan. */
  const run = async (kind: 'start' | 'verify', job: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(friendlyError(e));
      if (kind === 'verify' && isApiFailure(e) && e.code === 'kode_salah') {
        setCode('');
        codeRef.current?.focus();
      }
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  const send = (again: boolean) =>
    run('start', async () => {
      const res = await start(toE164(phone));
      setLeft(res.resendInSec);
      dispatch({
        type: 'showToast',
        text: again ? 'Kode baru dikirim lewat WhatsApp.' : 'Kode dikirim lewat WhatsApp.',
      });
    });
  const submit = () =>
    run('verify', async () => {
      await verify(toE164(phone), code);
      router.push('/mulai/pilih');
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      {/* Edge-to-edge (SDK 58): jendela tidak mengecil, jadi 'padding' menaikkan isi setinggi keyboard dan ScrollView menggulirkannya. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            gap: 24,
          }}
        >
          <View style={{ gap: 8 }}>
            <Txt v="display" accessibilityRole="header">
              Masuk dengan nomor WhatsApp
            </Txt>
            <Txt weight={400} color={c.muted} style={{ fontSize: 17, lineHeight: 26 }}>
              Kodenya saya kirim lewat WhatsApp, bukan SMS.
            </Txt>
          </View>

          <View style={{ gap: 8 }}>
            <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
              Nomor WhatsApp
            </Txt>
            <View
              style={{
                height: 60,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 18,
                paddingRight: 8,
                gap: 12,
              }}
            >
              <Txt weight={600} color={c.muted} style={{ fontSize: 17 }}>
                +62
              </Txt>
              <View style={{ width: 1, height: 28, backgroundColor: c.line }} />
              <TextInput
                ref={phoneRef}
                accessibilityLabel="Nomor WhatsApp"
                value={formatPhone(phone)}
                onChangeText={(t) => {
                  setPhone(cleanPhone(t));
                  setLeft(null);
                  setError(null);
                }}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                placeholder="812-0000-0000"
                placeholderTextColor={c.muted}
                style={{ flex: 1, fontSize: 17, fontFamily: 'PlusJakartaSans_500Medium', color: c.ink, padding: 0 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ubah"
                onPress={() => {
                  setPhone('');
                  setLeft(null);
                  phoneRef.current?.focus();
                }}
                android_ripple={{ color: c.ripple }}
                style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
              >
                <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                  Ubah
                </Txt>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
              Kode dari WhatsApp
            </Txt>
            {/* Satu kolom isian tak terlihat menampung ketikan, tempel, dan isi otomatis; enam kotak hanya menampilkan. */}
            <View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Array.from({ length: CODE_LENGTH }, (_, i) => {
                  const active = focused && i === Math.min(code.length, CODE_LENGTH - 1);
                  return (
                    <Pressable
                      key={i}
                      accessible={false}
                      onPress={() => codeRef.current?.focus()}
                      style={{
                        flex: 1,
                        height: 60,
                        borderRadius: 16,
                        borderWidth: active ? 1.5 : 1,
                        borderColor: active ? c.green : c.line,
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt weight={600} tabular style={{ fontSize: 24, lineHeight: 30 }}>
                        {code[i] ?? ''}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                ref={codeRef}
                accessibilityLabel="Kode dari WhatsApp"
                value={code}
                onChangeText={(t) => {
                  const next = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
                  setCode(next);
                  setError(null);
                  // Enam angka lengkap: tutup keyboard supaya "Masuk" terlihat penuh.
                  if (next.length === CODE_LENGTH) Keyboard.dismiss();
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={CODE_LENGTH}
                caretHidden
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
              />
            </View>
            {error ? (
              <Txt v="caption" color={c.clay} accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            {left !== null && left > 0 ? (
              <Txt v="caption" color={c.muted} tabular>
                Kirim ulang kode dalam {clock(left)}
              </Txt>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={left === null ? 'Kirim kode' : 'Kirim ulang kode'}
                accessibilityState={{ disabled: busy !== null || !phoneOk }}
                disabled={busy !== null || !phoneOk}
                onPress={() => send(left !== null)}
                android_ripple={{ color: c.ripple }}
                style={{
                  height: 48,
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  opacity: busy !== null || !phoneOk ? 0.4 : 1,
                }}
              >
                <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                  {busy === 'start' ? 'Mengirim…' : left === null ? 'Kirim kode' : 'Kirim ulang kode'}
                </Txt>
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1 }} />
          <StepDots step={2} />
          <PrimaryButton
            label={busy === 'verify' ? 'Memeriksa…' : 'Masuk'}
            disabled={!ready || busy !== null}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
