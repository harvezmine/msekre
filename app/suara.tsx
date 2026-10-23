// Niat layar: bicara dengan asisten sambil menahan Inti di bawah jempol, lalu membaca ucapan dan jawabannya dengan tenang.
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantName } from '@/api/useProfile';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { dark, FONT, motion, onVoice } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { IntiOrb } from '@/ui/inti/IntiOrb';
import { PressableScale, useLayoutClass } from '@/ui/kit';
import { Boundary } from '@/ui/Boundary';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';
import { ConfirmArea } from '@/voice/ConfirmArea';
import { PermissionPanel } from '@/voice/PermissionPanel';
import { useVoiceAvailable } from '@/voice/available';
import { HINT_HOLD, type VoicePhase } from '@/voice/controller';
import { demoState, useDemoLevel, voiceDemo } from '@/voice/demo';
import { handoffFrom, restCentre, type Handoff } from '@/voice/handoff';
import { holdBridge } from '@/voice/holdBridge';
import { VOICE_SOON_TEXT } from '@/voice/texts';
import { useVoice } from '@/voice/useVoice';
import { Waves } from '@/voice/Waves';
import { WavesBand } from '@/voice/WavesBand';
import { WAVE_HEIGHT_RATIO, type WaveState } from '@/voice/waveMath';

const WAVE: Record<VoicePhase, WaveState> = {
  idle: 'idle',
  listening: 'listening',
  sending: 'thinking',
  thinking: 'thinking',
  speaking: 'speaking',
  off: 'off',
  error: 'error',
};

/** Kata sementara (belum pasti) dan teks yang sudah lewat: lebih redup dari ucapan yang sedang didengar. */
const PARTIAL = 'rgba(242,243,245,0.42)';
const SETTLED = 'rgba(242,243,245,0.55)';
/** Inti di Mode Suara (§5.1): 88, tepat di bawah jempol. */
const INTI = 88;
/** Bisukan dan Ketik: lingkaran 60 tanpa label. */
const ROUND = 60;
/** Jempol boleh bergeser jauh selagi menahan Inti: ucapan tidak terputus karena jari sedikit bergerak. */
const KEEP_HOLD = { top: 240, bottom: 240, left: 240, right: 240 };
const BREATH = Easing.bezier(0.45, 0, 0.55, 1);
export const THINKING_TEXT = 'Sebentar…';

/** Mode Suara: tahan Inti sambil bicara, lepas untuk mengirim. Teksnya selalu tampil. Belum tersedia: hanya catatan. */
export default function Suara() {
  return (
    <Boundary where="Mode Suara" fallback={(retry) => <SuaraKendala onRetry={retry} />}>
      <SuaraPilih />
    </Boundary>
  );
}

function SuaraPilih() {
  return useVoiceAvailable() ? <SuaraAktif /> : <SuaraSegera />;
}

export const VOICE_TROUBLE_TEXT = 'Mode Suara lagi ada kendala. Coba lagi sebentar ya.';

/**
 * Mode Suara gagal digambar (batas kesalahan di atas): layar tetap terbuka dengan pita cahaya diam, kalimat ramah,
 * "Coba lagi", dan Selesai. Mikrofon tidak menyala dari sini; tahanan Inti yang masih berjalan dilupakan.
 */
function SuaraKendala({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    holdBridge.cancel();
  }, []);
  return (
    <View testID="suara-kendala" style={{ flex: 1, backgroundColor: dark.voiceCanvas }}>
      <StatusBar style="light" />
      <WavesBand state="off" width={width} height={Math.round(height * WAVE_HEIGHT_RATIO)} />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 12) + 18,
          paddingHorizontal: 28,
          justifyContent: 'center',
          gap: 32,
        }}
      >
        <Txt v="title" color={onVoice.strong} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
          {VOICE_TROUBLE_TEXT}
        </Txt>
        <View style={{ gap: 12 }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={onRetry}
            style={{
              alignSelf: 'center',
              minHeight: 56,
              paddingHorizontal: 40,
              borderRadius: 28,
              backgroundColor: dark.brand,
              justifyContent: 'center',
            }}
          >
            <Txt v="subtitle" color={dark.onBrand}>
              Coba lagi
            </Txt>
          </PressableScale>
          <DoneButton />
        </View>
      </View>
    </View>
  );
}

/** Akun yang belum mendapat Mode Suara: tidak membuka sesi atau mikrofon. */
function SuaraSegera() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: dark.voiceCanvas,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 36,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      <StatusBar style="light" />
      <Txt testID="suara-segera" v="title" color={onVoice.strong} style={{ textAlign: 'center' }}>
        {VOICE_SOON_TEXT}
      </Txt>
      <DoneButton />
    </View>
  );
}

