// Niat layar: Inti besar di tengah atas, tersambung ke semua layanan Anda, untuk diketuk (chat) atau ditahan (bicara),
// lalu paling banyak tiga hal yang perlu Anda sekarang.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Device, Draft } from '@/api/contract';
import { useDataMode } from '@/api/dataMode';
import { useAgenda } from '@/api/useAgenda';
import { useChat } from '@/api/useChat';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { useWeather } from '@/api/useWeather';
import { useTheme } from '@/theme/ThemeProvider';
import {
  contactInitial,
  deviceIcon,
  greetingText,
  nextAgenda,
  oldestApproval,
  pickFavorites,
  stateWord,
  suggestionFor,
} from '@/ui/beranda/blocks';
import { heroMetrics, PLACEHOLDER_NODES, webNodes } from '@/ui/beranda/heroLayout';
import { IntiHero } from '@/ui/beranda/IntiHero';
import { AgendaWidget, TodayLine, WeatherWidget } from '@/ui/beranda/Widgets';
import { Initials } from '@/ui/Initials';
import {
  ApprovalCard,
  blockEntering,
  blockExiting,
  CoachMark,
  FavouriteToggle,
  GradientField,
  SuggestionCard,
} from '@/ui/kit';
import { TIP_TEXT, useTip } from '@/ui/tips';
import { useToast } from '@/ui/toastStore';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';
import { useInPlaceVoice } from '@/voice/InPlaceVoice';

const pad = (n: number) => String(n).padStart(2, '0');

