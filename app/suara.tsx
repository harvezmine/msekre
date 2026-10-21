import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { onForest, FONT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';
import { ConfirmArea } from '@/voice/ConfirmArea';
import { useVoiceAvailable } from '@/voice/available';
import { HINT_HOLD, type VoicePhase } from '@/voice/controller';
import { VOICE_SOON_TEXT } from '@/voice/texts';
import { useVoice } from '@/voice/useVoice';

const INTI: Record<VoicePhase, IntiState> = {
  idle: 'idle',
  listening: 'listen',
  sending: 'think',
  thinking: 'think',
  speaking: 'speak',
  off: 'off',
  error: 'off',
};

/** Mode Suara: tahan Inti sambil bicara, lepas untuk mengirim. Teksnya selalu tampil. Belum tersedia: hanya catatan. */
export default function Suara() {
  return useVoiceAvailable() ? <SuaraAktif /> : <SuaraSegera />;
}

/** Akun yang belum mendapat Mode Suara: tidak membuka sesi atau mikrofon. */
function SuaraSegera() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.voice,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 36,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      <StatusBar style="light" />
      <Txt testID="suara-segera" v="title" color={onForest.strong} style={{ textAlign: 'center' }}>
        {VOICE_SOON_TEXT}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Selesai"
        onPress={() => router.back()}
        style={{
          height: 56,
          paddingHorizontal: 40,
          borderRadius: 28,
          backgroundColor: onForest.strong,
          justifyContent: 'center',
        }}
      >
        <Txt v="subtitle" color="#0E3A2C">
          Selesai
        </Txt>
      </Pressable>
    </View>
  );
}

