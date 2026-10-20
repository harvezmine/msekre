import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { ERROR_TEXT } from '@/api/errors';
import { formatFileMeta } from '@/api/format';
import { useAssistantName } from '@/api/useProfile';
import type { Message, Part } from '@/api/contract';
import { useChat, type Chat as ChatApi } from '@/api/useChat';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { AssistantLine, UserBubble, ViaTag } from '@/ui/chat/Bubble';
import { AudioRow } from '@/ui/chat/AudioRow';
import { ChoicesCard } from '@/ui/chat/ChoicesCard';
import { Composer } from '@/ui/chat/Composer';
import { bannerText, ConnectionBanner, useLateOffline } from '@/ui/chat/ConnectionBanner';
import { ConfirmSendCard } from '@/ui/chat/ConfirmSendCard';
import { DeviceCard, DeviceCardView } from '@/ui/chat/DeviceCard';
import { FileCard } from '@/ui/chat/FileCard';
import { ImageCard } from '@/ui/chat/ImageCard';
import { NotesCard } from '@/ui/chat/NotesCard';
import { PaymentCard } from '@/ui/chat/PaymentCard';
import { QrisCard } from '@/ui/chat/QrisCard';
import { buildRows, type Row } from '@/ui/chat/rows';
import { Thinking } from '@/ui/chat/Thinking';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

/** Jarak (dp) dari dasar utas yang masih dianggap "di dasar". */
const NEAR_BOTTOM = 80;

const SUGGESTIONS: { icon: IconName; text: string }[] = [
  { icon: 'mail', text: 'Ringkas email hari ini' },
  { icon: 'bulb', text: 'Matikan semua lampu' },
  { icon: 'store', text: 'Cek stok kedai' },
  { icon: 'bolt', text: 'Beli token listrik' },
];

// Utas dari useChat(): server tiruan di mode contoh, server asli di mode server. Daftarnya terbalik (pesan terbaru di
// bawah); menggulir ke atas memuat pesan yang lebih lama.
export default function Chat() {
  const assistantName = useAssistantName();
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const { kosong } = useLocalSearchParams<{ kosong?: string }>();
  const { mode } = useApi();
  const dispatch = useSampleDispatch();
  const toast = (text: string) => dispatch({ type: 'showToast', text });
  const chat = useChat({ onError: toast });
  const [text, setText] = useState('');
  const input = useRef<TextInputInstance>(null);
  const list = useRef<FlatList<Row>>(null);
  // Di dasar utas = offset 0 (daftar terbalik). Keyboard yang muncul menggulir ke dasar hanya bila pengguna memang di sana.
  const nearBottom = useRef(true);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (nearBottom.current) list.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    nearBottom.current = e.nativeEvent.contentOffset.y < NEAR_BOTTOM;
  };

  const late = useLateOffline(chat.connection);
  const banner = bannerText(chat.connection, late);
  const intiOff = banner !== null;

  const send = () => {
    const value = text.trim();
    if (!value) return;
    chat.send(value);
    setText('');
    nearBottom.current = true;
  };

  const composerOff =
    chat.connection === 'blocked'
      ? 'Akun sedang tidak aktif'
      : chat.connection === 'upgrade_required'
        ? 'Perbarui aplikasi untuk lanjut mengobrol'
        : undefined;

  const rows = buildRows(chat, { onlyNew: kosong === '1' });
  const showEmpty = kosong === '1' && rows.length === 0;
  // Daftar terbalik: yang terbaru dulu.
  const data = [...rows].reverse();

  return (
    // Edge-to-edge (SDK 58): jendela tidak lagi mengecil saat keyboard muncul, jadi 'padding' menaikkan kolom ketik setinggi keyboard di Android dan iOS.
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <Inti size={36} state={intiOff ? 'off' : 'idle'} onDark={scheme === 'dark'} paused={!live} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Txt v="subtitle">{assistantName}</Txt>
          <Txt v="caption" color={c.muted}>
            Siap membantu
          </Txt>
        </View>
        <IconButton icon="wave" label="Mode Suara" tinted onPress={() => router.replace('/suara')} />
      </View>
      <ConnectionBanner text={banner} />

      {showEmpty ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Note />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <Inti size={104} state={intiOff ? 'off' : 'idle'} onDark={scheme === 'dark'} paused={!live} />
            <Txt v="title" style={{ textAlign: 'center' }}>
              Mau saya bantu urus apa?
            </Txt>
          </View>
          <View style={{ gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s.text}
                accessibilityRole="button"
                accessibilityLabel={s.text}
                onPress={() => {
                  setText(s.text);
                  input.current?.focus();
                }}
                style={{
                  height: 52,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.card,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Icon name={s.icon} size={22} color={c.green} />
                <Txt>{s.text}</Txt>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={list}
          testID="utas"
          inverted
          data={data}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => (
            <ThreadRow row={item} chat={chat} contoh={mode !== 'server'} toast={toast} paused={!live} />
          )}
          ItemSeparatorComponent={Gap}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          initialNumToRender={30}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={64}
          onScroll={onScroll}
          onEndReached={() => void chat.loadOlder()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <View style={{ gap: 12 }}>
              {chat.loadingOlder && (
                <ActivityIndicator testID="memuat-lama" size="small" color={c.muted} style={{ paddingTop: 8 }} />
              )}
              {chat.loadFailed && !chat.loaded && <LoadFailed onRetry={() => void chat.loadInitial()} />}
              <Note />
            </View>
          }
        />
      )}

      <Composer
        value={text}
        onChangeText={setText}
        onSend={send}
        inputRef={input}
        strongMic={showEmpty}
        disabledText={composerOff}
      />
    </KeyboardAvoidingView>
  );
}

