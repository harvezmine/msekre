// Remote speaker: satu niat, memutar musik; sampul dan judul di atas, putar/jeda besar dan volume di zona jempol.
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Icon } from '../Icon';
import { ChoiceSheet } from '../kit/ChoiceSheet';
import { byLayout } from '../kit/layout';
import type { MoreItem } from '../kit/MoreSheet';
import { PressableScale } from '../kit/PressableScale';
import { RemoteKey } from '../kit/RemoteKey';
import { Slider } from '../kit/Slider';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { capOf } from './caps';
import { CoverArt } from './CoverArt';
import { useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function SpeakerRemote() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { device, control, adjust, mediaUrl } = useRemote();
  const sizes = useRemoteSizes();
  const [sourceOpen, setSourceOpen] = useState(false);
  const s = deviceStateOf(device);
  const power = capOf(device, 'power');
  const on = power ? (s.on ?? device.on) : true;
  const playback = capOf(device, 'playback');
  const volume = capOf(device, 'volume');
  const mute = capOf(device, 'mute');
  const source = capOf(device, 'source');
  const playing = on && s.playing === true;
  const title = s.track?.title;
  const cover = Math.min(width - 40, byLayout(sizes.cls, { compact: 168, regular: 240, tall: 288 }));

  const play = () => {
    if (playing) return void control({ playback: 'pause' });
    // Speaker mati: putar sekaligus menyalakannya.
    void control(power && !on ? { on: true, playback: 'play' } : { playback: 'play' });
  };

  const more: MoreItem[] = [];
  if (source) {
    more.push({
      icon: 'bt',
      label: 'Sumber',
      value: source.options.find((o) => o.id === s.source)?.label ?? '-',
      onPress: () => setSourceOpen(true),
    });
  }
  if (mute) {
    more.push({
      icon: 'speakerOff',
      label: 'Bisu',
      control: <Toggle label="Bisu" value={s.muted === true} onChange={(v) => void control({ muted: v })} />,
    });
  }
  if (power) {
    more.push({
      icon: 'power',
      label: 'Daya',
      tone: on ? 'brand' : 'neutral',
      control: <Toggle label="Daya" value={on} onChange={(v) => void control({ on: v })} />,
    });
  }

  const top = (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: sizes.lead,
        gap: byLayout(sizes.cls, { compact: 14, regular: 20, tall: 28 }),
      }}
    >
      <CoverArt
        title={title ?? device.name}
        artMediaId={s.track?.artMediaId}
        mediaUrl={mediaUrl}
        size={cover}
        dimmed={!on}
        style={{ alignSelf: 'center' }}
      />
      <View style={{ gap: 2 }}>
        <Txt v="headline" numberOfLines={2} color={on ? c.text : c.muted}>
          {on ? (title ?? 'Siap memutar') : 'Mati'}
        </Txt>
        {on && s.track?.artist ? (
          <Txt v="row" numberOfLines={1} color={c.muted}>
            {s.track.artist}
          </Txt>
        ) : null}
      </View>
    </View>
  );

  const skip = (dir: 'prev' | 'next') => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Sebelumnya' : 'Berikutnya'}
      onPress={() => void control({ playback: dir })}
      haptic="light"
      hapticOnPressIn
      scaleTo={motion.press.keyScale}
      disabled={!on}
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: on ? 1 : 0.4,
      }}
    >
      <Icon name={dir === 'prev' ? 'skipBack' : 'skipFwd'} size={30} color={c.text} />
    </PressableScale>
  );

  const bottom = (
    <View style={{ paddingHorizontal: 20, gap: byLayout(sizes.cls, { compact: 18, regular: 28, tall: 32 }) }}>
      {playback ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
          {skip('prev')}
          <RemoteKey
            testID="putar-jeda"
            label={playing ? 'Jeda' : 'Putar'}
            icon={playing ? 'pause' : 'play'}
            variant="ink"
            size={92}
            onPress={play}
          />
          {skip('next')}
        </View>
      ) : null}
      {volume && s.volume !== undefined ? (
        <Slider
          testID="volume"
          label="Volume"
          icon={s.muted ? 'speakerOff' : 'speakerLo'}
          value={s.volume}
          min={volume.min}
          max={volume.max}
          step={volume.step}
          onChange={(v) => void adjust({ volume: v })}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <RemoteFrame top={top} bottom={bottom} more={more} />
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
