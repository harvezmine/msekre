import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { parseAgenda, toAgendaItem } from '@/sample/parse';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

// Lembar Tambah (desain 2b). Pratinjau dibaca dari teks oleh pengurai contoh; pengurai sungguhan datang dari server nanti.
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
  const dispatch = useSampleDispatch();
  const [text, setText] = useState('');
  const parsed = parseAgenda(text);

  const save = () => {
    if (!parsed) return;
    dispatch({ type: 'addAgenda', item: toAgendaItem(parsed) });
    dispatch({ type: 'showToast', text: 'Tersimpan di agenda.' });
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
          onChangeText={setText}
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
        <IconButton icon="mic" label="Bicara" tinted onPress={() => router.push('/suara')} />
      </View>

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
                <Icon name={parsed.kind === 'reminder' ? 'bell' : 'task'} size={22} color={c.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={600}>{parsed.title}</Txt>
                <Txt v="caption" color={c.green}>
                  {parsed.kind === 'reminder' ? 'Pengingat' : 'Tugas'}
                </Txt>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Row label="Tanggal" value={parsed.dateLabel} />
              <Row label="Jam" value={parsed.time} tabular />
              {parsed.way ? <Row label="Cara" value="Bunyi sebagai alarm" /> : null}
            </View>
            {parsed.timeGuessed ? (
              <Txt v="caption" color="#3F5048">
                Jamnya saya tebak. Ketuk untuk mengubah.
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Simpan"
        accessibilityState={{ disabled: !parsed }}
        disabled={!parsed}
        onPress={save}
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
