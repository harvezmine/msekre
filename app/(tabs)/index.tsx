// Niat layar: Inti besar di tengah atas, tersambung ke semua layanan Anda, untuk diketuk (chat) atau ditahan (bicara),
// lalu paling banyak tiga hal yang perlu Anda sekarang.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Device, Draft } from '@/api/contract';
import { useDataMode } from '@/api/dataMode';
import { useAgenda } from '@/api/useAgenda';
import { useChat } from '@/api/useChat';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import {
  contactInitial,
  deviceIcon,
  greetingText,
  nextAgenda,
  oldestApproval,
  pickFavorites,
  stateWord,
  suggestionFor,
  type NextAgenda,
} from '@/ui/beranda/blocks';
import { heroMetrics, PLACEHOLDER_NODES, webNodes } from '@/ui/beranda/heroLayout';
import { IntiHero } from '@/ui/beranda/IntiHero';
import { Initials } from '@/ui/Initials';
import {
  ApprovalCard,
  blockEntering,
  blockExiting,
  CoachMark,
  FavouriteToggle,
  GradientField,
  NextItemRow,
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
/** Halaman tanpa blok (pengguna baru): pusat Inti turun ke kira-kira sepertiga tinggi layar, lebih dekat ke jempol. */
const HERO_CENTRE = 0.34;
/** Paling jauh Inti diturunkan (dp). */
const MAX_DROP = 120;
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
  // Menahan Inti besar: bicara di tempat. Isi lain Beranda meredup, Inti tetap di tengah.
  const { hero: heroVoice, dim, overlay } = useInPlaceVoice();
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.75 * dim.get() }));
  // Mode akun: persetujuan, agenda, dan perangkat masih contoh, jadi bloknya tidak tampil; tinggal sapaan, Inti, dan
  // "Coba bilang".
  const { hybrid } = useDataMode();

  const clock = deviceClock();
  const now = agenda.now ?? clock.now;
  const today = agenda.today ?? clock.today;
  const approval = home && !hybrid ? oldestApproval(home) : null;
  const next =
    home && !hybrid ? nextAgenda({ items: agenda.items, today: agenda.today, homeToday: home.agendaToday }, now) : null;
  const favorites = hybrid ? [] : pickFavorites(devices.devices);
  // Pengguna baru: tidak ada yang perlu disetujui, tidak ada agenda dekat, tidak ada perangkat. Menunggu perangkat
  // dimuat dulu, supaya kartu contoh tidak berkedip lalu hilang.
  const devicesKnown = devices.data !== null || devices.status === 'error';
  const fresh = home !== null && devicesKnown && !approval && !next && favorites.length === 0;
  const greeting = home ? greetingText(Number(now.slice(0, 2)), home.greetingName, fresh) : null;

  // Urutan muncul blok yang tampil (jeda 80 ms per blok).
  const nextIndex = approval ? 1 : 0;
  const favIndex = nextIndex + (next ? 1 : 0);

  // Jaring: layanan dan perangkat dari cincin Beranda; pengguna tanpa layanan melihat tiga simpul contoh yang redup.
  // Mode akun: cincinnya masih contoh, jadi yang tampil simpul redup, bukan layanan contoh seolah tersambung.
  const nodes = home === null ? [] : !hybrid && ring.length > 0 ? webNodes(ring, hero.maxNodes) : PLACEHOLDER_NODES;
  const topPad = compact ? 12 : 20;
  const heroGap = compact ? 2 : 6;
  // Dengan blok, Inti tepat di bawah sapaan (ketiga blok tetap terlihat di HP panjang). Tanpa blok, Inti turun ke
  // sekitar sepertiga layar. Pergeseran itu dihitung, bukan spacer lentur (spacer lentur bertabrakan dengan transisi
  // tata letak blok); turunnya dianimasikan 320 ms supaya Inti tidak melompat saat data pertama tiba.
  const [greetingBottom, setGreetingBottom] = useState<number | null>(null);
  const heroTop = (greetingBottom ?? insets.top + topPad + GREETING_ROW) + heroGap;
  const lift = Math.min(MAX_DROP, Math.max(0, Math.round(win.height * HERO_CENTRE - heroTop - hero.height / 2)));
  const drop = fresh ? lift : 0;
  const reduce = useReducedMotion();
  const dropSv = useSharedValue(drop);
  useEffect(() => {
    // Naik kembali (blok pertama muncul) langsung, supaya tidak bergerak bersamaan dengan transisi tata letak blok.
    dropSv.set(
      reduce || drop === 0
        ? drop
        : withTiming(drop, { duration: motion.block.duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [drop, reduce, dropSv]);
  const heroStyle = useAnimatedStyle(() => ({ marginTop: heroGap + dropSv.get() }));
  // Petunjuk pertama menunjuk bagian bawah Inti besar.
  const tipTop = heroTop + drop + hero.height / 2 + hero.inti / 2 + 14;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Latar gradasi hijau lembut di belakang sapaan, sampai ke bawah bilah status. */}
      <GradientField recipe="hero" />
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
          <Txt
            v="display"
            accessibilityRole="header"
            numberOfLines={2}
            style={[{ flex: 1 }, compact ? { fontSize: 28, lineHeight: 34 } : null]}
          >
            {greeting ?? ''}
          </Txt>
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

        <Animated.View testID="beranda-inti" style={heroStyle}>
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
          {next ? (
            <Animated.View
              key="agenda-berikutnya"
              testID="blok-agenda"
              entering={blockEntering(nextIndex)}
              exiting={blockExiting}
            >
              <NextItemRow
                time={nextTime(next)}
                title={next.title}
                compact={compact}
                onPress={() => router.navigate('/agenda')}
              />
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

        {/* Ruang kosong itu disengaja: kartu contoh pengguna baru duduk di zona jempol, tepat di atas bilah tab. */}
        <View style={{ flexGrow: 1, minHeight: 16 }} />
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
      {tip.visible && !heroVoice.active ? <CoachMark text={TIP_TEXT.inti} top={tipTop} onDismiss={tip.dismiss} /> : null}
      {overlay}
    </View>
  );
}

const nextTime = (n: NextAgenda) => (n.day === 1 ? `Besok ${n.time}` : n.time);

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
