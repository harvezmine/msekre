import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { presentCard } from '@/api/devices';
import { formatFileMeta } from '@/api/format';
import { setChatFocused } from '@/api/pushPresence';
import { useAssistantName } from '@/api/useProfile';
import type { ChatState } from '@/api/chatState';
import type { Message, Part } from '@/api/contract';
import { useChat, type ChatActions } from '@/api/useChat';
import { useTheme } from '@/theme/ThemeProvider';
import { AssistantLine, UserBubble, ViaTag } from '@/ui/chat/Bubble';
import { AudioRow } from '@/ui/chat/AudioRow';
import { ChoicesCard } from '@/ui/chat/ChoicesCard';
import { Composer } from '@/ui/chat/Composer';
import { bannerText, ConnectionBanner, useLateOffline } from '@/ui/chat/ConnectionBanner';
import { ConfirmSendCard } from '@/ui/chat/ConfirmSendCard';
import { DeviceCardView } from '@/ui/chat/DeviceCard';
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
import { useToast } from '@/ui/toastStore';
import { useOpenVoice } from '@/voice/available';

/** Jarak (dp) dari dasar utas yang masih dianggap "di dasar". */
const NEAR_BOTTOM = 80;
/** Lama sesudah chat dibuka (atau draf ketemu) kartu draf boleh digulir otomatis. */
export const DRAFT_SCROLL_WINDOW_MS = 3000;
export const DRAFT_MISSING_TEXT = 'Drafnya tidak ketemu, mungkin sudah dikirim atau dibuang.';

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
  const { kosong, draf, pesan } = useLocalSearchParams<{ kosong?: string; draf?: string; pesan?: string }>();
  const toast = useToast();
  const openSuara = useOpenVoice();
  const chat = useChat({
    onError: toast,
    onPinRequired: (id) => router.push({ pathname: '/pin', params: { id } }),
  });
  // Selagi chat terbuka, notifikasi diredam (api/usePush.ts).
  const focused = useIsFocused();
  useEffect(() => {
    setChatFocused(focused);
    return () => setChatFocused(false);
  }, [focused]);
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
  const status = headerStatus(chat.connection);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    chat.send(value);
    setText('');
    // Mengirim saat sedang menggulir ke pesan lama: kembali ke dasar, supaya gelembung sendiri dan jawabannya terlihat.
    nearBottom.current = true;
    list.current?.scrollToOffset({ offset: 0, animated: true });
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
  // `?draf=<id>` ("Lihat draf" di Usaha, `&pesan=<id pesan>` bila diketahui): pesan yang memuat kartu draf itu dicari
  // (dimuat bila belum ada: resync, lalu halaman lama paling banyak 5), lalu digulir ke sana sekali. Tidak ketemu: toast.
  // Menggulir otomatis hanya dalam ~3 detik sejak chat dibuka atau drafnya ketemu, supaya tidak menyentak pengguna yang
  // sudah membaca ke tempat lain.
  const scrolledToDraft = useRef<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const scrollUntil = useRef(openedAt + DRAFT_SCROLL_WINDOW_MS);
  const draftId = typeof draf === 'string' ? draf : undefined;
  const draftMessage = typeof pesan === 'string' ? pesan : undefined;
  const ensureDraft = chat.actions.ensureDraft;
  useEffect(() => {
    if (!draftId) return;
    let stale = false;
    void ensureDraft(draftId, draftMessage).then((found) => {
      if (stale) return;
      if (found) scrollUntil.current = Date.now() + DRAFT_SCROLL_WINDOW_MS;
      else toast(DRAFT_MISSING_TEXT);
    });
    return () => {
      stale = true;
    };
    // `toast` berganti tiap render; cukup sekali per draf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draftMessage, ensureDraft]);
  useEffect(() => {
    if (!draf || scrolledToDraft.current === draf || Date.now() > scrollUntil.current) return;
    const index = data.findIndex(
      (r) =>
        r.kind === 'part' && r.part.type === 'card' && r.part.card.kind === 'draft' && r.part.card.draft.id === draf,
    );
    if (index < 0) return;
    scrolledToDraft.current = draf;
    try {
      list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    } catch {
      // Baris belum terukur: onScrollToIndexFailed menggulir mendekati.
    }
  }, [draf, data]);

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
          {status !== null && (
            <Txt v="caption" color={c.muted}>
              {status}
            </Txt>
          )}
        </View>
        <IconButton icon="wave" label="Mode Suara" tinted onPress={() => openSuara('replace')} />
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
            <ThreadRow row={item} actions={chat.actions} busyDrafts={chat.busyDrafts} toast={toast} paused={!live} />
          )}
          ItemSeparatorComponent={Gap}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          initialNumToRender={30}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // Pesan baru di dasar tidak menggeser tampilan saat pengguna membaca yang lama; di dasar, tetap mengikuti.
          maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: NEAR_BOTTOM }}
          scrollEventThrottle={64}
          onScrollToIndexFailed={(info) =>
            list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
          }
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
        onAttach={() => toast(SOON.attach)}
      />
    </KeyboardAvoidingView>
  );
}

