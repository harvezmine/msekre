import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { IntiButton } from './inti/IntiButton';
import { inPlace, useInPlace } from '@/voice/inPlace';
import { INTI_SIZE, INTI_SLOT, TAB_BAR_HEIGHT } from './tabBarMetrics';
import { splitTabs, useTabSet, visitTab, type TabName } from './tabSet';
import { TabsLiveContext } from './TabsLiveContext';
import { dismissTip } from './tips';
import { Txt } from './Txt';

export { INTI_SIZE, INTI_SLOT, TAB_BAR_HEIGHT };

const TABS: Record<TabName, { label: string; icon: IconName }> = {
  index: { label: 'Beranda', icon: 'home' },
  agenda: { label: 'Agenda', icon: 'calendar' },
  perangkat: { label: 'Perangkat', icon: 'bulb' },
  usaha: { label: 'Usaha', icon: 'store' },
};

/**
 * Bilah tab: dua paruh mengapit slot Inti yang tetap di tengah. Tab tumbuh sesuai pemakaian (`useTabSet`): Beranda dan
 * Agenda selalu; Perangkat dan Usaha setelah ada isinya, muncul dengan gerak halus dan titik sampai dikunjungi. Inti di
 * slot tengah berukuran sama di semua tab (48, di dalam bilah) dan bisa diketuk atau ditahan di mana pun. Di Beranda
 * Inti besar di atas layar membawa label dan aksi yang sama, jadi Inti bilah tidak dibacakan dua kali oleh pembaca layar.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { c, shadow } = useTheme();
  const live = useContext(TabsLiveContext);
  const voiceOpen = useInPlace().open;
  const reduce = useReducedMotion();
  const set = useTabSet();
  const activeName = state.routes[state.index]?.name;
  const onBeranda = activeName === 'index';

  const routes = set.ready ? state.routes.filter((r) => set.tabs.includes(r.name as TabName)) : [];
  const { left, right } = splitTabs(routes);

  const tab = (route: (typeof state.routes)[number]) => {
    const name = route.name as TabName;
    const selected = activeName === name;
    const isNew = set.fresh.has(name);
    return (
      <Animated.View
        key={route.key}
        style={{ flex: 1 }}
        layout={reduce ? undefined : LinearTransition.duration(motion.tab.layout)}
        entering={isNew && !reduce ? FadeIn.delay(motion.tab.layout).duration(motion.tab.fade) : undefined}
      >
        <TabItem
          name={name}
          selected={selected}
          isNew={isNew}
          reduce={reduce}
          onPress={() => {
            dismissTip('inti');
            visitTab(name);
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigateToTab(route.key);
          }}
        />
      </Animated.View>
    );
  };

  // Agenda: kolom Tambah menempel di atas bilah (satu permukaan dengan sudut membulat sendiri). Tab lain: bilah berupa
  // dok dengan sudut atas membulat dan bayangan lembut ke atas, tanpa garis pemisah yang kaku.
  const dock = activeName !== 'agenda';

  return (
    <View
      testID="bilah-tab"
      accessibilityRole="tablist"
      style={{
        height: TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        backgroundColor: c.tabbar,
        borderTopLeftRadius: dock ? DOCK_RADIUS : 0,
        borderTopRightRadius: dock ? DOCK_RADIUS : 0,
        boxShadow: dock ? shadow.dock : undefined,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>{left.map(tab)}</View>
      <View
        testID="inti-tab"
        accessibilityElementsHidden={onBeranda}
        importantForAccessibility={onBeranda ? 'no-hide-descendants' : 'auto'}
        style={{ width: INTI_SLOT, alignItems: 'center', justifyContent: 'center' }}
      >
        <IntiButton size={INTI_SIZE.tab} paused={!live} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>{right.map(tab)}</View>
      {/* Mode Suara di tempat (Beranda) terbuka: bilah tertutup latar halaman (polos), dan ketukan di sana menutupnya. */}
      {voiceOpen ? (
        <Pressable
          testID="bilah-tab-tutup-suara"
          accessibilityRole="button"
          accessibilityLabel="Tutup"
          onPress={() => void inPlace.dismiss()}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: -StyleSheet.hairlineWidth,
            backgroundColor: c.bg,
          }}
        />
      ) : null}
    </View>
  );
}

/** Sudut atas dok bilah tab. */
const DOCK_RADIUS = 28;
/** Kapsul penanda tab aktif (di belakang ikon). */
const PILL = { width: 64, height: 36 } as const;

/**
 * Satu tab: kapsul hijau lembut yang tumbuh dari tengah ikon dengan gerak pegas saat dipilih (dan menyusut saat
 * ditinggalkan), ikon sedikit terangkat, dan sentuhan mengecilkan tab sesaat. Tanpa sorotan kotak. "Kurangi gerakan":
 * kapsul langsung tampil atau hilang.
 */
function TabItem({
  name,
  selected,
  isNew,
  reduce,
  onPress,
}: {
  name: TabName;
  selected: boolean;
  isNew: boolean;
  reduce: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const meta = TABS[name];
  const color = selected ? c.brandInk : c.muted;
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.set(reduce ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, motion.press.spring));
  }, [selected, reduce, on]);
  const pill = useAnimatedStyle(() => {
    const v = Math.min(1, Math.max(0, on.get()));
    return { opacity: v, transform: [{ scaleX: 0.55 + 0.45 * v }, { scaleY: 0.75 + 0.25 * v }] };
  });
  const icon = useAnimatedStyle(() => {
    const v = Math.min(1, Math.max(0, on.get()));
    return { transform: [{ translateY: -1.5 * v }, { scale: (1 + 0.06 * v) * press.get() }] };
  });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={meta.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => press.set(reduce ? 1 : withTiming(0.9, { duration: 90 }))}
      onPressOut={() => press.set(reduce ? 1 : withSpring(1, motion.press.spring))}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <View style={{ width: PILL.width, height: PILL.height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          testID={`tab-penanda-${name}`}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: PILL.height / 2, backgroundColor: c.brandSoft, borderWidth: 1, borderColor: c.brandGlow },
            pill,
          ]}
        />
        <Animated.View style={icon}>
          <Icon name={meta.icon} size={24} color={color} />
        </Animated.View>
        {isNew ? (
          <View
            testID={`tab-baru-${name}`}
            style={{
              position: 'absolute',
              top: 4,
              right: 14,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.brand,
            }}
          />
        ) : null}
      </View>
      <Txt v="micro" weight={selected ? 600 : 500} color={color} maxFontSizeMultiplier={1.2}>
        {meta.label}
      </Txt>
    </Pressable>
  );
}
