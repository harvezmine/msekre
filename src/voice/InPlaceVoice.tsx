import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ViewInstance,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readSecure, writeSecure } from '@/api/secureStore';
import { reportError } from '@/crash';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import type { HeroVoice } from '@/ui/beranda/IntiHero';
import { Icon } from '@/ui/Icon';
import { haptic } from '@/ui/kit/haptics';
import { PressableScale } from '@/ui/kit/PressableScale';
import { Txt } from '@/ui/Txt';
import { ConfirmArea } from './ConfirmArea';
import type { VoicePhase } from './controller';
import { inPlace, useInPlace, type InPlaceSession } from './inPlace';
import { PermissionPanel } from './PermissionPanel';
import { RADIAL_HIDDEN, RADIAL_LISTENING, RADIAL_REST, RADIAL_SPEAKING, RADIAL_THINKING } from './radialMath';
import { LISTENING_TEXT, STILL_WORKING_TEXT } from './texts';
import { useVoice, type Voice } from './useVoice';

/** "Lepas untuk kirim" tampil selama tahanan pertama sebanyak ini (seumur pemasangan). */
const RELEASE_HINT_USES = 3;
const HINT_KEY = 'suara.ditempat.petunjuk';
/** Hanya kabar (tanpa balasan): lapisan menutup sendiri sesudah dibaca. */
const NOTE_CLOSE_MS = 4000;
/** Jarak teks ucapan dan kartu balasan dari tepi Inti. */
const GAP = 24;
/** Bilah tab di bawah Beranda (kartu balasan tidak masuk ke bawahnya). */
const TAB_BAR_ROOM = 96;

export const RELEASE_HINT_TEXT = 'Lepas untuk kirim';
export const SLIDE_HINT_TEXT = 'Geser untuk batal';
export const ARMED_HINT_TEXT = 'Lepas untuk batal';
export const OPEN_CHAT_TEXT = 'Buka percakapan';

const MODE: Record<VoicePhase, number> = {
  idle: RADIAL_REST,
  listening: RADIAL_LISTENING,
  sending: RADIAL_THINKING,
  thinking: RADIAL_THINKING,
  speaking: RADIAL_SPEAKING,
  off: RADIAL_HIDDEN,
  error: RADIAL_HIDDEN,
};

let hintUses: number | null = null;

/** Untuk tes: hitungan petunjuk dibaca ulang dari penyimpanan. */
export function resetInPlaceHint() {
  hintUses = null;
}

/**
 * Mode Suara di tempat untuk Beranda: nilai bersama yang menggerakkan Inti besar (`hero`, untuk `IntiHero`), redup
 * untuk isi Beranda lainnya (`dim`, 0..1), dan lapisan suaranya (`overlay`, dipasang hanya selama terbuka, jadi
 * mikrofon dan soket suara tidak terbuka hanya karena Beranda dilihat).
 */
export function useInPlaceVoice(): { hero: HeroVoice; dim: SharedValue<number>; overlay: ReactNode } {
  const session = useInPlace();
  const reduce = useReducedMotion();
  const mode = useSharedValue(RADIAL_HIDDEN);
  const level = useSharedValue(0);
  const cancel = useSharedValue(0);
  const smooth = useSharedValue(0);
  const focus = useSharedValue(0);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const goal = session.open ? 1 : 0;
    focus.set(reduce ? goal : withTiming(goal, { duration: motion.screen.duration, easing: Easing.out(Easing.cubic) }));
    if (!session.open) mode.set(RADIAL_HIDDEN);
  }, [session.open, reduce, focus, mode]);
  useEffect(() => {
    cancel.set(session.zone === 'armed' ? 1 : session.zone === 'sliding' ? 0.4 : 0);
  }, [session.zone, cancel]);
  // Pindah ke layar lain: lapisan ditutup (rekaman dan suara dihentikan pengendalinya).
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) inPlace.close();
  }, [focused]);

  const hero: HeroVoice = {
    mode,
    level,
    cancel,
    smooth,
    focus,
    active: session.open,
    thinking: session.open && thinking,
  };
  const overlay = session.open ? <InPlaceLayer session={session} hero={hero} onThinking={setThinking} /> : null;
  return { hero, dim: focus, overlay };
}

