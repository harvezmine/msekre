// Remote kipas angin: satu niat, mengatur kencang angin; kipas yang berputar di atas, kecepatan, ayun, dan daya di zona
// jempol.
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { ChoiceSheet } from '../kit/ChoiceSheet';
import type { MoreItem } from '../kit/MoreSheet';
import { RemoteKey } from '../kit/RemoteKey';
import { Txt } from '../Txt';
import { capOf, fanOrder, isAutoOption, timerChoices, timerValue } from './caps';
import { FanBars, PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function FanRemote() {
  const { c } = useTheme();
  const { device, control } = useRemote();
  const sizes = useRemoteSizes();
  const [timerOpen, setTimerOpen] = useState(false);
  const s = deviceStateOf(device);
  const on = s.on ?? device.on;
  const power = capOf(device, 'power');
  const fan = capOf(device, 'fan');
  const swing = capOf(device, 'swing');
  const timer = capOf(device, 'timer');
  const options = fan ? fanOrder(fan.options) : [];
  const levels = options.filter((o) => !isAutoOption(o));
  const level = levels.findIndex((o) => o.id === s.fan) + 1;

  const more: MoreItem[] = timer
    ? [{ icon: 'clock', label: 'Timer', value: timerValue(s.timerMinutes), onPress: () => setTimerOpen(true) }]
    : [];

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead + 24, gap: 20 }}>
      <Spinner on={on} speed={levels.length > 0 ? Math.max(1, level) / levels.length : 0.6} />
      <Txt v="headline" color={on ? c.brandInk : c.muted}>
        {on ? 'Nyala' : 'Mati'}
      </Txt>
    </View>
  );

  const bottom = (
    <View style={{ alignItems: 'center', gap: sizes.cls === 'compact' ? 20 : 32 }}>
      {options.length > 0 ? (
        <View testID="kecepatan" style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
          {options.map((o) => {
            const selected = o.id === s.fan;
            const short = /\d+$/.exec(o.label)?.[0] ?? o.label;
            return (
              <RemoteKey
                key={o.id}
                label={o.label}
                caption={short}
                size={sizes.side - 4}
                variant={selected ? 'selected' : 'neutral'}
                selected={selected}
                // Memilih kecepatan saat mati sekaligus menyalakan kipas.
                onPress={() => void control(on || !power ? { fan: o.id } : { fan: o.id, on: true })}
              >
                {isAutoOption(o) ? (
                  <Icon name="auto" size={26} color={selected ? c.brandInk : c.text} />
                ) : (
                  <FanBars level={levels.indexOf(o) + 1} total={levels.length} active />
                )}
              </RemoteKey>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        {swing ? (
          <RemoteKey
            label="Ayun"
            caption="Ayun"
            icon="swing"
            size={sizes.key}
            variant={s.swing ? 'selected' : 'neutral'}
            selected={s.swing === true}
            onPress={() => void control({ swing: !s.swing })}
          />
        ) : null}
        {power ? <PowerKey size={sizes.power} on={on} onPress={() => void control({ on: !on })} /> : null}
        {swing ? <View style={{ width: sizes.key }} /> : null}
      </View>
    </View>
  );

  return (
    <>
      <RemoteFrame top={top} bottom={bottom} more={more} />
      {timer ? (
        <ChoiceSheet
          visible={timerOpen}
          title="Timer"
          choices={timerChoices(timer.maxMinutes)}
          value={String(s.timerMinutes ?? 0)}
          onPick={(id) => void control({ timerMinutes: Number(id) })}
          onClose={() => setTimerOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Baling-baling yang berputar selagi menyala (lebih cepat di kecepatan tinggi); berhenti saat mati, tidak fokus, atau "kurangi gerakan". */
function Spinner({ on, speed }: { on: boolean; speed: number }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const focused = useIsFocused();
  const turn = useSharedValue(0);
  const spinning = on && focused && !reduce;
  useEffect(() => {
    if (!spinning) {
      cancelAnimation(turn);
      return;
    }
    turn.set(0);
    turn.set(withRepeat(withTiming(360, { duration: Math.round(2400 / speed), easing: Easing.linear }), -1));
    return () => cancelAnimation(turn);
  }, [spinning, speed, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  return (
    <View
      testID="baling"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 168,
        height: 168,
        borderRadius: 84,
        backgroundColor: on ? c.brandSoft : c.sunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={style}>
        <Icon name="fan" size={96} color={on ? c.brandInk : c.muted} strokeWidth={1.4} />
      </Animated.View>
    </View>
  );
}
