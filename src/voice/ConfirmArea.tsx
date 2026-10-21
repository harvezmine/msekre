import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useChat } from '@/api/useChat';
import type { Card } from '@/api/contract';
import { onVoice } from '@/theme/tokens';
import { ChoicesCard } from '@/ui/chat/ChoicesCard';
import { ConfirmSendCard } from '@/ui/chat/ConfirmSendCard';
import { PaymentCard } from '@/ui/chat/PaymentCard';
import { Txt } from '@/ui/Txt';

/**
 * Kartu konfirmasi dari Mode Suara. Pembayaran, pesan ke orang lain, dan aksi keamanan tidak dijalankan lewat suara saja:
 * kartunya sama dengan di chat dan baru bekerja setelah diketuk. Kartu yang belum dikenal di sini diteruskan ke chat.
 */
export function ConfirmArea({ card, messageId }: { card: Card; messageId?: string }) {
  const chat = useChat();
  return (
    <View style={{ gap: 8, alignItems: 'center' }} testID="suara-konfirmasi">
      <Body card={card} messageId={messageId} chat={chat} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buka di chat"
        onPress={() => router.replace('/chat')}
        style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Txt v="caption" weight={600} color={onVoice.label}>
          Buka di chat
        </Txt>
      </Pressable>
    </View>
  );
}

function Body({ card, messageId, chat }: { card: Card; messageId?: string; chat: ReturnType<typeof useChat> }) {
  if (card.kind === 'draft') {
    const { id } = card.draft;
    // Keadaan draf yang terbaru ada di utas chat (dikirim, dibatalkan, ditahan).
    const live = chat.messages
      .flatMap((m) => m.parts)
      .find((p) => p.type === 'card' && p.card.kind === 'draft' && p.card.draft.id === id);
    const draft = live?.type === 'card' && live.card.kind === 'draft' ? live.card.draft : card.draft;
    return (
      <ConfirmSendCard
        draft={draft}
        busy={chat.draftBusy(id)}
        onSend={() => void chat.draftAction(id, 'send')}
        onCancel={() => void chat.draftAction(id, 'cancel')}
        onEdit={(text) => void chat.draftAction(id, 'edit', text)}
        onDiscard={() => void chat.draftAction(id, 'discard')}
      />
    );
  }
  if (card.kind === 'payment') {
    const message = chat.messages.find((m) => m.id === messageId);
    const choices = message?.parts.find((p) => p.type === 'choices');
    return (
      <>
        <PaymentCard payment={card} />
        {message && choices?.type === 'choices' ? (
          <ChoicesCard
            choices={choices.choices}
            chosenId={chat.chosen(message)}
            onChoose={(choiceId) => chat.choose(message.id, choiceId)}
          />
        ) : null}
      </>
    );
  }
  return (
    <Txt color={onVoice.text} style={{ textAlign: 'center' }}>
      Yang satu ini dilanjutkan di chat ya.
    </Txt>
  );
}
