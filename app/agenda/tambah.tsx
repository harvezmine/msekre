import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useChatController } from '@/api/ChatProvider';
import type { AgendaNew } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { dayLabel } from '@/api/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { KIND_ICON } from '@/ui/agenda/AgendaItem';
import { Icon } from '@/ui/Icon';
import { AccentIcon, PressableScale } from '@/ui/kit';
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

/** Server belum bisa membaca kalimat agenda (501): kalimatnya dititipkan ke asisten lewat chat. */
export const VIA_CHAT_TEXT = 'Saya catat lewat chat ya.';

interface Preview {
  /** Teks yang menghasilkan pratinjau ini. */
  text: string;
  item: AgendaNew;
  guessedTime: boolean;
}

// Niat lembar: menulis satu hal untuk agenda seperti bicara biasa, lalu melihat dulu bagaimana saya menyimpannya. Tindakan
// tersering: Simpan, tombol besar paling bawah (zona jempol). Server yang membaca kalimatnya (`POST /agenda/parse`); lembar
// menunggu sebentar setelah berhenti mengetik, lalu menampilkan pratinjau. Server yang belum bisa membacanya (501):
// "Saya catat lewat chat ya", dan Simpan mengirim kalimat itu ke asisten sebagai pesan chat.
export default function Tambah() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

function Isi() {
  const { c, marker } = useTheme();
  const { close } = useSheet();
  const toast = useToast();
  const openSuara = useOpenVoice();
  const agenda = useAgenda();
  const chat = useChatController();
  const { preview: ask, add } = agenda;
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Teks yang tidak bisa dibaca server karena jalurnya belum ada (501): Simpan menitipkannya lewat chat.
  const [viaChat, setViaChat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const typed = text.trim();
  // Pratinjau hanya berlaku untuk teks yang menghasilkannya; selama teks berubah, ia menunggu yang baru.
  const parsed = preview && preview.text === typed ? preview : null;
  const chatOnly = viaChat !== null && viaChat === typed;
  const preparing = typed !== '' && !parsed && !chatOnly && error === null;
  const ready = parsed !== null || chatOnly;

  useEffect(() => {
    if (!typed) return;
    let stale = false;
    const t = setTimeout(() => {
      void ask(typed).then((res) => {
        if (stale) return;
        if (res.ok) {
          setPreview({ text: typed, item: res.item, guessedTime: res.guessedTime });
          setError(null);
        } else if (res.unavailable) {
          setPreview(null);
          setViaChat(typed);
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

  const sendViaChat = () => {
    chat.send(typed);
    toast(VIA_CHAT_TEXT);
    close();
  };

  const save = async () => {
    if (!ready || saving) return;
    if (!parsed) return sendViaChat();
    setSaving(true);
    const failed = await add(parsed.item);
    setSaving(false);
    if (failed?.unavailable) return sendViaChat();
    if (failed) return setError(failed.error);
    toast('Tersimpan di agenda.');
    close();
  };

  return (
    <View style={{ gap: 16 }}>
      <Txt v="section" accessibilityRole="header">
        Tambah ke agenda
      </Txt>
      <View
        style={{
          minHeight: 104,
          borderRadius: 24,
          backgroundColor: c.sunken,
          paddingVertical: 8,
          paddingLeft: 18,
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
          cursorColor={c.text}
          selectionColor={marker.agenda.base}
          textAlignVertical="top"
          style={{
            flex: 1,
            minHeight: 84,
            paddingVertical: 6,
            fontFamily: FONT[400],
            fontSize: 17,
            lineHeight: 26,
            color: c.text,
          }}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Bicara"
          haptic="light"
          onPress={() => openSuara('push')}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="mic" size={24} color={c.onBrand} />
        </PressableScale>
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
      {chatOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AccentIcon icon="chat" tone="brand" size={44} />
          <Txt v="row" weight={600} style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {VIA_CHAT_TEXT}
          </Txt>
        </View>
      ) : null}

      {parsed ? (
        <View style={{ gap: 8 }}>
          <Txt v="caption" weight={600} color={c.muted}>
            Akan saya simpan sebagai
          </Txt>
          <View style={{ backgroundColor: c.bg, borderRadius: 24, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AccentIcon icon={KIND_ICON[parsed.item.kind]} tone="agenda" size={44} />
              <View style={{ flex: 1 }}>
                <Txt v="row" weight={600}>
                  {parsed.item.title}
                </Txt>
                <Txt v="caption" color={c.brandInk}>
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
              <Txt v="caption" color={c.muted}>
                Jamnya saya tebak.
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Simpan"
        accessibilityState={{ disabled: !ready || saving }}
        disabled={!ready || saving}
        haptic="success"
        onPress={() => void save()}
        style={{
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? c.brand : c.sunken2,
        }}
      >
        <Txt weight={600} color={ready ? c.onBrand : c.muted} style={{ fontSize: 17 }}>
          Simpan
        </Txt>
      </PressableScale>
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
