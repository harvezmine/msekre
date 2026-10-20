import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from '@/ui/IconButton';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 42;

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
const clock = (s: number) => `00.${String(s).padStart(2, '0')}`;

// Layar pertama kali 2 (desain 2o): nomor WhatsApp dan kode. Kode apa pun yang berisi 6 angka diterima.
export default function MulaiMasuk() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { dispatch } = useSample();
  const [phone, setPhone] = useState('81220457781');
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [focused, setFocused] = useState(false);
  const phoneRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const ready = phone.length >= 9 && code.length === CODE_LENGTH;
  const resend = () => {
    setLeft(RESEND_SECONDS);
    dispatch({ type: 'showToast', text: 'Kode baru dikirim lewat WhatsApp.' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ paddingTop: insets.top, height: 64 + insets.top, justifyContent: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 24 }}>
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
              onChangeText={(t) => setPhone(cleanPhone(t))}
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
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
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
          {left > 0 ? (
            <Txt v="caption" color={c.muted} tabular>
              Kirim ulang kode dalam {clock(left)}
            </Txt>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kirim ulang kode"
              onPress={resend}
              android_ripple={{ color: c.ripple }}
              style={{ height: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
            >
              <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                Kirim ulang kode
              </Txt>
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }} />
        <StepDots step={2} />
        <PrimaryButton label="Masuk" disabled={!ready} onPress={() => router.push('/mulai/pilih')} />
      </View>
    </View>
  );
}
