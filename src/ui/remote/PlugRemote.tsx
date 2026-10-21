// Remote colokan: satu niat, menyalakan atau mematikan; pemakaian listrik sekarang sebagai angka besar dan satu tombol daya
// raksasa di zona jempol.
import { useState } from 'react';
import { View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { BigNumber } from '../kit/BigNumber';
import { ChoiceSheet } from '../kit/ChoiceSheet';
import { byLayout } from '../kit/layout';
import type { MoreItem } from '../kit/MoreSheet';
import { Txt } from '../Txt';
import { decimal } from '../device/present';
import { capOf, timerChoices, timerValue } from './caps';
import { PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function PlugRemote() {
  const { c } = useTheme();
  const { device, control } = useRemote();
  const sizes = useRemoteSizes();
  const [timerOpen, setTimerOpen] = useState(false);
  const s = deviceStateOf(device);
  const on = s.on ?? device.on;
  const power = capOf(device, 'power');
  const energy = capOf(device, 'energy');
  const timer = capOf(device, 'timer');
  const watts = energy && s.powerW !== undefined ? s.powerW : undefined;

  const more: MoreItem[] = timer
    ? [{ icon: 'clock', label: 'Timer', value: timerValue(s.timerMinutes), onPress: () => setTimerOpen(true) }]
    : [];

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead + 40, gap: 8 }}>
      {watts !== undefined ? (
        <BigNumber
          testID="daya-listrik"
          value={decimal(on ? watts : 0)}
          unit="W"
          size={byLayout(sizes.cls, { compact: 72, regular: 88, tall: 96 })}
          color={on ? c.text : c.muted}
          accessibilityLabel={`${decimal(on ? watts : 0)} watt`}
        />
      ) : (
        <Txt v="headline" color={on ? c.brandInk : c.muted}>
          {on ? 'Nyala' : 'Mati'}
        </Txt>
      )}
      {energy && s.energyTodayKWh !== undefined ? (
        <View testID="energi-hari-ini" style={{ alignItems: 'center', paddingTop: 20 }}>
          <BigNumber
            value={decimal(s.energyTodayKWh)}
            unit="kWh"
            size={40}
            color={c.text}
            accessibilityLabel={`Hari ini ${decimal(s.energyTodayKWh)} kWh`}
          />
          <Txt v="label" color={c.muted}>
            Hari ini
          </Txt>
        </View>
      ) : null}
    </View>
  );

  const bottom = power ? (
    <View style={{ alignItems: 'center' }}>
      <PowerKey
        size={byLayout(sizes.cls, { compact: 104, regular: 120, tall: 124 })}
        on={on}
        onPress={() => void control({ on: !on })}
      />
    </View>
  ) : null;

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
