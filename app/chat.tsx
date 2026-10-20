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
import { sampleThread, THINK_MS, typedReply, type ThreadItem } from '@/sample/chat';
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

// Fase 0b: utas contoh dan kartunya; pesan yang diketik hanya dijawab dengan jawaban contoh. Jawaban sungguhan dibangun di Fase 1.
export default function Chat() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const { kosong } = useLocalSearchParams<{ kosong?: string }>();
  const [text, setText] = useState('');
  const [typed, setTyped] = useState<ThreadItem[]>([]);
  const [waitingFor, setWaitingFor] = useState<number | null>(null);
  const seq = useRef(0);
  const input = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  // Jawaban contoh muncul 1,2 detik setelah pesan terakhir; mengirim lagi sebelum itu membatalkan yang lama.
  useEffect(() => {
    if (waitingFor === null) return;
    const id = setTimeout(() => {
      setTyped((t) => [...t, { id: `j${waitingFor}`, kind: 'assistant', text: typedReply }]);
      setWaitingFor(null);
    }, THINK_MS);
    return () => clearTimeout(id);
  }, [waitingFor]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    seq.current += 1;
    setTyped((t) => [...t, { id: `u${seq.current}`, kind: 'user', text: value }]);
    setText('');
    setWaitingFor(seq.current);
  };

  const showEmpty = kosong === '1' && typed.length === 0;
  // Tanda berpikir contoh di ujung utas hilang setelah pengguna mengetik sendiri.
  const base = kosong === '1' ? [] : sampleThread.filter((i) => i.kind !== 'thinking' || typed.length === 0);
  const thread = [...base, ...typed, ...(waitingFor !== null ? [{ id: 'berpikir', kind: 'thinking' as const }] : [])];

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
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: typed.length > 0 })}
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

function ThreadRow({ item, paused }: { item: ThreadItem; paused: boolean }) {
  switch (item.kind) {
    case 'user':
      return <UserBubble text={item.text} />;
    case 'assistant':
      return <AssistantLine text={item.text} />;
    case 'device':
      return <DeviceCard />;
    case 'confirm':
      return <ConfirmSendCard />;
    case 'notes':
      return <NotesCard />;
    case 'file':
      return <FileCard />;
    case 'token':
      return <TokenCard />;
    case 'qris':
      return <QrisCard />;
    case 'thinking':
      return <Thinking paused={paused} />;
  }
}
