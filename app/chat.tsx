import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { THINK_MS, typedReply } from '@/sample/chat';
import { useSample, type ChatEntry } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { AssistantLine, UserBubble } from '@/ui/chat/Bubble';
import { Composer } from '@/ui/chat/Composer';
import { ConfirmSendCard } from '@/ui/chat/ConfirmSendCard';
import { DeviceCard } from '@/ui/chat/DeviceCard';
import { FileCard } from '@/ui/chat/FileCard';
import { NotesCard } from '@/ui/chat/NotesCard';
import { QrisCard } from '@/ui/chat/QrisCard';
import { Thinking } from '@/ui/chat/Thinking';
import { TokenCard } from '@/ui/chat/TokenCard';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

const SUGGESTIONS: { icon: IconName; text: string }[] = [
  { icon: 'mail', text: 'Ringkas email hari ini' },
  { icon: 'bulb', text: 'Matikan semua lampu' },
  { icon: 'store', text: 'Cek stok kedai' },
  { icon: 'bolt', text: 'Beli token listrik' },
];

// Fase 0b: utas dari penyimpanan contoh; pesan yang diketik hanya dijawab dengan jawaban contoh. Jawaban sungguhan dibangun di Fase 1.
export default function Chat() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const { kosong } = useLocalSearchParams<{ kosong?: string }>();
  const { state, dispatch } = useSample();
  const [text, setText] = useState('');
  // Baris yang sudah ada saat layar dibuka. `?kosong=1` hanya menampilkan baris yang datang sesudahnya.
  const [shownAtOpen] = useState(() => new Set(state.chat.map((e) => e.id)));
  const [waitingFor, setWaitingFor] = useState<number | null>(null);
  const seq = useRef(0);
  const input = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  // Jawaban contoh muncul 1,2 detik setelah pesan terakhir; mengirim lagi sebelum itu membatalkan yang lama.
  useEffect(() => {
    if (waitingFor === null) return;
    const id = setTimeout(() => {
      dispatch({ type: 'addChatMessage', from: 'assistant', text: typedReply });
      setWaitingFor(null);
    }, THINK_MS);
    return () => clearTimeout(id);
  }, [waitingFor, dispatch]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    seq.current += 1;
    dispatch({ type: 'addChatMessage', from: 'user', text: value });
    setText('');
    setWaitingFor(seq.current);
  };

  const fresh = state.chat.filter((e) => !shownAtOpen.has(e.id));
  const entries = kosong === '1' ? fresh : state.chat;
  const showEmpty = kosong === '1' && fresh.length === 0;
  const thread: ChatEntry[] = waitingFor !== null ? [...entries, { id: 'berpikir', kind: 'thinking' }] : entries;

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
        <Inti size={36} onDark={scheme === 'dark'} paused={!live} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Txt v="subtitle">{DEFAULT_ASSISTANT}</Txt>
          <Txt v="caption" color={c.muted}>
            Siap membantu
          </Txt>
        </View>
        <IconButton icon="wave" label="Mode Suara" tinted onPress={() => router.replace('/suara')} />
      </View>

      {showEmpty ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Note />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <Inti size={104} onDark={scheme === 'dark'} paused={!live} />
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
        <ScrollView
          ref={scroll}
          testID="utas"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: fresh.length > 0 })}
        >
          <Note />
          {thread.map((item) => (
            <ThreadRow key={item.id} item={item} paused={!live} />
          ))}
        </ScrollView>
      )}

      <Composer value={text} onChangeText={setText} onSend={send} inputRef={input} />
    </KeyboardAvoidingView>
  );
}

function Note() {
  const { c } = useTheme();
  return (
    <Txt
      v="caption"
      color={c.muted}
      style={{ alignSelf: 'center', maxWidth: 300, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8 }}
    >
      {DEFAULT_ASSISTANT} ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.
    </Txt>
  );
}

function ThreadRow({ item, paused }: { item: ChatEntry; paused: boolean }) {
  switch (item.kind) {
    case 'user':
      return <UserBubble text={item.text} />;
    case 'assistant':
      return <AssistantLine text={item.text} />;
    case 'device':
      return <DeviceCard deviceId={item.deviceId} />;
    case 'confirm':
      return <ConfirmSendCard outgoingId={item.outgoingId} />;
    case 'notes':
      return <NotesCard notes={item} />;
    case 'file':
      return <FileCard file={item} />;
    case 'token':
      return <TokenCard token={item} />;
    case 'qris':
      return <QrisCard qris={item} />;
    case 'thinking':
      return <Thinking paused={paused} />;
  }
}
