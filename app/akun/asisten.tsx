import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { greetingPreview, isAssistantName, STYLES } from '@/api/account';
import { ASSISTANT_NAME_MAX } from '@/api/contract';
import type { AssistantStyle } from '@/api/contract';
import { INVALID_NAME_TEXT } from '@/api/errors';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useAccount } from '@/api/useAccount';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

// Nama dan gaya asisten (di bawah Akun): nama 2 sampai 20 huruf dengan contoh sapaan langsung, dan gaya bicara.
export default function Asisten() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { account, status, error, retry, setAssistant, busy } = useAccount();
  // Yang belum diubah pengguna mengikuti Akun (termasuk yang datang belakangan); yang diubah menjadi miliknya.
  const [name, setName] = useState<string | null>(null);
  const [style, setStyle] = useState<AssistantStyle | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <BackHeader title="Nama dan gaya asisten" />
        <Txt color={c.muted} style={{ padding: 24, textAlign: 'center' }}>
          {status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}
        </Txt>
        {status === 'error' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void retry()}>
            <Txt weight={600} color={c.green} style={{ textAlign: 'center' }}>
              Coba lagi
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const current = account.assistant;
  const shownName = name ?? current.name;
  const shownStyle = style ?? current.style;
  const trimmed = shownName.trim();
  const nameOk = isAssistantName(trimmed);
  const changed = trimmed !== current.name || shownStyle !== current.style;
  const hint = problem ?? (trimmed && !nameOk ? INVALID_NAME_TEXT : null);

  const save = async () => {
    const res = await setAssistant({
      ...(trimmed !== current.name ? { name: trimmed } : {}),
      ...(shownStyle !== current.style ? { style: shownStyle } : {}),
    });
    if (res.ok) {
      toast(`Tersimpan. Sekarang saya ${trimmed}.`);
      router.back();
    } else {
      setProblem(res.message);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.paper }} behavior="padding">
      <BackHeader title="Nama dan gaya asisten" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 20 }}
      >
        <View style={{ gap: 8 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
            Nama asisten
          </Txt>
          <TextInput
            accessibilityLabel="Nama asisten"
            value={shownName}
            onChangeText={(t) => {
              setName(t);
              setProblem(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={ASSISTANT_NAME_MAX}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder={`Contoh: ${DEFAULT_ASSISTANT}`}
            placeholderTextColor={c.muted}
            style={{
              height: 56,
              borderRadius: 20,
              borderWidth: focused ? 2 : 1,
              borderColor: hint ? c.clay : focused ? c.green : c.line,
              backgroundColor: c.card,
              paddingHorizontal: 16,
              fontSize: 17,
              color: c.ink,
            }}
          />
          <Txt color={c.muted} style={{ paddingHorizontal: 4 }}>
            {greetingPreview(trimmed)}
          </Txt>
          {hint ? (
            <Txt v="caption" color={c.clay} accessibilityLiveRegion="polite" style={{ paddingHorizontal: 4 }}>
              {hint}
            </Txt>
          ) : null}
        </View>

        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
            Gaya bicara
          </Txt>
          {STYLES.map((s) => {
            const on = shownStyle === s.value;
            return (
              <Pressable
                key={s.value}
                accessibilityRole="radio"
                accessibilityLabel={s.title}
                accessibilityHint={s.example}
                accessibilityState={{ checked: on }}
                onPress={() => {
                  setStyle(s.value);
                  setProblem(null);
                }}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? c.green : c.line,
                  backgroundColor: on ? c.mint : c.card,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: on ? c.green : c.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.green }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt weight={600}>{s.title}</Txt>
                  <Txt color={on ? c.ink : c.muted}>{`“${s.example}”`}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label="Simpan" onPress={() => void save()} disabled={!nameOk || !changed || busy.assistant} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
