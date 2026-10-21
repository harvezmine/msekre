import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { IntiButton } from './inti/IntiButton';
import { useLayoutClass } from './kit/layout';
import { INTI_SIZE, INTI_SLOT, TAB_BAR_HEIGHT } from './tabBarMetrics';
import { splitTabs, useTabSet, visitTab, type TabName } from './tabSet';
import { TabsLiveContext } from './TabsLiveContext';
import { dismissTip, useTip } from './tips';
import { Txt } from './Txt';

export { INTI_SIZE, INTI_SLOT, TAB_BAR_HEIGHT };

const TABS: Record<TabName, { label: string; icon: IconName }> = {
  index: { label: 'Beranda', icon: 'home' },
  agenda: { label: 'Agenda', icon: 'calendar' },
  perangkat: { label: 'Perangkat', icon: 'bulb' },
  usaha: { label: 'Usaha', icon: 'store' },
};

/** Ukuran Inti Beranda untuk kelas layar ini. */
export function useBerandaIntiSize(): number {
  return useLayoutClass() === 'compact' ? INTI_SIZE.compact : INTI_SIZE.beranda;
}

/**
 * Bilah tab: dua paruh mengapit slot Inti yang tetap di tengah. Tab tumbuh sesuai pemakaian (`useTabSet`): Beranda dan
 * Agenda selalu; Perangkat dan Usaha setelah ada isinya, muncul dengan gerak halus dan titik sampai dikunjungi. Inti di
 * Beranda besar dan naik setengah di atas bilah (zona jempol); di tab lain kecil di dalam bilah.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { c } = useTheme();
  const live = useContext(TabsLiveContext);
  const reduce = useReducedMotion();
  const set = useTabSet();
  const tip = useTip('inti');
  const big = useBerandaIntiSize();
  const activeName = state.routes[state.index]?.name;
  const onBeranda = activeName === 'index';

  const routes = set.ready ? state.routes.filter((r) => set.tabs.includes(r.name as TabName)) : [];
  const { left, right } = splitTabs(routes);

  const tab = (route: (typeof state.routes)[number]) => {
    const name = route.name as TabName;
    const meta = TABS[name];
    const selected = activeName === name;
    const color = selected ? c.brandInk : c.muted;
    const isNew = set.fresh.has(name);
    return (
      <Animated.View
        key={route.key}
        style={{ flex: 1 }}
        layout={reduce ? undefined : LinearTransition.duration(motion.tab.layout)}
        entering={isNew && !reduce ? FadeIn.delay(motion.tab.layout).duration(motion.tab.fade) : undefined}
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={meta.label}
          accessibilityState={{ selected }}
          onPress={() => {
            dismissTip('inti');
            visitTab(name);
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigateToTab(route.key);
          }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          {/* Tab aktif: hijau brand di atas penanda hijau lembut 60×32. */}
          <View
            style={{
              width: 60,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.brandSoft : 'transparent',
            }}
          >
            <Icon name={meta.icon} size={24} color={color} />
            {isNew ? (
              <View
                testID={`tab-baru-${name}`}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 13,
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
      </Animated.View>
    );
  };

  return (
    <View
      testID="bilah-tab"
      accessibilityRole="tablist"
      style={{
        height: TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        backgroundColor: c.tabbar,
        // Agenda: kolom Tambah menempel di atas bilah (satu permukaan), jadi tanpa garis pemisah.
        borderTopWidth: activeName === 'agenda' ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: c.line,
        overflow: 'visible',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>{left.map(tab)}</View>
      <View style={{ width: INTI_SLOT, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <IntiDock big={onBeranda} size={big} halo={onBeranda && tip.visible} paused={!live} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>{right.map(tab)}</View>
    </View>
  );
}

/**
 * Inti di slot tengah. Digambar seukuran Beranda dan dikecilkan untuk tab lain, supaya peralihannya halus (skala dan
 * naik 280 ms); di Beranda pusatnya tepat di garis atas bilah.
 */
function IntiDock({ big, size, halo, paused }: { big: boolean; size: number; halo: boolean; paused: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(big ? 1 : 0);
  useEffect(() => {
    const to = big ? 1 : 0;
    p.set(reduce ? to : withTiming(to, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [big, reduce, p]);
  const small = INTI_SIZE.tab / size;
  const lift = TAB_BAR_HEIGHT / 2;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift * p.get() }, { scale: small + (1 - small) * p.get() }],
  }));
  return (
    <Animated.View testID={big ? 'inti-beranda' : 'inti-tab'} style={[{ width: size, height: size }, style]}>
      <IntiButton size={size} halo={halo} paused={paused} />
    </Animated.View>
  );
}
