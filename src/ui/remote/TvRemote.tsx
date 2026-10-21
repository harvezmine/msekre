// Remote TV: satu niat, menonton tanpa repot; D-pad besar di tengah, VOL / bisu / CH di zona jempol, angka di Lainnya.
import { useState } from 'react';
import { View } from 'react-native';
import type { RemoteKey as Key } from '@/api/contract';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { ChoiceSheet } from '../kit/ChoiceSheet';
import { byLayout } from '../kit/layout';
import type { MoreItem } from '../kit/MoreSheet';
import { RemoteKey } from '../kit/RemoteKey';
import { Rocker } from '../kit/Rocker';
import { Txt } from '../Txt';
import { capOf, hasKey } from './caps';
import { DPad } from './DPad';
import { PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

const DIGITS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NAV: { key: Key; icon: 'back' | 'home' | 'menu'; label: string }[] = [
  { key: 'back', icon: 'back', label: 'Kembali di TV' },
  { key: 'home', icon: 'home', label: 'Beranda di TV' },
  { key: 'menu', icon: 'menu', label: 'Menu di TV' },
];

export function TvRemote() {
  const { c } = useTheme();
  const { device, control, adjust } = useRemote();
  const sizes = useRemoteSizes();
  const [sourceOpen, setSourceOpen] = useState(false);
  const s = deviceStateOf(device);
  const on = s.on ?? device.on;
  const power = capOf(device, 'power');
  const source = capOf(device, 'source');
  const volume = capOf(device, 'volume');
  const mute = capOf(device, 'mute');
  const channel = capOf(device, 'channel');
  const keys = capOf(device, 'keys')?.keys ?? [];
  const press = (key: Key) => void control({ key });

  const volUp = hasKey(device, 'vol_up');
  const chUp = hasKey(device, 'ch_up');
  const showVol = volUp || !!volume;
  const showCh = chUp || !!channel;
  const vol = (d: 1 | -1) => {
    if (volUp) return press(d > 0 ? 'vol_up' : 'vol_down');
    if (!volume) return;
    const next = Math.min(volume.max, Math.max(volume.min, (s.volume ?? volume.min) + d * volume.step));
    void adjust({ volume: next });
  };
  const ch = (d: 1 | -1) => {
    if (chUp) return press(d > 0 ? 'ch_up' : 'ch_down');
    void control({ channel: Math.max(1, (s.channel ?? 1) + d) });
  };
  const digits = DIGITS.filter((k) => keys.includes(k));
  const nav = NAV.filter((n) => keys.includes(n.key));
  const dpadKeys = keys.filter((k) => ['up', 'down', 'left', 'right', 'ok'].includes(k));
  // Perangkat mati mengabaikan tombol (selain daya): kontrolnya diredupkan sampai TV dinyalakan.
  const idle = power !== undefined && !on;
  const idleStyle = idle ? { opacity: 0.4 } : null;
  const dpadSize = byLayout(sizes.cls, { compact: 216, regular: 240, tall: 264 });

  const more: MoreItem[] = [];
  const pad =
    digits.length > 0 ? (
      <View testID="papan-angka" style={{ gap: 12, paddingTop: 4 }}>
        {s.channel !== undefined ? (
          <Txt v="label" tabular color={c.muted} style={{ textAlign: 'center' }}>
            {`CH ${s.channel}`}
          </Txt>
        ) : null}
        <View
          style={{
            width: 3 * 60 + 2 * 28,
            alignSelf: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: 28,
            rowGap: 12,
          }}
        >
          {digits.map((k) => (
            <View key={k} style={k === '0' ? { width: '100%', alignItems: 'center' } : null}>
              <RemoteKey label={`Angka ${k}`} size={60} onPress={() => press(k)} disabled={idle}>
                <Txt v="section" tabular style={{ fontSize: 22, lineHeight: 28 }}>
                  {k}
                </Txt>
              </RemoteKey>
            </View>
          ))}
        </View>
      </View>
    ) : undefined;

  const top = (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: sizes.lead / 2,
        gap: byLayout(sizes.cls, { compact: 12, regular: 18, tall: 22 }),
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: sizes.key }}>
        {power ? <PowerKey size={sizes.key} on={on} onPress={() => void control({ on: !on })} /> : <View />}
        {source ? (
          <View style={idleStyle} pointerEvents={idle ? 'none' : 'auto'}>
            <RemoteKey
              label="Sumber"
              icon="input"
              size={sizes.key}
              onPress={() => setSourceOpen(true)}
              disabled={idle}
            />
          </View>
        ) : null}
      </View>
      <View
        style={[{ gap: byLayout(sizes.cls, { compact: 12, regular: 20, tall: 24 }) }, idleStyle]}
        pointerEvents={idle ? 'none' : 'auto'}
      >
        {dpadKeys.length > 0 ? <DPad size={dpadSize} keys={dpadKeys} onKey={press} /> : null}
        {nav.length > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: nav.length > 2 ? 40 : 56 }}>
            {nav.map((n) => (
              <RemoteKey key={n.key} label={n.label} icon={n.icon} size={60} onPress={() => press(n.key)} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  const rockerH = byLayout(sizes.cls, { compact: 184, regular: 212, tall: 224 });
  const bottom =
    showVol || showCh || mute ? (
      <View
        pointerEvents={idle ? 'none' : 'auto'}
        style={[
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34 },
          idleStyle,
        ]}
      >
        {showVol ? (
          <Rocker label="VOL" name="Volume" height={rockerH} onUp={() => vol(1)} onDown={() => vol(-1)} />
        ) : (
          <View />
        )}
        {mute ? (
          <RemoteKey
            label="Bisukan"
            icon="speakerOff"
            size={68}
            variant={s.muted ? 'selected' : 'neutral'}
            selected={s.muted === true}
            onPress={() => void control({ muted: !s.muted })}
          />
        ) : null}
        {showCh ? (
          <Rocker
            label="CH"
            name="Channel"
            upIcon="chevU"
            downIcon="chevD"
            height={rockerH}
            onUp={() => ch(1)}
            onDown={() => ch(-1)}
          />
        ) : (
          <View />
        )}
      </View>
    ) : null;

  return (
    <>
      <RemoteFrame top={top} bottom={bottom} more={more} moreFooter={pad} />
      {source ? (
        <ChoiceSheet
          visible={sourceOpen}
          title="Sumber"
          choices={source.options}
          value={s.source}
          onPick={(id) => void control({ source: id })}
          onClose={() => setSourceOpen(false)}
        />
      ) : null}
    </>
  );
}
