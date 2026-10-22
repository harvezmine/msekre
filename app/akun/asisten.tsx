// Asisten: siapa nama asisten, bagaimana ia bicara, dan apakah ia menyapa tiap pagi, di satu halaman.
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GREETING_TIMES, isAssistantName, STYLES } from '@/api/account';
import { ASSISTANT_NAME_MAX } from '@/api/contract';
import type { AssistantStyle } from '@/api/contract';
import { INVALID_NAME_TEXT } from '@/api/errors';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useAccount } from '@/api/useAccount';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { SampleBanner } from '@/ui/SampleBanner';
import { FilterChips } from '@/ui/FilterChips';
import { ListRow, Segmented } from '@/ui/kit';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const STYLE_VALUES = STYLES.map((s) => s.value);
const STYLE_LABELS = Object.fromEntries(STYLES.map((s) => [s.value, s.title])) as Record<AssistantStyle, string>;

function Label({ children }: { children: string }) {
  return (
    <Txt v="label" style={{ paddingHorizontal: 4 }}>
      {children}
    </Txt>
  );
}

export default function Asisten() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { account, status, error, retry, setAssistant, setGreeting, busy } = useAccount();
  // Nama yang sedang diketik; `null` = mengikuti Akun (termasuk yang datang belakangan).
  const [name, setName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BackHeader title="Asisten" large />
        <SampleBanner area="akun" />
        <Txt color={c.muted} style={{ padding: 24, textAlign: 'center' }}>
          {status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}
        </Txt>
        {status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={() => void retry()}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.brandInk} style={{ textAlign: 'center' }}>
              Coba lagi
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const current = account.assistant;
  const shownName = name ?? current.name;
  const trimmed = shownName.trim();
  const nameOk = isAssistantName(trimmed);
  const nameChanged = trimmed !== current.name;
  const hint = problem ?? (trimmed && !nameOk ? INVALID_NAME_TEXT : null);
  const example = STYLES.find((s) => s.value === current.style)?.example;
  const { daily, time } = account.greeting;
  // Jam yang dipilih dari tempat lain (misalnya lewat WhatsApp) tetap tampil di antara pilihan.
  const times: string[] =
    time && !GREETING_TIMES.some((t) => t === time) ? [...GREETING_TIMES, time].sort() : [...GREETING_TIMES];

  const saveName = async () => {
    if (!nameOk || !nameChanged || busy.assistant) return;
    const res = await setAssistant({ name: trimmed });
    if (res.ok) {
      setName(null);
      Keyboard.dismiss();
      toast(`Tersimpan. Sekarang saya ${trimmed}.`);
    } else {
      setProblem(res.message);
    }
  };
  // Gaya dan sapaan berlaku seketika; kalau server menolak, pilihan kembali dan ada kalimat ramah.
  const changeStyle = async (style: AssistantStyle) => {
    const res = await setAssistant({ style });
    if (!res.ok && res.message) toast(res.message);
  };
  const changeGreeting = async (req: { daily: boolean; time?: string }) => {
    const res = await setGreeting(req);
    if (!res.ok && res.message) toast(res.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <BackHeader title="Asisten" large />
      <SampleBanner area="akun" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 28 }}
      >
        <View style={{ gap: 10 }}>
          <Label>Nama</Label>
          <TextInput
            accessibilityLabel="Nama asisten"
            value={shownName}
            onChangeText={(t) => {
              setName(t);
              setProblem(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => void saveName()}
            returnKeyType="done"
            maxLength={ASSISTANT_NAME_MAX}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder={DEFAULT_ASSISTANT}
            placeholderTextColor={c.muted}
            style={{
              height: 56,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: hint ? marker.warn.base : focused ? c.text : 'transparent',
              backgroundColor: c.sunken,
              paddingHorizontal: 18,
              fontSize: 17,
              color: c.text,
            }}
          />
          {hint ? (
            <Txt v="caption" color={marker.warn.ink} accessibilityLiveRegion="polite" style={{ paddingHorizontal: 4 }}>
              {hint}
            </Txt>
          ) : null}
          {/* Simpan hanya muncul saat nama diubah. */}
          {nameChanged ? (
            <PrimaryButton label="Simpan" onPress={() => void saveName()} disabled={!nameOk || busy.assistant} />
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Label>Gaya bicara</Label>
          <Segmented
            options={STYLE_VALUES}
            labels={STYLE_LABELS}
            value={current.style}
            onChange={(s) => void changeStyle(s)}
            label="Gaya bicara"
          />
          {example ? (
            <Txt color={c.muted} style={{ paddingHorizontal: 4 }}>
              {`“${example}”`}
            </Txt>
          ) : null}
        </View>

        <View style={{ gap: 4, marginHorizontal: -20 }}>
          <ListRow
            icon="sun"
            tone="brand"
            iconSize={46}
            title="Sapaan pagi"
            trailing={
              <Toggle value={daily} onChange={(next) => void changeGreeting({ daily: next })} label="Sapaan pagi" />
            }
          />
          {daily ? (
            <View style={{ paddingLeft: 4 }}>
              <FilterChips
                options={times}
                value={time && times.includes(time) ? time : '07.00'}
                onChange={(t) => void changeGreeting({ daily: true, time: t })}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