/** Lapisan suara yang sedang terbuka: satu pengendali suara, teks di atas Inti, kartu balasan di bawahnya. */
function InPlaceLayer({
  session,
  hero,
  onThinking,
}: {
  session: InPlaceSession;
  hero: HeroVoice;
  onThinking: (on: boolean) => void;
}) {
  const voice = useVoice({ keepAwake: false, level: hero.level });
  const latest = useRef<Voice>(voice);
  useEffect(() => {
    latest.current = voice;
  });

  // Mulai, kirim, batal dari Inti. Tahanan pertama sudah dimulai sebelum lapisan ini terpasang.
  useEffect(() => {
    const off = inPlace.onHold((event) => {
      const v = latest.current;
      if (event === 'start') void v.holdStart();
      else if (event === 'send') void v.holdEnd();
      else v.cancelHold();
    });
    if (inPlace.get().held) void latest.current.holdStart();
    return off;
  }, []);

  const { phase, reply, confirm, note, permission } = voice;
  useEffect(() => {
    hero.mode.set(MODE[phase] ?? RADIAL_HIDDEN);
    onThinking(phase === 'sending' || phase === 'thinking');
  }, [phase, hero.mode, onThinking]);

  // Tidak ada yang perlu dibaca lagi (batal, tahanan dilepas sebelum siap): lapisan menutup; hanya kabar: sesudah dibaca.
  const done = !session.held && phase === 'idle' && !reply && !confirm && !permission;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => inPlace.close(), note ? NOTE_CLOSE_MS : 150);
    return () => clearTimeout(t);
  }, [done, note]);

  // Tombol Kembali menutup lapisan, bukan aplikasi.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      inPlace.close();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Petunjuk "Lepas untuk kirim" untuk beberapa tahanan pertama.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!session.held) return;
    let alive = true;
    void (async () => {
      hintUses ??= Number((await readSecure(HINT_KEY).catch(() => null)) ?? 0) || 0;
      if (!alive || hintUses >= RELEASE_HINT_USES) return;
      hintUses += 1;
      setHint(true);
      void writeSecure(HINT_KEY, String(hintUses)).catch(() => {});
    })();
    return () => {
      alive = false;
      setHint(false);
    };
  }, [session.held]);

  return (
    <InPlaceView
      session={session}
      voice={voice}
      releaseHint={hint && phase === 'listening'}
      onClose={() => inPlace.close()}
    />
  );
}