function SuaraAktif() {
  const assistantName = useAssistantName();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = useLayoutClass() === 'compact';
  const live = useLive();
  const voice = useVoice();
  // Pratinjau web saja (`?demo=mendengar`); di HP selalu kosong.
  const [demo] = useState(voiceDemo);
  useDemoLevel(demo, voice.level);
  const view = { ...voice, ...demoState(demo) };
  const { phase, typing, muted, transcript, reply, note, confirm } = view;
  // Dibuka dengan menahan Inti (`?hold=1`): jari masih menempel, jadi langsung mendengar; jari diangkat dari Inti yang
  // sama mengirim ucapannya (src/voice/holdBridge.ts).
  const { hold } = useLocalSearchParams<{ hold?: string }>();
  const { holdStart, holdEnd } = voice;
  // Ditahan dari Inti bilah tab: Inti di sini muncul tepat di bawah jari, lalu meluncur ke tempatnya setelah dilepas.
  const [from] = useState(() => (hold === '1' && holdBridge.isHeld() ? holdBridge.origin() : null));
  const [handoff] = useState(() => handoffFrom(from, restCentre(width, height, insets.bottom)));
  useEffect(() => {
    if (hold !== '1' || !holdBridge.isHeld()) return;
    const off = holdBridge.onRelease(() => void holdEnd());
    // Izin diperiksa dulu di pengendali: belum ditanya atau ditolak = lembar izin, mikrofon tidak menyala.
    void holdStart();
    return () => {
      off();
      // Layar ditutup selagi jari masih menempel: tahanan dilupakan tanpa mengirim.
      holdBridge.cancel();
    };
    // Sekali saat layar terbuka: tahanan berikutnya lewat Inti di layar ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Level yang sudah dihaluskan gelombang, dipakai cahaya Inti.
  const glow = useSharedValue(0);
  const busy = phase === 'sending' || phase === 'thinking';
  const listening = phase === 'listening';
  // Belum ada ucapan: petunjuk (atau kabar) tampil redup di tempat ucapan akan muncul.
  const placeholder = !transcript && !reply && !busy && !listening ? (note ?? HINT_HOLD) : null;
  const line = busy ? THINKING_TEXT : transcript || reply ? note : null;
  const status = listening
    ? 'Mendengar'
    : busy
      ? `${assistantName} berpikir`
      : phase === 'speaking'
        ? `${assistantName} menjawab`
        : phase === 'off' || phase === 'error'
          ? 'Belum siap'
          : 'Siap';

  return (
    <View testID="suara" style={{ flex: 1, backgroundColor: dark.voiceCanvas }}>
      <StatusBar style="light" />
      <Waves
        state={WAVE[phase]}
        level={voice.level}
        width={width}
        height={Math.round(height * WAVE_HEIGHT_RATIO)}
        paused={!live}
        muted={muted}
        quiet={typing || confirm !== null}
        glow={glow}
      />
      {/* Edge-to-edge: jendela tidak mengecil saat papan ketik muncul, jadi 'padding' menaikkan isi (kolom ketik dan draf). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          testID="suara-kolom"
          // Lembar izin tampil: isi di belakangnya tidak dibaca TalkBack.
          importantForAccessibility={voice.permission ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={voice.permission !== null}
          style={{ flex: 1, paddingTop: insets.top }}
        >
          <ScrollView
            testID="suara-isi"
            style={{ flex: 1 }}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}
          >
            <LiveDot phase={phase} label={status} paused={!live} />
            <View style={{ marginTop: compact ? 20 : 28, gap: 20 }}>
              {placeholder ? (
                <Txt
                  testID="suara-petunjuk"
                  v="transcript"
                  color={PARTIAL}
                  style={compact ? { fontSize: 28, lineHeight: 38 } : null}
                  maxFontSizeMultiplier={1.3}
                >
                  {placeholder}
                </Txt>
              ) : null}
              {transcript ? (
                <Said
                  text={transcript}
                  final={view.transcriptFinal}
                  listening={listening}
                  small={!!reply}
                  compact={compact}
                />
              ) : null}
              {line ? <StatusLine text={line} pulse={busy} paused={!live} /> : null}
              {reply ? (
                <Animated.View entering={FadeIn.duration(motion.screen.duration)}>
                  <Txt
                    testID="suara-balasan"
                    accessibilityLiveRegion="polite"
                    weight={500}
                    color={onVoice.text}
                    style={{ fontSize: compact ? 24 : 26, lineHeight: compact ? 32 : 34, letterSpacing: -0.26 }}
                    maxFontSizeMultiplier={1.3}
                  >
                    {reply}
                  </Txt>
                </Animated.View>
              ) : null}
            </View>
            {/* Kartu konfirmasi menempel tepat di atas kontrol, di zona jempol. */}
            <View style={{ flexGrow: 1, minHeight: 16 }} />
            {confirm ? (
              <ThemeProvider scheme="dark">
                <ConfirmArea card={confirm.card} messageId={confirm.messageId} />
              </ThemeProvider>
            ) : null}
          </ScrollView>
          <View
            testID="suara-kontrol"
            style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 18, gap: 16 }}
          >
            {typing ? <TypeBar onSend={(text) => voice.sendText(text)} /> : null}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: compact ? 32 : 44 }}
            >
              <RoundAction
                icon={muted ? 'speakerOff' : 'speaker'}
                label={muted ? 'Suarakan' : 'Bisukan'}
                selected={muted}
                onPress={() => voice.setMuted(!muted)}
              />
              <HoldInti
                phase={phase}
                paused={!live}
                glow={glow}
                handoff={handoff}
                onPressIn={() => void voice.holdStart()}
                onPressOut={() => void voice.holdEnd()}
              />
              <RoundAction icon="keyboard" label="Ketik" selected={typing} onPress={() => voice.setTyping(!typing)} />
            </View>
            <DoneButton />
          </View>
        </View>
      </KeyboardAvoidingView>
      {voice.permission ? (
        <PermissionPanel
          blocked={voice.permission !== 'explain'}
          waiting={voice.permission === 'waiting'}
          bottom={insets.bottom}
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

/**
 * Titik hijau kecil di kiri atas: Mode Suara hidup. Berdenyut 1,6 detik saat mendengar, 2,6 detik selain itu; kelabu dan
 * diam bila belum tersambung. Pembaca layar mendapat keadaannya ("Mendengar", "Nadia berpikir") sebagai area langsung.
 */
function LiveDot({ phase, label, paused }: { phase: VoicePhase; label: string; paused: boolean }) {
  const reduce = useReducedMotion();
  const off = phase === 'off' || phase === 'error';
  const period = phase === 'listening' ? 1600 : 2600;
  const t = useSharedValue(1);
  useEffect(() => {
    if (off || reduce || paused) {
      cancelAnimation(t);
      t.set(1);
      return;
    }
    t.set(1);
    t.set(withRepeat(withTiming(0.4, { duration: period / 2, easing: BREATH }), -1, true));
    return () => cancelAnimation(t);
  }, [off, reduce, paused, period, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.get() }));
  return (
    <View
      testID="suara-titik"
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{ width: 20, height: 20, marginLeft: -3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: off ? onVoice.hint : dark.brand,
            boxShadow: off ? undefined : '0 0 0 5px rgba(91,191,134,0.18)',
          },
          style,
        ]}
      />
    </View>
  );
}

