// Remote AC: satu niat, membuat ruangan sejuk; suhu raksasa di dial, empat mode di tengah, − / daya / + di zona jempol.
import { useState } from 'react';
import { View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { ChoiceSheet } from '../kit/ChoiceSheet';
import { Dial } from '../kit/Dial';
import type { MoreItem } from '../kit/MoreSheet';
import { RemoteKey } from '../kit/RemoteKey';
import { Segmented } from '../kit/Segmented';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { decimal } from '../device/present';
import { arcFor, capOf, fanOrder, isAutoOption, modeIcon, timerChoices, timerValue } from './caps';
import { FanBars, PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';
import { Icon } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Mode di layar utama paling banyak lima; lebih dari itu pindah ke Lainnya. */
const MAX_MODE_KEYS = 5;

export function AcRemote() {
  const { c } = useTheme();
  const { device, control, adjust } = useRemote();
  const sizes = useRemoteSizes();
  const [timerOpen, setTimerOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const s = deviceStateOf(device);
  const on = s.on ?? device.on;
  const temperature = capOf(device, 'temperature');
  const modes = capOf(device, 'mode');
  const fans = capOf(device, 'fan');
  const swing = capOf(device, 'swing');
  const timer = capOf(device, 'timer');
  const power = capOf(device, 'power');
  const mode = modes?.options.find((o) => o.id === s.mode);
  const arc = arcFor(mode);
  const temp = s.temp ?? temperature?.min;
  const modeKeys = modes && modes.options.length <= MAX_MODE_KEYS ? modes.options : null;

  const setTemp = (t: number) => {
    if (!temperature) return;
    const next = Math.min(temperature.max, Math.max(temperature.min, t));
    if (next !== temp) void adjust({ temp: next });
  };

  const more: MoreItem[] = [];
  if (modes && !modeKeys) {
    more.push({ icon: 'auto', label: 'Mode', value: mode?.label ?? '-', onPress: () => setModeOpen(true) });
  }
  if (fans) {
    const ordered = fanOrder(fans.options);
    const levels = ordered.filter((o) => !isAutoOption(o));
    more.push({
      icon: 'fan',
      label: 'Kipas',
      control: (
        <Segmented
          testID="kecepatan-kipas"
          label="Kecepatan kipas"
          options={ordered.map((o) => o.id)}
          labels={Object.fromEntries(ordered.map((o) => [o.id, o.label]))}
          value={s.fan ?? ''}
          onChange={(fan) => void control({ fan })}
          renderOption={(id, selected) => {
            const o = ordered.find((x) => x.id === id)!;
            if (isAutoOption(o)) return <Icon name="auto" size={22} color={selected ? c.text : c.muted} />;
            return <FanBars level={levels.indexOf(o) + 1} total={levels.length} active={selected} />;
          }}
          style={{ width: Math.min(196, 52 * ordered.length) }}
        />
      ),
    });
  }
  if (swing) {
    more.push({
      icon: 'swing',
      label: 'Ayun',
      control: <Toggle label="Ayun" value={s.swing === true} onChange={(v) => void control({ swing: v })} />,
    });
  }
  if (timer) {
    more.push({ icon: 'clock', label: 'Timer', value: timerValue(s.timerMinutes), onPress: () => setTimerOpen(true) });
  }

  const top = (
    <View style={{ alignItems: 'center', paddingTop: sizes.lead, gap: sizes.cls === 'compact' ? 12 : 28 }}>
      {temperature && temp !== undefined ? (
        <Dial
          testID="putaran-suhu"
          value={temp}
          min={temperature.min}
          max={temperature.max}
          step={temperature.step}
          onChange={setTemp}
          label={`Suhu ${device.name}`}
          arc={arc}
          modeIcon={mode ? modeIcon(mode) : undefined}
          sub={s.roomTemp !== undefined ? `Ruangan ${decimal(s.roomTemp)}°` : undefined}
          subIcon="thermo"
          dimmed={!on}
        />
      ) : (
        <Txt v="headline" color={on ? c.brandInk : c.muted} style={{ paddingTop: 40 }}>
          {on ? (mode?.label ?? 'Nyala') : 'Mati'}
        </Txt>
      )}
      {modeKeys ? (
        <View
          testID="mode-ac"
          style={{ flexDirection: 'row', justifyContent: 'center', gap: modeKeys.length > 4 ? 12 : 22 }}
        >
          {modeKeys.map((o) => {
            const selected = o.id === s.mode;
            return (
              <RemoteKey
                key={o.id}
                label={o.label}
                caption={o.label}
                icon={modeIcon(o)}
                size={sizes.key}
                variant={selected ? 'selected' : 'neutral'}
                selected={selected}
                onPress={() => {
                  if (!selected) void control({ mode: o.id });
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const bottom =
    temperature || power ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        {temperature && temp !== undefined ? (
          <RemoteKey
            label="Turunkan suhu"
            icon="minus"
            size={sizes.side}
            disabled={temp <= temperature.min}
            onPress={() => setTemp(temp - temperature.step)}
          />
        ) : null}
        {power ? <PowerKey size={sizes.power} on={on} onPress={() => void control({ on: !on })} /> : null}
        {temperature && temp !== undefined ? (
          <RemoteKey
            label="Naikkan suhu"
            icon="plus"
            size={sizes.side}
            disabled={temp >= temperature.max}
            onPress={() => setTemp(temp + temperature.step)}
          />
        ) : null}
      </View>
    ) : null;

  return (
    <>
      <RemoteFrame field={on && arc === 'cool' ? 'cool' : undefined} top={top} bottom={bottom} more={more} />
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
      {modes && !modeKeys ? (
        <ChoiceSheet
          visible={modeOpen}
          title="Mode"
          choices={modes.options}
          value={s.mode}
          onPick={(id) => void control({ mode: id })}
          onClose={() => setModeOpen(false)}
        />
      ) : null}
    </>
  );
}
