import { router, type Href } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HELP_TEXT, openWhatsApp, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { devQuery } from '@/dev/query';
import { useDataMode } from '@/api/dataMode';
import { formatPhoneDisplay } from '@/api/format';
import { useProfile } from '@/api/useProfile';
import { appVersion } from '@/api/version';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Initials } from './Initials';
import { useToast } from './toastStore';
import { Txt } from './Txt';

// ---- Keadaan buka/tutup, satu untuk seluruh aplikasi ----

// Pratinjau web saat pengembangan (`?menu=1`, scripts/shots.mjs): menu sudah terbuka.
let open = devQuery().menu === '1';
const listeners = new Set<() => void>();
const set = (next: boolean) => {
  if (open === next) return;
  open = next;
  for (const l of [...listeners]) l();
};

/** Menu samping (dari kiri): dibuka dari tombol menu di bilah atas Beranda. */
export const sideMenu = {
  open: () => set(true),
  close: () => set(false),
  isOpen: () => open,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Untuk tes. */
  reset: () => {
    open = false;
  },
};

export function useSideMenuOpen(): boolean {
  return useSyncExternalStore(sideMenu.subscribe, sideMenu.isOpen, sideMenu.isOpen);
}

/** Lama geser masuk dan keluar. */
const SLIDE_MS = 240;

interface Item {
  key: string;
  icon: IconName;
  label: string;
  to?: Href;
  run?: () => void;
}

/**
 * Menu samping ala aplikasi Android (bukan halaman web): panel dari kiri dengan sudut kanan membulat, di atasnya profil
 * pemilik akun (inisial, nama, nomor WhatsApp, paket), lalu layar-layar pendukung, dan Keluar di bawah. Ditutup dengan
 * ketukan di luar panel, tombol Kembali, atau memilih salah satu isinya. Dipasang sekali di akar aplikasi.
 */
export function SideMenu() {
  const isOpen = useSideMenuOpen();
  const reduce = useReducedMotion();
  // Tetap terpasang selama geser keluar, lalu dilepas (tidak ada isi tersembunyi yang dibaca pembaca layar).
  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      const show = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(show);
    }
    const hide = setTimeout(() => setMounted(false), reduce ? 0 : SLIDE_MS);
    return () => clearTimeout(hide);
  }, [isOpen, reduce]);
  useEffect(() => {
    const goal = isOpen && mounted ? 1 : 0;
    progress.set(reduce ? goal : withTiming(goal, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
  }, [isOpen, mounted, reduce, progress]);
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sideMenu.close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen]);

  if (!mounted) return null;
  return <Panel progress={progress} />;
}

function Panel({ progress }: { progress: SharedValue<number> }) {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const profile = useProfile();
  const { hybrid } = useDataMode();
  const panelWidth = Math.min(320, Math.round(width * 0.84));

  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));
  const slide = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { transform: [{ translateX: -panelWidth * (1 - p) }] };
  });

  const go = (to: Href) => {
    sideMenu.close();
    router.push(to);
  };
  const help = () => {
    sideMenu.close();
    void openWhatsApp(HELP_TEXT).then((ok) => {
      if (!ok) toast(WA_UNAVAILABLE_TEXT);
    });
  };
  // Kelompok menu. Mode akun: Perangkat, Usaha, dan Asisten masih contoh atau diatur lewat WhatsApp, jadi tidak tampil.
  const sections: { key: string; title?: string; items: Item[] }[] = [
    {
      key: 'utama',
      items: [
        { key: 'chat', icon: 'chat', label: 'Chat', to: '/chat' },
        { key: 'suara', icon: 'mic', label: 'Mode Suara', to: '/suara' },
        { key: 'agenda', icon: 'calendar', label: 'Agenda', to: '/agenda' },
      ],
    },
    {
      key: 'kelola',
      title: 'Kelola',
      items: [
        { key: 'integrasi', icon: 'link', label: 'Integrasi', to: '/terhubung' },
        ...(hybrid
          ? []
          : ([
              { key: 'perangkat', icon: 'bulb', label: 'Perangkat', to: '/perangkat' },
              { key: 'usaha', icon: 'store', label: 'Usaha', to: '/usaha' },
            ] satisfies Item[])),
        { key: 'riwayat', icon: 'history', label: 'Riwayat', to: '/riwayat' },
      ],
    },
    {
      key: 'akun',
      title: 'Akun',
      items: [
        { key: 'pengaturan', icon: 'tune', label: 'Pengaturan', to: '/akun' },
        { key: 'notifikasi', icon: 'bell', label: 'Pemberitahuan', to: '/akun/notifikasi' },
        ...(hybrid ? [] : [{ key: 'asisten', icon: 'sparkle', label: 'Asisten', to: '/akun/asisten' } satisfies Item]),
        { key: 'keamanan', icon: 'shield', label: 'Keamanan', to: '/akun/keamanan' },
      ],
    },
  ];

  return (
    <View testID="menu-samping" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}>
        <Pressable
          testID="menu-samping-tutup"
          accessibilityRole="button"
          accessibilityLabel="Tutup menu"
          onPress={sideMenu.close}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: panelWidth,
            backgroundColor: c.surface,
            borderTopRightRadius: 28,
            borderBottomRightRadius: 28,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 12,
            boxShadow: '8px 0 32px -12px rgba(0,0,0,0.28)',
          },
          slide,
        ]}
      >
        <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* Profil: siapa yang memakai aplikasi ini. */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 12 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: c.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Initials size={20} />
            </View>
            <View style={{ gap: 2 }}>
              <Txt testID="menu-nama" weight={600} numberOfLines={1} style={{ fontSize: 20, lineHeight: 26 }}>
                {profile.name ?? 'Akun Anda'}
              </Txt>
              {profile.phone ? (
                <Txt color={c.muted} tabular style={{ fontSize: 14, lineHeight: 20 }}>
                  {formatPhoneDisplay(profile.phone)}
                </Txt>
              ) : null}
              {profile.plan ? (
                <Txt color={c.brandInk} weight={600} style={{ fontSize: 13, lineHeight: 18 }}>
                  {profile.plan.name}
                </Txt>
              ) : null}
            </View>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginHorizontal: 24 }} />
          {sections.map((section) => (
            <View key={section.key} style={{ paddingHorizontal: 12, paddingTop: section.title ? 16 : 12, gap: 2 }}>
              {section.title ? (
                <Txt
                  color={c.muted}
                  weight={600}
                  style={{ fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 4 }}
                >
                  {section.title}
                </Txt>
              ) : null}
              {section.items.map((it) => (
                <MenuRow key={it.key} icon={it.icon} label={it.label} onPress={it.run ?? (() => go(it.to!))} />
              ))}
            </View>
          ))}
          <View style={{ flexGrow: 1, minHeight: 16 }} />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginHorizontal: 24 }} />
          <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 2 }}>
            <MenuRow icon="help" label="Bantuan" onPress={help} />
            <MenuRow icon="logout" label="Keluar" color={marker.warn.ink} onPress={() => go('/keluar')} />
            <Txt color={c.faint} style={{ fontSize: 12, lineHeight: 16, paddingHorizontal: 16 }}>
              {`Sekretaris AI · versi ${appVersion()}`}
            </Txt>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** Satu baris menu: ikon dan label, sorotan membulat saat disentuh (bukan kotak). */
function MenuRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.ripple, borderless: false, foreground: true }}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 24,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        backgroundColor: pressed ? c.sunken : 'transparent',
      })}
    >
      <Icon name={icon} size={22} color={color ?? c.text} />
      <Txt weight={500} color={color ?? c.text} style={{ fontSize: 16, lineHeight: 22 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