/** Teks untuk yang belum ada. */
const SOON = {
  attach: 'Lampiran segera hadir.',
  audio: 'Pemutar suara segera hadir.',
  notes: 'Notulen lengkap segera hadir.',
};

/** Keterangan di bawah nama asisten. Akun diblokir atau aplikasi perlu diperbarui: tanpa keterangan (banner yang bicara). */
function headerStatus(connection: ChatState['connection']): string | null {
  switch (connection) {
    case 'open':
      return 'Siap membantu';
    case 'connecting':
    case 'closed':
      return 'Menyambung lagi…';
    default:
      return null;
  }
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

interface ThreadRowProps {
  row: Row;
  actions: ChatActions;
  busyDrafts: ReadonlySet<string>;
  toast: (text: string) => void;
  paused: boolean;
}

/** Baris yang isinya sama tidak digambar ulang: `buildRows` membuat objek baris baru tiap perubahan keadaan. */
function sameRow(a: ThreadRowProps, b: ThreadRowProps): boolean {
  if (a.actions !== b.actions || a.busyDrafts !== b.busyDrafts || a.toast !== b.toast || a.paused !== b.paused)
    return false;
  const x = a.row;
  const y = b.row;
  if (x.kind === 'thinking' || y.kind === 'thinking') return x.kind === y.kind;
  if (x.kind === 'pending' || y.kind === 'pending') {
    return (
      x.kind === 'pending' && y.kind === 'pending' && x.pending === y.pending && x.startsExchange === y.startsExchange
    );
  }
  return (
    x.message === y.message &&
    x.part === y.part &&
    x.chosenId === y.chosenId &&
    x.tag === y.tag &&
    x.startsExchange === y.startsExchange
  );
}

const ThreadRow = memo(function ThreadRow({ row, actions, busyDrafts, toast, paused }: ThreadRowProps) {
  if (row.kind === 'thinking') return <Thinking paused={paused} />;
  if (row.kind === 'pending') {
    const { pending } = row;
    return (
      <UserBubble
        text={pending.text}
        startsExchange={row.startsExchange}
        status={pending.status}
        onRetry={() => actions.retry(pending.clientId)}
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
      actions={actions}
      busyDrafts={busyDrafts}
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
}, sameRow);

function PartView({
  part,
  message,
  startsExchange,
  chosenId,
  actions,
  busyDrafts,
  toast,
}: {
  part: Part;
  message: Message;
  startsExchange: boolean;
  chosenId?: string;
  actions: ChatActions;
  busyDrafts: ReadonlySet<string>;
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
          onChoose={(choiceId) => actions.choose(message.id, choiceId)}
        />
      );
    case 'image':
      return <ImageCard image={part} mediaUrl={actions.mediaUrl} />;
    case 'audio':
      return <AudioRow audio={part} onPlay={() => toast(SOON.audio)} />;
    case 'document':
      return (
        <FileCard
          file={{
            mediaId: part.mediaId,
            name: part.name,
            mime: part.mime,
            meta: formatFileMeta(part.sizeBytes, part.mime),
            size: part.sizeBytes,
          }}
          mediaUrl={actions.mediaUrl}
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
              busy={busyDrafts.has(id)}
              onSend={() => void actions.draftAction(id, 'send')}
              onCancel={() => void actions.draftAction(id, 'cancel')}
              onEdit={(next) => void actions.draftAction(id, 'edit', next)}
              onDiscard={() => void actions.draftAction(id, 'discard')}
            />
          );
        }
        case 'device': {
          const view = presentCard(card);
          return (
            <DeviceCardView
              name={card.name}
              on={card.on}
              kind={view.kind}
              temp={view.isAc ? card.temp : undefined}
              status={view.status}
              switchable={view.switchable}
              guarded={view.sensitive}
              footer={[
                view.isAc && card.temp !== undefined
                  ? `Perintah terakhir: ${card.temp}°${card.mode ? ` ${card.mode}` : ''}`
                  : null,
                card.note ?? null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onToggle={(next) => void actions.controlDevice(card.deviceId, { on: next })}
              onTemp={(temp) => void actions.controlDevice(card.deviceId, { temp })}
              // Perangkat yang dijaga dikendalikan dari Perangkat (PIN atau tanya dulu di sana), bukan dari chat.
              onOpen={() => router.navigate('/perangkat')}
            />
          );
        }
        case 'notes':
          return <NotesCard notes={card} onOpen={() => toast(SOON.notes)} />;
        case 'payment':
          return <PaymentCard payment={card} />;
        case 'qris':
          return <QrisCard qris={card} mediaUrl={actions.mediaUrl} />;
      }
    }
  }
}
