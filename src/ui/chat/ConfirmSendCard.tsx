import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, TextInput, View } from 'react-native';
import { formatJam } from '@/api/format';
import type { Draft } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';

export interface DraftActions {
  onSend: () => void;
  onCancel: () => void;
  onEdit: (text: string) => void;
  onDiscard: () => void;
  /** Aksi pada draf ini sedang berjalan: semua tombol mati sampai jawabannya datang. */
  busy?: boolean;
}

/**
 * Kartu konfirmasi kirim untuk satu draf: draf (Ubah, Kirim, Buang), tertahan 5 menit (Batalkan), terkirim,
 * dibatalkan, atau gagal (Coba lagi). Aksinya dikerjakan pemanggil lewat `POST /drafts/:id`.
 */
export function ConfirmSendCard({
  draft: source,
  onSend,
  onCancel,
  onEdit,
  onDiscard,
  busy = false,
}: { draft: Draft } & DraftActions) {
  const { c } = useTheme();
  const [editRequested, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { to, text, status } = source;
  // Draf yang berubah di tempat lain selagi diubah (sudah terkirim, dibatalkan) menutup kolom ubah.
  const editing = editRequested && status === 'draft';
  const channel = source.channel === 'whatsapp' ? 'WhatsApp' : 'email';
  const time = source.heldUntil ? formatJam(source.heldUntil) : '';
  // Diumumkan ke pembaca layar saat kiriman baru ditahan (bukan saat layar dibuka dengan kartu yang sudah tertahan).
  const last = useRef(status);
  useEffect(() => {
    if (last.current !== 'held' && status === 'held') {
      AccessibilityInfo.announceForAccessibility(`Dikirim ${time}, bisa dibatalkan`);
    }
    last.current = status;
  }, [status, time]);
  const initials = to
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={700} color={c.green} style={{ fontSize: 14, lineHeight: 20 }}>
            {initials}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={600}>{to}</Txt>
          <Txt v="caption" color={c.muted}>
            lewat {channel}
          </Txt>
        </View>
      </View>
      {editing ? (
        <TextInput
          accessibilityLabel="Isi pesan"
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          cursorColor={c.green}
          selectionColor={c.green}
          style={{
            backgroundColor: c.paper,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.green,
            paddingVertical: 12,
            paddingHorizontal: 16,
            fontFamily: FONT[400],
            fontSize: 16,
            lineHeight: 24,
            color: c.ink,
            textAlignVertical: 'top',
          }}
        />
      ) : (
        <View style={{ backgroundColor: c.paper, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 }}>
          <Txt color={status === 'cancelled' ? c.muted : c.ink}>{text}</Txt>
        </View>
      )}
      {status === 'draft' && editing && (
        <CardButton
          label="Simpan"
          primary
          disabled={busy}
          onPress={() => {
            const next = draft.trim();
            if (next && next !== text) onEdit(next);
            setEditing(false);
          }}
        />
      )}
      {status === 'draft' && !editing && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CardButton
            label="Ubah"
            disabled={busy}
            onPress={() => {
              setDraft(text);
              setEditing(true);
            }}
          />
          <CardButton
            label="Kirim"
            primary
            disabled={busy}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSend();
            }}
          />
        </View>
      )}
      {status === 'draft' && !editing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buang draf"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDiscard}
          android_ripple={{ color: c.ripple }}
          style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt v="caption" weight={600} color={c.muted}>
            Buang draf
          </Txt>
        </Pressable>
      )}
      {status === 'held' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
          <Icon name="check" size={22} color={c.leafText} />
          <Txt weight={600} color={c.leafText} style={{ flex: 1 }}>
            Dikirim {time}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Batalkan"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onCancel}
            android_ripple={{ color: c.ripple }}
            style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green}>
              · Batalkan
            </Txt>
          </Pressable>
        </View>
      )}
      {status === 'sent' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
          <Icon name="check" size={22} color={c.leafText} />
          <Txt weight={600} color={c.leafText}>
            {time ? `Terkirim ${time}` : 'Terkirim'}
          </Txt>
        </View>
      )}
      {status === 'failed' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
          <Icon name="x" size={22} color={c.clay} />
          <Txt weight={600} color={c.clay} style={{ flex: 1 }}>
            Gagal terkirim
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Coba kirim lagi draf ke ${to}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onSend}
            android_ripple={{ color: c.ripple }}
            style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.green}>
              · Coba lagi
            </Txt>
          </Pressable>
        </View>
      )}
      {status === 'cancelled' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
          <Icon name="x" size={22} color={c.muted} />
          <Txt weight={600} color={c.muted}>
            Dibatalkan · tidak jadi terkirim
          </Txt>
        </View>
      )}
    </ChatCard>
  );
}
