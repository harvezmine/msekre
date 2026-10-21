import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { ERROR_TEXT, friendlyError } from '@/api/errors';
import { cleanPhone, groupPhone } from '@/api/format';
import { isApiFailure } from '@/api/transport';
import { useAuth } from '@/api/useAuth';
import { readWaNumber, waStartUrl } from '@/api/waNumber';
import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from '@/ui/IconButton';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const CODE_LENGTH = 6;
/** Mode contoh tidak mengirim WhatsApp sungguhan; kode apa pun diterima. */
export const SAMPLE_CODE_HINT = 'Mode contoh: isi 6 angka apa saja, misalnya 123456.';

/** Nomor E.164 tanpa "+": 62 di depan angka yang sudah dibersihkan. */
const toE164 = (digits: string) => `62${digits}`;
const pad = (n: number) => String(n).padStart(2, '0');
const formatPhone = groupPhone;
const clock = (s: number) => `${pad(Math.floor(s / 60))}.${pad(s % 60)}`;

// Layar pertama kali 2 (desain 2o): nomor WhatsApp dan kode. "Kirim kode" meminta kode ke server (auth/start); "Masuk"
// mencocokkannya (auth/verify). Nomor contoh terisi hanya di mode contoh; di mode server mulai dari kosong.
export default function MulaiMasuk() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { mode } = useApi();
  const { start, verify } = useAuth();
  const [phone, setPhone] = useState(mode === 'contoh' ? '81220457781' : '');
  const [code, setCode] = useState('');
  /**
   * Kapan (ms jam HP) tiap nomor boleh minta kode lagi. Ada isinya = kode sudah diminta untuk nomor itu. Per nomor,
   * jadi mengubah nomor lalu mengembalikannya tidak mengulang tunggu; berupa batas waktu (bukan hitungan mundur) supaya
   * tidak meleset saat aplikasi di latar belakang.
   */
  const [until, setUntil] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<'start' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Nomor belum punya akun (aplikasi ini add-on): nomor WhatsApp untuk memulai, atau `null` bila tidak diketahui. */
  const [startWa, setStartWa] = useState<{ number: string | null } | null>(null);
  const busyRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const phoneRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const deadline = until[toE164(phone)];
  const requested = deadline !== undefined;
  const left = requested ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting, phone]);
  useEffect(() => {
    // iOS tidak membaca live region; pembaca layar diberi tahu langsung.
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const phoneOk = phone.length >= 9;
  const ready = phoneOk && requested && code.length === CODE_LENGTH;
  const waitFor = (number: string, sec: number) => {
    const at = Date.now();
    setNow(at);
    setUntil((u) => ({ ...u, [number]: at + sec * 1000 }));
  };

  /** Satu permintaan pada satu waktu: ketukan kedua selagi menunggu diabaikan. */
  const run = async (kind: 'start' | 'verify', job: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    setStartWa(null);
    try {
      await job();
    } catch (e) {
      setError(friendlyError(e));
      if (isApiFailure(e) && e.code === 'not_registered') {
        setStartWa({ number: e.waNumber ?? readWaNumber() });
      }
      // Terlalu sering berarti kode sudah pernah diminta; tunggu sesuai kata server.
      if (kind === 'start' && isApiFailure(e) && e.code === 'rate_limited') {
        waitFor(toE164(phone), e.retryInSec ?? 0);
      }
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
      waitFor(toE164(phone), res.resendInSec);
      codeRef.current?.focus();
      toast(again ? 'Kode baru dikirim lewat WhatsApp.' : 'Kode dikirim lewat WhatsApp.');
    });
  const submit = () =>
    run('verify', async () => {
      await verify(toE164(phone), code);
      // Mode server: AfterSignIn (akar) membukanya sesudah penjaga rute menutup layar ini.
      if (mode === 'contoh') router.push('/mulai/pilih');
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
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
                backgroundColor: c.surface,
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
                  setNow(Date.now());
                  setError(null);
                  setStartWa(null);
                }}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                placeholder="812-0000-0000"
                placeholderTextColor={c.muted}
                style={{ flex: 1, fontSize: 17, fontFamily: 'PlusJakartaSans_500Medium', color: c.text, padding: 0 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ubah"
                onPress={() => {
                  setPhone('');
                  setError(null);
                  setStartWa(null);
                  phoneRef.current?.focus();
                }}
                android_ripple={{ color: c.ripple }}
                style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
              >
                <Txt weight={600} color={c.brandInk} style={{ fontSize: 15 }}>
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
                        borderColor: active ? c.brand : c.line,
                        backgroundColor: c.surface,
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
                maxLength={CODE_LENGTH}
                caretHidden
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
              />
            </View>
            {mode === 'contoh' ? (
              <Txt v="caption" color={c.muted}>
                {SAMPLE_CODE_HINT}
              </Txt>
            ) : null}
            {error ? (
              <Txt v="caption" color={marker.warn.ink} accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            {startWa?.number ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mulai lewat WhatsApp"
                onPress={() => Linking.openURL(waStartUrl(startWa.number!)).catch(() => setError(ERROR_TEXT))}
                android_ripple={{ color: c.ripple }}
                style={{
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.sunken,
                  marginTop: 4,
                }}
              >
                <Txt weight={600} color={c.brandInk}>
                  Mulai lewat WhatsApp
                </Txt>
              </Pressable>
            ) : null}
            {counting ? (
              <Txt v="caption" color={c.muted} tabular>
                Kirim ulang kode dalam {clock(left)}
              </Txt>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={requested ? 'Kirim ulang kode' : 'Kirim kode'}
                accessibilityState={{ disabled: busy !== null || !phoneOk }}
                disabled={busy !== null || !phoneOk}
                onPress={() => send(requested)}
                android_ripple={{ color: c.ripple }}
                style={{
                  height: 48,
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  opacity: busy !== null || !phoneOk ? 0.4 : 1,
                }}
              >
                <Txt weight={600} color={c.brandInk} style={{ fontSize: 15 }}>
                  {busy === 'start' ? 'Mengirim…' : requested ? 'Kirim ulang kode' : 'Kirim kode'}
                </Txt>
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1 }} />
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ganti mode data"
              onPress={() => router.push('/mode')}
              style={{ height: 48, justifyContent: 'center', alignSelf: 'center' }}
            >
              <Txt v="caption" color={c.muted}>
                Ganti mode data
              </Txt>
            </Pressable>
          ) : null}
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