function Gap() {
  return <View style={{ height: 12 }} />;
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Txt color={c.muted} style={{ textAlign: 'center' }}>
        Obrolan belum bisa dimuat.
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muat lagi"
        onPress={onRetry}
        style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}
      >
        <Txt weight={600} color={c.green}>
          Muat lagi
        </Txt>
      </Pressable>
    </View>
  );
}

function Note() {
  const assistantName = useAssistantName();
  const { c } = useTheme();
  return (
    <Txt
      v="caption"
      color={c.muted}
      style={{ alignSelf: 'center', maxWidth: 300, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8 }}
    >
      {assistantName} ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.
    </Txt>
  );
}

function ThreadRow({
  row,
  chat,
  contoh,
  toast,
  paused,
}: {
  row: Row;
  chat: ChatApi;
  contoh: boolean;
  toast: (text: string) => void;
  paused: boolean;
}) {
  if (row.kind === 'thinking') return <Thinking paused={paused} />;
  if (row.kind === 'pending') {
    const { pending } = row;
    return (
      <UserBubble
        text={pending.text}
        startsExchange={row.startsExchange}
        status={pending.status}
        onRetry={() => chat.retry(pending.clientId)}
      />
    );
  }
  const { message, part } = row;
  const content = (
    <PartView
      part={part}
      message={message}
      startsExchange={row.startsExchange}
      chosenId={row.chosenId}
      chat={chat}
      contoh={contoh}
      toast={toast}
    />
  );
  if (!row.tag) return content;
  return (
    <View style={{ gap: 4 }}>
      {content}
      <ViaTag align={message.from === 'user' ? 'right' : 'left'} />
    </View>
  );
}

function PartView({
  part,
  message,
  startsExchange,
  chosenId,
  chat,
  contoh,
  toast,
}: {
  part: Part;
  message: Message;
  startsExchange: boolean;
  chosenId?: string;
  chat: ChatApi;
  contoh: boolean;
  toast: (text: string) => void;
}) {
  switch (part.type) {
    case 'text':
      return message.from === 'user' ? (
        <UserBubble text={part.text} startsExchange={startsExchange} />
      ) : (
        <AssistantLine text={part.text} />
      );
    case 'unknown':
      return <AssistantLine text={part.note} />;
    case 'choices':
      return (
        <ChoicesCard
          prompt={part.prompt}
          choices={part.choices}
          chosenId={chosenId}
          onChoose={(choiceId) => chat.choose(message.id, choiceId)}
        />
      );
    case 'image':
      return <ImageCard image={part} mediaUrl={chat.mediaUrl} />;
    case 'audio':
      return <AudioRow audio={part} onPlay={() => toast('Pemutar suara dibangun di Fase 6.')} />;
    case 'document':
      return (
        <FileCard
          file={{ name: part.name, meta: formatFileMeta(part.sizeBytes, part.mime) }}
          onOpen={() => void openFile(chat, part.mediaId, toast)}
        />
      );
    case 'card': {
      const { card } = part;
      switch (card.kind) {
        case 'draft': {
          const { id } = card.draft;
          return (
            <ConfirmSendCard
              draft={card.draft}
              onSend={() => void chat.draftAction(id, 'send')}
              onCancel={() => void chat.draftAction(id, 'cancel')}
              onEdit={(next) => void chat.draftAction(id, 'edit', next)}
              onDiscard={() => void chat.draftAction(id, 'discard')}
            />
          );
        }
        case 'device':
          if (contoh) return <DeviceCard deviceId={card.deviceId} />;
          return (
            <DeviceCardView
              name={card.name}
              on={card.on}
              temp={card.temp}
              status={card.on ? `Nyala${card.mode ? ` · ${card.mode}` : ''}` : 'Mati'}
              footer={[
                card.temp !== undefined ? `Perintah terakhir: ${card.temp}°${card.mode ? ` ${card.mode}` : ''}` : null,
                card.note ?? null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onToggle={(next) => void chat.controlDevice(card.deviceId, { on: next })}
              onTemp={(temp) => void chat.controlDevice(card.deviceId, { temp })}
            />
          );
        case 'notes':
          return <NotesCard notes={card} />;
        case 'payment':
          return <PaymentCard payment={card} />;
        case 'qris':
          return <QrisCard qris={card} mediaUrl={chat.mediaUrl} />;
      }
    }
  }
}

/** Buka berkas lewat alamat dari server; berkas contoh hanya memberi tahu bahwa ini contoh. */
async function openFile(chat: ChatApi, mediaId: string, toast: (text: string) => void) {
  try {
    const source = await chat.mediaUrl(mediaId);
    if (source.kind !== 'uri') toast('Membuka berkas contoh.');
    else await Linking.openURL(source.uri);
  } catch {
    toast(ERROR_TEXT);
  }
}
