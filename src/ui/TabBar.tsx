import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Inti } from './inti/Inti';
import { Txt } from './Txt';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Beranda', icon: 'home' },
  agenda: { label: 'Agenda', icon: 'calendar' },
  perangkat: { label: 'Perangkat', icon: 'bulb' },
  usaha: { label: 'Usaha', icon: 'store' },
};

/** Beranda · Agenda · [Inti] · Perangkat · Usaha. Inti bukan tab: ketuk membuka chat, tahan membuka Mode Suara. */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { c, scheme } = useTheme();

  const tab = (index: number) => {
    const route = state.routes[index];
    const meta = route && TABS[route.name];
    if (!route || !meta) return null;
    const active = state.index === index;
    const color = active ? c.green : c.muted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: active }}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <Icon name={meta.icon} size={24} color={color} />
        <Txt v="caption" weight={active ? 600 : 500} color={color}>
          {meta.label}
        </Txt>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        height: 88 + insets.bottom,
        paddingBottom: insets.bottom,
        paddingHorizontal: 4,
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {tab(0)}
      {tab(1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bicara dengan ${DEFAULT_ASSISTANT}`}
        accessibilityHint="Ketuk untuk chat, tahan untuk bicara"
        onPress={() => router.push('/chat')}
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/suara');
        }}
        delayLongPress={450}
        style={{ flex: 1, alignItems: 'center', gap: 4, marginTop: -26 }}
      >
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Inti size={50} onDark={scheme === 'dark'} />
        </View>
        <Txt v="caption" weight={600}>
          {DEFAULT_ASSISTANT}
        </Txt>
      </Pressable>
      {tab(2)}
      {tab(3)}
    </View>
  );
}
