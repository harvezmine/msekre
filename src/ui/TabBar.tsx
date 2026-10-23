import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';
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
  const { c } = useTheme();
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
          onPress={() => inPlace.close()}
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
