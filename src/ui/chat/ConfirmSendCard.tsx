import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, TextInput, View } from 'react-native';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';

/** Kartu konfirmasi kirim untuk satu kiriman: draf (Ubah, Kirim), tertahan 5 menit (Batalkan), atau dibatalkan. */
export function ConfirmSendCard({ outgoingId }: { outgoingId: string }) {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const outgoing = state.outgoing[outgoingId];
  if (!outgoing) return null;
  const { id, to, channel, text, status, heldUntil } = outgoing;
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
          onPress={() => {
            dispatch({ type: 'editDraft', id, text: draft });
            setEditing(false);
          }}
        />
      )}
      {status === 'draft' && !editing && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CardButton
            label="Ubah"
            onPress={() => {
              setDraft(text);
              setEditing(true);
            }}
          />
          <CardButton
            label="Kirim"
            primary
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch({ type: 'sendDraft', id });
              AccessibilityInfo.announceForAccessibility(`Dikirim ${heldUntil}, bisa dibatalkan`);
            }}
          />
        </View>
      )}
      {status === 'held' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
          <Icon name="check" size={22} color={c.leafText} />
          <Txt weight={600} color={c.leafText} style={{ flex: 1 }}>
            Dikirim {heldUntil}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Batalkan"
            onPress={() => dispatch({ type: 'cancelSend', id })}
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
            Terkirim {heldUntil}
          </Txt>
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