function InPlaceView({
  session,
  voice,
  releaseHint,
  onClose,
}: {
  session: InPlaceSession;
  voice: Voice;
  releaseHint: boolean;
  onClose: () => void;
}) {
  const { c, shadow, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const root = useRef<ViewInstance>(null);
  // Posisi lapisan di jendela (biasanya 0,0): pusat Inti diukur di jendela.
  const [origin, setOrigin] = useState({ x: 0, y: 0, height: 0 });
  const { phase, transcript, transcriptFinal, reply, confirm, note, slow, muted, permission } = voice;

  const anchor = session.anchor;
  const size = anchor ? anchor.size : 0;
  const cx = anchor ? anchor.x - origin.x : 0;
  const cy = anchor ? anchor.y - origin.y : origin.height * 0.34;
  const listening = phase === 'listening';
  const busy = phase === 'sending' || phase === 'thinking';

  const said = transcript || (listening ? LISTENING_TEXT : '');
  const slideHint = session.zone === 'armed' ? ARMED_HINT_TEXT : session.zone === 'sliding' ? SLIDE_HINT_TEXT : null;
  const small = slideHint ?? (releaseHint ? RELEASE_HINT_TEXT : busy && slow ? STILL_WORKING_TEXT : null);
  const line = reply || confirm ? null : note;
  const cardTop = cy + size / 2 + GAP;
  const cardMax = Math.max(120, origin.height - cardTop - insets.bottom - TAB_BAR_ROOM);

  return (
    <View
      ref={root}
      testID="suara-ditempat"
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        try {
          root.current?.measureInWindow((x, y) => {
            if (Number.isFinite(x) && Number.isFinite(y)) setOrigin({ x, y, height });
          });
        } catch {
          setOrigin((o) => ({ ...o, height }));
        }
      }}
    >
      {/* Ketuk di luar menutup. Inti tetap bisa ditahan lagi (pengganti sentuhannya di atas lapisan ini). */}
      <Pressable
        testID="suara-ditempat-tutup"
        accessibilityRole="button"
        accessibilityLabel="Tutup"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      {/* Di atas Inti: ucapan (kata sementara lebih redup), lalu petunjuk kecil. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 24, right: 24, bottom: Math.max(0, origin.height - (cy - size / 2 - 12)) }}
      >
        {said ? (
          <Txt
            testID="suara-ditempat-ucapan"
            accessibilityLiveRegion="polite"
            weight={500}
            numberOfLines={3}
            color={transcript && transcriptFinal ? c.text : c.muted}
            style={{ textAlign: 'center', fontSize: 24, lineHeight: 32, letterSpacing: -0.3 }}
            maxFontSizeMultiplier={1.3}
          >
            {said}
          </Txt>
        ) : null}
        {line ? (
          <Txt testID="suara-ditempat-kabar" color={c.muted} style={{ textAlign: 'center', marginTop: 6 }}>
            {line}
          </Txt>
        ) : null}
        {small ? (
          <Txt
            testID="suara-ditempat-petunjuk"
            v="caption"
            color={session.zone === 'armed' ? marker.warn.ink : c.muted}
            style={{ textAlign: 'center', marginTop: 6 }}
          >
            {small}
          </Txt>
        ) : null}
      </View>

      {anchor ? <HoldProxy cx={cx} cy={cy} size={size} /> : null}

      {/* Di bawah Inti: jawaban, dibacakan; bisukan dan buka percakapan. */}
      {reply || confirm ? (
        <Animated.View
          testID="suara-ditempat-kartu"
          entering={FadeIn.duration(motion.screen.duration)}
          exiting={FadeOut.duration(160)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: cardTop,
            maxHeight: cardMax,
            borderRadius: 28,
            backgroundColor: c.surface,
            boxShadow: shadow.e2,
            paddingTop: 18,
            paddingBottom: 8,
          }}
        >
          <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {reply ? (
              <Txt
                testID="suara-ditempat-balasan"
                accessibilityLiveRegion="polite"
                weight={500}
                style={{ fontSize: 19, lineHeight: 27 }}
                maxFontSizeMultiplier={1.3}
              >
                {reply}
              </Txt>
            ) : null}
            {confirm ? <ConfirmArea card={confirm.card} messageId={confirm.messageId} /> : null}
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Suarakan' : 'Bisukan'}
              accessibilityState={{ selected: muted }}
              onPress={() => voice.setMuted(!muted)}
              hitSlop={4}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={muted ? 'speakerOff' : 'speaker'} size={22} color={c.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={OPEN_CHAT_TEXT}
              onPress={() => {
                onClose();
                router.navigate('/chat');
              }}
              style={{ minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Txt weight={600} color={c.brandInk}>
                {OPEN_CHAT_TEXT}
              </Txt>
              <Icon name="chevR" size={18} color={c.brandInk} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {permission ? (
        <PermissionPanel
          blocked={permission !== 'explain'}
          waiting={permission === 'waiting'}
          bottom={insets.bottom}
          onAllow={() => void voice.requestPermission()}
          onSettings={() => {
            void Linking.openSettings().catch(() => {});
            voice.waitForSettings();
          }}
          onClose={() => {
            voice.closePermission();
            onClose();
          }}
        />
      ) : null}
    </View>
  );
}

/** Titik jari dari peristiwa sentuhan (koordinat halaman), bila ada. */
function fingerOf(e: GestureResponderEvent): { x: number; y: number } | null {
  const n = e.nativeEvent;
  return Number.isFinite(n.pageX) && Number.isFinite(n.pageY) ? { x: n.pageX, y: n.pageY } : null;
}

/**
 * Pengganti sentuhan Inti besar selama lapisan terbuka (lapisan menutupi Inti-nya): tahan lagi = giliran baru (menyela
 * jawaban yang sedang dibacakan), ketuk = chat. Tak terlihat; Inti-nya sendiri tetap tergambar di bawah.
 */
function HoldProxy({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const anchor = inPlace.get().anchor;
  return (
    <View
      onTouchMove={(e) => {
        try {
          inPlace.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
        } catch (err) {
          reportError('suara di tempat: geser', err);
        }
      }}
      style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size }}
    >
      <PressableScale
        testID="suara-ditempat-inti"
        accessibilityRole="button"
        accessibilityLabel="Tahan untuk bicara lagi"
        onPress={() => {
          inPlace.close();
          router.navigate('/chat');
        }}
        onLongPress={(e) => {
          try {
            haptic('medium');
            inPlace.begin({ finger: fingerOf(e), anchor });
          } catch (err) {
            reportError('suara di tempat: tahan lagi', err);
          }
        }}
        onPressOut={() => inPlace.release()}
        delayLongPress={motion.longPress}
        pressRetentionOffset={{ top: 240, bottom: 240, left: 240, right: 240 }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    </View>
  );
}