/** Tinggi baris sapaan (avatar 48). */
const GREETING_ROW = 48;
/** Pertanyaan yang dibuka saat widget cuaca diketuk. */
const WEATHER_QUESTION = 'Cuaca hari ini bagaimana?';
/** Jam HP "HH.MM" dan tanggal "YYYY-MM-DD", bila agenda (jam zona pengguna dari server) belum dimuat. */
function deviceClock(): { now: string; today: string } {
  const d = new Date();
  return {
    now: `${pad(d.getHours())}.${pad(d.getMinutes())}`,
    today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

export default function Beranda() {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const hero = heroMetrics(win.width, win.height);
  const compact = hero.cls === 'compact';
  const live = useLive();
  const toast = useToast();
  const { home, ring, status, error, retry } = useHome();
  const agenda = useAgenda();
  const devices = useDeviceControl('Semua');
  const chat = useChat({ onError: toast });
  const tip = useTip('inti');
  // Menahan Inti besar: bicara di tempat. Isi lain Beranda menghilang (latar polos), Inti tetap di tengah.
  const { hero: heroVoice, dim, overlay } = useInPlaceVoice();
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - dim.get() }));
  // Mode akun: persetujuan dan perangkat masih contoh, jadi bloknya tidak tampil. Agenda dan cuaca sudah asli: widgetnya
  // tampil (sapaan, Inti, widget, dan "Coba bilang" untuk pengguna baru).
  const { hybrid } = useDataMode();
  const weather = useWeather();

  const clock = deviceClock();
  const now = agenda.now ?? clock.now;
  const today = agenda.today ?? clock.today;
  const approval = home && !hybrid ? oldestApproval(home) : null;
  const next = home
    ? nextAgenda({ items: agenda.items, today: agenda.today, homeToday: hybrid ? [] : home.agendaToday }, now)
    : null;
  const favorites = hybrid ? [] : pickFavorites(devices.devices);
  // Pengguna baru: tidak ada yang perlu disetujui, tidak ada agenda dekat, tidak ada perangkat. Menunggu perangkat
  // dimuat dulu, supaya kartu contoh tidak berkedip lalu hilang.
  const devicesKnown = devices.data !== null || devices.status === 'error';
  const fresh = home !== null && devicesKnown && !approval && !next && favorites.length === 0;
  const greeting = home ? greetingText(Number(now.slice(0, 2)), home.greetingName, fresh) : null;

  // Urutan muncul blok yang tampil (jeda 80 ms per blok): persetujuan, widget (cuaca dan agenda), perangkat favorit.
  const widgetIndex = approval ? 1 : 0;
  const favIndex = widgetIndex + 1;

  // Jaring: layanan dan perangkat dari cincin Beranda; pengguna tanpa layanan melihat tiga simpul contoh yang redup.
  // Mode akun: cincinnya masih contoh, jadi yang tampil simpul redup, bukan layanan contoh seolah tersambung.
  const nodes = home === null ? [] : !hybrid && ring.length > 0 ? webNodes(ring, hero.maxNodes) : PLACEHOLDER_NODES;
  const topPad = compact ? 12 : 20;
  const heroGap = compact ? 2 : 6;
  // Inti tepat di bawah sapaan; widget (cuaca dan agenda) mengisi bagian bawahnya, juga untuk pengguna baru.
  const [greetingBottom, setGreetingBottom] = useState<number | null>(null);
  const heroTop = (greetingBottom ?? insets.top + topPad + GREETING_ROW) + heroGap;
  // Petunjuk pertama menunjuk bagian bawah Inti besar (posisinya diukur: ruang lentur bisa menurunkan Inti).
  const [heroY, setHeroY] = useState<number | null>(null);
  const tipTop = (heroY ?? heroTop) + hero.height / 2 + hero.inti / 2 + 14;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Latar gradasi hijau lembut di belakang sapaan, sampai ke bawah bilah status. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dimStyle]}>
        <GradientField recipe="hero" />
      </Animated.View>
      <ScrollView
        scrollEnabled={!heroVoice.active}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + topPad, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          onLayout={(e) => setGreetingBottom(Math.round(e.nativeEvent.layout.y + e.nativeEvent.layout.height))}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 24,
              paddingRight: 16,
              gap: 12,
            },
            dimStyle,
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Txt
              v="display"
              accessibilityRole="header"
              numberOfLines={2}
              style={compact ? { fontSize: 28, lineHeight: 34 } : null}
            >
              {greeting ?? ''}
            </Txt>
            {home ? <TodayLine compact={compact} /> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
            onPress={() => router.push('/akun')}
            onLongPress={__DEV__ ? () => router.push('/inti') : undefined}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.surface,
              boxShadow: shadow.e1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Initials />
          </Pressable>
        </Animated.View>

        {/* Ruang lentur dibagi di atas dan di bawah Inti: di HP tinggi Inti berada di tengah, tidak menyisakan lubang. */}
        <View style={{ flexGrow: 2, minHeight: 0 }} />
        <Animated.View
          testID="beranda-inti"
          style={{ marginTop: heroGap }}
          onLayout={(e) => setHeroY(Math.round(e.nativeEvent.layout.y))}
        >
          <IntiHero metrics={hero} nodes={nodes} paused={!live} halo={tip.visible} voice={heroVoice} />
        </Animated.View>

        {!home && status === 'error' ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 16, alignItems: 'flex-start' }}>
            <Txt>{error}</Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Coba lagi"
              onPress={() => void retry()}
              style={{
                minHeight: 56,
                paddingHorizontal: 28,
                borderRadius: 28,
                backgroundColor: c.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt weight={600} color={c.onBrand}>
                Coba lagi
              </Txt>
            </Pressable>
          </View>
        ) : null}

        <View style={{ flexGrow: 3, minHeight: 4 }} />
        <Animated.View style={[{ gap: 20, paddingTop: compact ? 10 : 14 }, dimStyle]}>
          {approval ? (
            <Animated.View
              key={`persetujuan-${approval.id}`}
              testID="blok-persetujuan"
              entering={blockEntering(0)}
              exiting={blockExiting}
              style={{ paddingHorizontal: 16 }}
            >
              <Approval draft={approval} chat={chat} compact={compact} />
            </Animated.View>
          ) : null}
          {home ? (
            <Animated.View
              key="widget"
              testID="blok-agenda"
              entering={blockEntering(widgetIndex)}
              exiting={blockExiting}
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}
            >
              {weather.status !== 'off' ? (
                <WeatherWidget
                  view={weather}
                  compact={compact}
                  onAsk={() => router.push({ pathname: '/chat', params: { isi: WEATHER_QUESTION } })}
                />
              ) : null}
              <AgendaWidget next={next} compact={compact} onOpen={() => router.navigate('/agenda')} />
            </Animated.View>
          ) : null}
          {favorites.length > 0 ? (
            <Animated.View
              key="favorit"
              testID="blok-favorit"
              entering={blockEntering(favIndex)}
              exiting={blockExiting}
              style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}
            >
              {favorites.map((d) => (
                <Favourite key={d.id} device={d} compact={compact} control={devices.control} />
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>

        <View style={{ height: 20 }} />
        {fresh && !tip.visible ? (
          <Animated.View
            testID="blok-saran"
            entering={blockEntering(0)}
            exiting={blockExiting}
            style={{ paddingHorizontal: 16, marginBottom: compact ? 4 : 12 }}
          >
            {/* Redup di lapisan dalam: opacity lapisan luar milik animasi muncul. */}
            <Animated.View style={dimStyle}>
              <SuggestionCard
                text={suggestionFor(today)}
                onPress={() => router.push({ pathname: '/chat', params: { isi: suggestionFor(today) } })}
              />
            </Animated.View>
          </Animated.View>
        ) : null}
      </ScrollView>
      {tip.visible && !heroVoice.active ? (
        <CoachMark text={TIP_TEXT.inti} top={tipTop} onDismiss={tip.dismiss} />
      ) : null}
      {overlay}
    </View>
  );
}

/** Persetujuan tertua: Kirim menahan kiriman 5 menit (masih bisa dibatalkan di chat atau Riwayat), Ubah membuka chat di drafnya. */
function Approval({ draft, chat, compact }: { draft: Draft; chat: ReturnType<typeof useChat>; compact: boolean }) {
  return (
    <ApprovalCard
      name={draft.to}
      initial={contactInitial(draft.to)}
      preview={draft.text}
      busy={chat.draftBusy(draft.id)}
      compact={compact}
      onEdit={() => router.push({ pathname: '/chat', params: { draf: draft.id } })}
      onSend={() => void chat.draftAction(draft.id, 'send')}
    />
  );
}

/** Sakelar besar: ketuk nyala/mati lewat aturan perangkat yang sama (PIN, tanya dulu sebelum membuka kunci), tahan membuka remote. */
function Favourite({
  device,
  compact,
  control,
}: {
  device: Device;
  compact: boolean;
  control: ReturnType<typeof useDeviceControl>['control'];
}) {
  return (
    <FavouriteToggle
      testID={`favorit-${device.id}`}
      icon={deviceIcon(device)}
      name={device.short ?? device.name}
      state={stateWord(device)}
      on={device.on}
      reachable={device.reachable}
      compact={compact}
      onToggle={() => void control(device.id, { on: !device.on })}
      onOpen={() => router.push({ pathname: '/perangkat/[id]', params: { id: device.id } })}
    />
  );
}