/** Ucapan pengguna. Saat mendengar: besar dan terang, kata terakhir yang belum pasti lebih redup. */
function Said({
  text,
  final,
  listening,
  small,
  compact,
}: {
  text: string;
  final: boolean;
  listening: boolean;
  /** Balasan sudah tampil: ucapan mengecil dan meredup, balasan yang utama. */
  small: boolean;
  compact: boolean;
}) {
  if (small) {
    return (
      <Txt
        testID="suara-ucapan"
        weight={500}
        color={SETTLED}
        style={{ fontSize: 20, lineHeight: 28 }}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Txt>
    );
  }
  const partial = listening && !final;
  const cut = partial ? text.trimEnd().lastIndexOf(' ') : -1;
  const sure = partial ? text.slice(0, cut + 1) : text;
  const unsure = partial ? text.slice(cut + 1) : '';
  return (
    <Txt
      testID="suara-ucapan"
      v="transcript"
      color={listening ? onVoice.text : SETTLED}
      style={compact ? { fontSize: 28, lineHeight: 38 } : null}
      maxFontSizeMultiplier={1.3}
    >
      {sure}
      {unsure ? <Text style={{ color: PARTIAL }}>{unsure}</Text> : null}
    </Txt>
  );
}

/** Satu baris di bawah ucapan: "Sebentar…" yang berdenyut pelan saat berpikir, atau kabar singkat. */
function StatusLine({ text, pulse, paused }: { text: string; pulse: boolean; paused: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(1);
  useEffect(() => {
    if (!pulse || reduce || paused) {
      cancelAnimation(t);
      t.set(1);
      return;
    }
    t.set(0.5);
    t.set(withRepeat(withTiming(1, { duration: 900, easing: BREATH }), -1, true));
    return () => cancelAnimation(t);
  }, [pulse, reduce, paused, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.get() }));
  return (
    <Animated.View style={style}>
      <Txt
        testID="suara-catatan"
        weight={500}
        color={pulse ? onVoice.text : onVoice.soft}
        style={{ fontSize: 20, lineHeight: 28 }}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Txt>
    </Animated.View>
  );
}

