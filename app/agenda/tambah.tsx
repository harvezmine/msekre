import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { AgendaNew } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { dayLabel } from '@/api/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { KIND_ICON } from '@/ui/agenda/AgendaItem';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';
import { useOpenVoice } from '@/voice/available';

/** Nama jenis item di pratinjau. */
const KIND_LABEL: Record<AgendaNew['kind'], string> = {
  reminder: 'Pengingat',
  task: 'Tugas',
  meeting: 'Rapat',
  recurring: 'Rutin',
};

/** Jeda setelah mengetik sebelum pratinjau diminta ke server. */
export const PREVIEW_DEBOUNCE_MS = 400;

interface Preview {
  /** Teks yang menghasilkan pratinjau ini. */
  text: string;
  item: AgendaNew;
  guessedTime: boolean;
}

// Lembar Tambah (desain 2b). Server yang membaca kalimatnya (`POST /agenda/parse`); layar menunggu sebentar setelah
// berhenti mengetik, lalu menampilkan pratinjau.
export default function Tambah() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

function Isi() {
  const { c } = useTheme();
  const { close } = useSheet();
  const toast = useToast();
  const openSuara = useOpenVoice();
  const agenda = useAgenda();
  const { preview: ask, add } = agenda;
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const typed = text.trim();
  // Pratinjau hanya berlaku untuk teks yang menghasilkannya; selama teks berubah, ia menunggu yang baru.
  const parsed = preview && preview.text === typed ? preview : null;
  const preparing = typed !== '' && !parsed && error === null;

  useEffect(() => {
    if (!typed) return;
    let stale = false;
    const t = setTimeout(() => {
      void ask(typed).then((res) => {
        if (stale) return;
        if (res.ok) {
          setPreview({ text: typed, item: res.item, guessedTime: res.guessedTime });
          setError(null);
        } else {
          setPreview(null);
          setError(res.error);
        }
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [typed, ask]);

  const save = async () => {
    if (!parsed || saving) return;
    setSaving(true);
    const failed = await add(parsed.item);
    setSaving(false);
    if (failed) return setError(failed);
    toast('Tersimpan di agenda.');
    close();
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Txt v="title" accessibilityRole="header">
          Tambah ke agenda
        </Txt>
        <Txt color={c.muted}>Tulis seperti biasa, nanti saya rapikan.</Txt>
      </View>
      <View
        style={{
          minHeight: 104,
          borderWidth: 1.5,
          borderColor: c.green,
          borderRadius: 20,
          backgroundColor: c.paper,
          paddingVertical: 8,
          paddingLeft: 16,
          paddingRight: 8,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          multiline
          autoFocus
          accessibilityLabel="Tulis yang mau ditambahkan"
          placeholder="Ingatkan saya bayar pajak motor tanggal 25"
          placeholderTextColor={c.muted}
          cursorColor={c.green}
          selectionColor={c.green}
          textAlignVertical="top"
          style={{
            flex: 1,
            minHeight: 84,
            paddingVertical: 6,
            fontFamily: FONT[400],
            fontSize: 17,
            lineHeight: 26,
            color: c.ink,
          }}
        />
        <IconButton icon="mic" label="Bicara" tinted onPress={() => openSuara('push')} />
      </View>

      {preparing ? (
        <Txt v="caption" color={c.muted} accessibilityLiveRegion="polite">
          Menyiapkan pratinjau…
        </Txt>
      ) : null}
      {error ? (
        <Txt v="caption" color={c.muted} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}

      {parsed ? (
        <View style={{ gap: 8 }}>
          <Txt v="caption" weight={600} color={c.muted}>
            Akan saya simpan sebagai
          </Txt>
          <View style={{ backgroundColor: c.mint, borderRadius: 20, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: c.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={KIND_ICON[parsed.item.kind]} size={22} color={c.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={600}>{parsed.item.title}</Txt>
                <Txt v="caption" color={c.green}>
                  {KIND_LABEL[parsed.item.kind]}
                </Txt>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Row label="Tanggal" value={dayLabel(parsed.item.date)} />
              <Row label="Jam" value={parsed.item.time} tabular />
              {parsed.item.way === 'alarm' ? <Row label="Cara" value="Bunyi sebagai alarm" /> : null}
            </View>
            {parsed.guessedTime ? (
              <Txt v="caption" color={c.micSub}>
                Jamnya saya tebak.
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Simpan"
        accessibilityState={{ disabled: !parsed || saving }}
        disabled={!parsed || saving}
        onPress={() => void save()}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={{
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: parsed ? c.green : c.track,
        }}
      >
        <Txt weight={600} color={parsed ? c.onGreen : c.muted} style={{ fontSize: 17 }}>
          Simpan
        </Txt>
      </Pressable>
    </View>
  );
}

function Row({ label, value, tabular = false }: { label: string; value: string; tabular?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Txt color={c.muted}>{label}</Txt>
      <Txt weight={600} tabular={tabular} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}