function SuaraAktif() {
  const assistantName = useAssistantName();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const voice = useVoice();
  const { phase, typing, muted } = voice;
  const label =
    phase === 'listening'
      ? 'Mendengar'
      : phase === 'sending' || phase === 'thinking'
        ? `${assistantName} berpikir`
        : phase === 'speaking'
          ? assistantName
          : (voice.note ?? HINT_HOLD);
  return (
    <View style={{ flex: 1, backgroundColor: c.voice }}>
      <StatusBar style="light" />
      {/* Edge-to-edge: jendela tidak mengecil saat papan ketik muncul, jadi 'padding' menaikkan isi (kolom ketik dan draf). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          // Lembar izin tampil: isi di belakangnya tidak dibaca TalkBack.
          importantForAccessibility={voice.permission ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={voice.permission !== null}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 36,
          }}
        >
          <View style={{ paddingHorizontal: 28, gap: 8, minHeight: 72 }}>
            {voice.transcript ? (
              <>
                <Txt v="caption" color={onForest.soft}>
                  Anda
                </Txt>
                <Txt
                  testID="suara-ucapan"
                  weight={500}
                  color={voice.transcriptFinal ? onForest.text : onForest.hint}
                  style={{ fontSize: 20, lineHeight: 28 }}
                  maxFontSizeMultiplier={1.4}
                >
                  {voice.transcript}
                </Txt>
              </>
            ) : null}
          </View>
          <View
            style={{
              flex: 1,
              minHeight: 240,
              maxHeight: 340,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tahan untuk bicara"
              accessibilityHint="Tahan sambil bicara, lepas untuk mengirim"
              accessibilityState={{ busy: phase === 'listening' }}
              onPressIn={() => void voice.holdStart()}
              onPressOut={() => void voice.holdEnd()}
            >
              <Inti size={200} state={INTI[phase]} onDark paused={!live} level={voice.level} />
            </Pressable>
            <Txt
              v="caption"
              color={onForest.soft}
              accessibilityLiveRegion="polite"
              style={{ marginTop: 12, paddingHorizontal: 28, textAlign: 'center' }}
            >
              {label}
            </Txt>
          </View>
          <View style={{ paddingHorizontal: 28, gap: 8, minHeight: 72 }}>
            {voice.reply ? (
              <>
                <Txt v="caption" color={onForest.soft}>
                  {assistantName}
                </Txt>
                <Txt
                  testID="suara-balasan"
                  accessibilityLiveRegion="polite"
                  weight={600}
                  color={onForest.strong}
                  style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.26 }}
                  maxFontSizeMultiplier={1.4}
                >
                  {voice.reply}
                </Txt>
              </>
            ) : null}
          </View>
          {voice.confirm ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <ConfirmArea card={voice.confirm.card} messageId={voice.confirm.messageId} />
            </View>
          ) : null}
          {typing ? <TypeBar onSend={(text) => voice.sendText(text)} /> : null}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, flexDirection: 'row', alignItems: 'flex-start' }}>
            <RoundAction
              icon={muted ? 'speakerOff' : 'speaker'}
              label={muted ? 'Suarakan' : 'Bisukan'}
              pressed={muted}
              onPress={() => voice.setMuted(!muted)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selesai"
              onPress={() => router.back()}
              style={{
                height: 56,
                paddingHorizontal: 40,
                borderRadius: 28,
                backgroundColor: onForest.strong,
                justifyContent: 'center',
              }}
            >
              {/* warna forest di atas tombol terang, sama di dua mode */}
              <Txt v="subtitle" color="#0E3A2C">
                Selesai
              </Txt>
            </Pressable>
            <RoundAction icon="keyboard" label="Ketik" pressed={typing} onPress={() => voice.setTyping(!typing)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {voice.permission ? (
        <PermissionPanel
          blocked={voice.permission !== 'explain'}
          waiting={voice.permission === 'waiting'}
          bottom={insets.bottom}
          background={c.voice}
          onAllow={() => void voice.requestPermission()}
          onSettings={() => {
            void Linking.openSettings().catch(() => {});
            // Lembar tetap ada; saat pengguna kembali izinnya dicek lagi.
            voice.waitForSettings();
          }}
          onClose={voice.closePermission}
        />
      ) : null}
    </View>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
  pressed = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  pressed?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: pressed }}
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: onForest.buttonLine,
          backgroundColor: pressed ? onForest.buttonLine : onForest.button,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={24} color={onForest.text} />
      </Pressable>
      <Txt v="caption" color={onForest.label} style={{ textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}

/** Pindah ke ketik di dalam Mode Suara: kalimatnya dijawab seperti ucapan. */
function TypeBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextInput
        accessibilityLabel="Ketik pesan"
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        returnKeyType="send"
        placeholder="Ketik di sini"
        placeholderTextColor={onForest.hint}
        cursorColor={onForest.text}
        selectionColor={onForest.soft}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: onForest.buttonLine,
          backgroundColor: onForest.button,
          paddingHorizontal: 20,
          fontFamily: FONT[400],
          fontSize: 16,
          color: onForest.text,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kirim"
        accessibilityState={{ disabled: !text.trim() }}
        disabled={!text.trim()}
        onPress={send}
        style={{
          height: 52,
          paddingHorizontal: 20,
          borderRadius: 26,
          backgroundColor: onForest.strong,
          opacity: text.trim() ? 1 : 0.5,
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color="#0E3A2C">
          Kirim
        </Txt>
      </Pressable>
    </View>
  );
}

/** Lembar izin mikrofon: penjelasan ramah dulu, lalu pengaturan HP kalau sudah ditolak. */
function PermissionPanel({
  blocked,
  waiting,
  bottom,
  background,
  onAllow,
  onSettings,
  onClose,
}: {
  blocked: boolean;
  waiting: boolean;
  bottom: number;
  background: string;
  onAllow: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <View
      testID="suara-izin"
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: bottom + 24,
        gap: 8,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        backgroundColor: background,
        borderTopWidth: 1,
        borderColor: onForest.buttonLine,
      }}
    >
      <Txt v="title" color={onForest.strong}>
        {waiting ? 'Menunggu mikrofon dinyalakan' : blocked ? 'Mikrofon sedang dimatikan' : 'Izinkan mikrofon ya'}
      </Txt>
      <Txt color={onForest.text}>
        {waiting
          ? 'Nyalakan mikrofon di pengaturan HP, lalu kembali ke sini.'
          : blocked
            ? 'Nyalakan lewat pengaturan HP supaya saya bisa mendengar Anda.'
            : 'Saya perlu mikrofon untuk mendengar Anda bicara. Suaranya hanya dipakai saat Inti ditahan.'}
      </Txt>
      <View style={{ gap: 8, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={blocked ? 'Buka pengaturan' : 'Izinkan'}
          onPress={blocked ? onSettings : onAllow}
          style={{
            height: 56,
            borderRadius: 28,
            backgroundColor: onForest.strong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={600} color="#0E3A2C" style={{ fontSize: 17 }}>
            {blocked ? 'Buka pengaturan' : 'Izinkan'}
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nanti saja"
          onPress={onClose}
          style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={600} color={onForest.label}>
            Nanti saja
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
