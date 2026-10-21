// Niat layar: menunjukkan sekilas yang perlu Anda sekarang (paling banyak tiga hal). Tindakan tersering: ketuk atau tahan
// Inti di zona jempol (tepat di atas bilah tab) untuk chat atau bicara.
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Device, Draft } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { useChat } from '@/api/useChat';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
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
  type NextAgenda,
} from '@/ui/beranda/blocks';
import { Initials } from '@/ui/Initials';
import {
  ApprovalCard,
  blockEntering,
  blockExiting,
  blockLayout,
  CoachMark,
  FavouriteToggle,
  GradientField,
  NextItemRow,
  SuggestionCard,
  useLayoutClass,
} from '@/ui/kit';
import { useBerandaIntiSize } from '@/ui/TabBar';
import { TIP_TEXT, useTip } from '@/ui/tips';
import { useToast } from '@/ui/toastStore';
import { Txt } from '@/ui/Txt';

const pad = (n: number) => String(n).padStart(2, '0');
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
  const compact = useLayoutClass() === 'compact';
  const orb = useBerandaIntiSize();
  const toast = useToast();
  const { home, status, error, retry } = useHome();
  const agenda = useAgenda();
  const devices = useDeviceControl('Semua');
  const chat = useChat({ onError: toast });
  const tip = useTip('inti');

  const clock = deviceClock();
  const now = agenda.now ?? clock.now;
  const today = agenda.today ?? clock.today;
  const approval = home ? oldestApproval(home) : null;
  const next = home ? nextAgenda({ items: agenda.items, today: agenda.today, homeToday: home.agendaToday }, now) : null;
  const favorites = pickFavorites(devices.devices);
  // Pengguna baru: tidak ada yang perlu disetujui, tidak ada agenda dekat, tidak ada perangkat. Menunggu perangkat
  // dimuat dulu, supaya kartu contoh tidak berkedip lalu hilang.
  const devicesKnown = devices.data !== null || devices.status === 'error';
  const fresh = home !== null && devicesKnown && !approval && !next && favorites.length === 0;
  const greeting = home ? greetingText(Number(now.slice(0, 2)), home.greetingName, fresh) : null;

  // Urutan muncul blok yang tampil (jeda 80 ms per blok).
  const nextIndex = approval ? 1 : 0;
  const favIndex = nextIndex + (next ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Latar gradasi hijau lembut di belakang sapaan, sampai ke bawah bilah status. */}
      <GradientField recipe="hero" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + (compact ? 14 : 44),
          // Setengah Inti naik di atas bilah tab: isi terakhir tidak pernah tertutup.
          paddingBottom: orb / 2 + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 24,
            paddingRight: 16,
            gap: 12,
          }}
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
        </View>

        {!home && status === 'error' ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 32, gap: 16, alignItems: 'flex-start' }}>
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

        <View style={{ gap: 20, paddingTop: compact ? 20 : 28 }}>
          {approval ? (
            <Animated.View
              key={`persetujuan-${approval.id}`}
              testID="blok-persetujuan"
              entering={blockEntering(0)}
              exiting={blockExiting}
              layout={blockLayout}
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
              layout={blockLayout}
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
              layout={blockLayout}
              style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}
            >
              {favorites.map((d) => (
                <Favourite key={d.id} device={d} compact={compact} control={devices.control} />
              ))}
            </Animated.View>
          ) : null}
        </View>

        {/* Ruang kosong itu disengaja: kartu contoh pengguna baru duduk di zona jempol, tepat di atas Inti. */}
        <View style={{ flexGrow: 1, minHeight: 24 }} />
        {fresh && !tip.visible ? (
          <Animated.View
            testID="blok-saran"
            entering={blockEntering(0)}
            exiting={blockExiting}
            style={{ paddingHorizontal: 16, marginBottom: compact ? 16 : 42 }}
          >
            <SuggestionCard
              text={suggestionFor(today)}
              onPress={() => router.push({ pathname: '/chat', params: { isi: suggestionFor(today) } })}
            />
          </Animated.View>
        ) : null}
      </ScrollView>
      {tip.visible ? <CoachMark text={TIP_TEXT.inti} bottom={orb / 2 + 50} onDismiss={tip.dismiss} /> : null}
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