/**
 * Inti 88 sebagai tempat menahan: tekan dan tahan untuk bicara, lepas untuk mengirim. Membesar sedikit selagi mendengar,
 * cahayanya mengikuti keras-pelannya suara, cincin berputar saat berpikir, redup bila belum tersambung.
 */
function HoldInti({
  phase,
  paused,
  glow,
  handoff,
  onPressIn,
  onPressOut,
}: {
  phase: VoicePhase;
  paused: boolean;
  glow: SharedValue<number>;
  /** Dibuka dengan menahan Inti bilah tab: mulai di bawah jari, lalu meluncur ke sini setelah jari diangkat. */
  handoff?: Handoff | null;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const reduce = useReducedMotion();
  const listening = phase === 'listening';
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(reduce ? 1 : withSpring(listening ? 1.06 : 1, motion.press.spring));
  }, [listening, reduce, s]);
  // Geser awal dari bawah jari; kembali ke tempatnya begitu tidak lagi mendengar (jari diangkat).
  const dx = useSharedValue(reduce ? 0 : (handoff?.dx ?? 0));
  const dy = useSharedValue(reduce ? 0 : (handoff?.dy ?? 0));
  const k = useSharedValue(reduce ? 1 : (handoff?.scale ?? 1));
  const settled = useRef(!handoff || reduce);
  useEffect(() => {
    if (settled.current) return;
    // Selagi ditahan Inti tumbuh di bawah jari; setelah dilepas meluncur ke tempatnya.
    k.set(withTiming(1, { duration: motion.screen.duration, easing: Easing.out(Easing.cubic) }));
    if (listening) return;
    dx.set(withSpring(0, motion.press.spring));
    dy.set(withSpring(0, motion.press.spring));
    settled.current = true;
  }, [listening, dx, dy, k]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: s.get() * k.get() }],
  }));
  return (
    <Pressable
      testID="suara-inti"
      accessibilityRole="button"
      accessibilityLabel="Tahan untuk bicara"
      accessibilityHint="Tahan sambil bicara, lepas untuk mengirim"
      accessibilityState={{ busy: listening }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      pressRetentionOffset={KEEP_HOLD}
      hitSlop={8}
      style={{ width: INTI, height: INTI, borderRadius: INTI / 2 }}
    >
      <Animated.View style={style}>
        <IntiOrb
          size={INTI}
          paused={paused}
          thinking={phase === 'sending' || phase === 'thinking'}
          dim={phase === 'off'}
          level={glow}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Bisukan dan Ketik: ikon saja (§2.6). Menyala = hijau lembut dengan cincin hijau. */
function RoundAction({
  icon,
  label,
  onPress,
  selected = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      haptic="selection"
      scaleTo={motion.press.keyScale}
      onPress={onPress}
      style={{
        width: ROUND,
        height: ROUND,
        borderRadius: ROUND / 2,
        backgroundColor: selected ? dark.brandSoft : onVoice.button,
        boxShadow: selected ? `inset 0 0 0 2px ${dark.brand}` : 'inset 0 1px 0 rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={26} color={selected ? dark.brandInk : onVoice.text} />
    </PressableScale>
  );
}

function DoneButton() {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Selesai"
      onPress={() => router.back()}
      style={{
        alignSelf: 'center',
        minHeight: 56,
        paddingHorizontal: 40,
        borderRadius: 28,
        backgroundColor: onVoice.strong,
        justifyContent: 'center',
      }}
    >
      <Txt v="subtitle" color={onVoice.onStrong}>
        Selesai
      </Txt>
    </PressableScale>
  );
}

/** Pindah ke ketik di dalam Mode Suara: kalimatnya dijawab seperti ucapan. */
function TypeBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;
  const send = () => {
    if (!ready) return;
    onSend(text);
    setText('');
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextInput
        accessibilityLabel="Ketik pesan"
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        returnKeyType="send"
        placeholder="Ketik di sini"
        placeholderTextColor={onVoice.hint}
        cursorColor={dark.brand}
        selectionColor={dark.brandGlow}
        style={{
          flex: 1,
          minHeight: 56,
          borderRadius: 28,
          backgroundColor: onVoice.button,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          paddingHorizontal: 20,
          fontFamily: FONT[400],
          fontSize: 16,
          color: onVoice.text,
        }}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Kirim"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        haptic="success"
        onPress={send}
        style={{
          minHeight: 56,
          paddingHorizontal: 22,
          borderRadius: 28,
          backgroundColor: dark.brand,
          opacity: ready ? 1 : 0.45,
          justifyContent: 'center',
        }}
      >
        <Txt weight={600} color={dark.onBrand}>
          Kirim
        </Txt>
      </PressableScale>
    </View>
  );
}
