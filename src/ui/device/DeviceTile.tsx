import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Box, Device } from '@/api/contract';
import { deviceStateOf } from '@/api/devices';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { AccentIcon } from '../kit/AccentIcon';
import { BigNumber } from '../kit/BigNumber';
import { Surface } from '../kit/Surface';
import { Txt } from '../Txt';
import { boxWord, deviceIcon, isLocked, isRecording, tileOn, tileToggles, tileWord, wideTemp } from './present';
import { Snapshot } from './Snapshot';

const A11Y_OPEN = [{ name: 'longpress', label: 'Buka remote' }] as const;

interface Props {
  device: Device;
  /** Lebar ubin (dua kolom) atau lebar penuh (ubin AC dengan angka besar). */
  width: number;
  minHeight: number;
  mediaUrl: (id: string) => Promise<MediaSource>;
  /** Ketuk ubin sakelar: nyala/mati. */
  onToggle: () => void;
  /** Tahan (semua ubin), atau ketuk ubin yang bukan sakelar: buka remote. */
  onOpen: () => void;
}

/**
 * Ubin perangkat besar (§7 Perangkat, papan 16): ikon dalam lingkaran, nama, satu atau dua kata keadaan ("Dingin",
 * "80%", "Vol 18", "Terkunci"). Menyala = hijau (terang: hijau lembut; gelap: arang dengan cahaya hijau di pojok); mati =
 * netral; tidak terjangkau = cincin garis dan "Terputus". AC menyala melebar dengan suhu besar; kamera yang merekam
 * menampilkan gambar terakhirnya. Ketuk ubin sakelar menyalakan/mematikan; ubin lain dan tahan membuka remote.
 */
export function DeviceTile({ device, width, minHeight, mediaUrl, onToggle, onOpen }: Props) {
  const { c, marker } = useTheme();
  const toggles = tileToggles(device);
  const on = tileOn(device);
  const word = tileWord(device);
  const temp = wideTemp(device);
  const s = deviceStateOf(device);
  const name = device.short ?? device.name;
  const picture = device.kind === 'camera' && device.reachable && isRecording(device) && s.snapshotMediaId;
  const locked = device.kind === 'lock' && device.reachable && isLocked(device);
  const iconTone = on ? 'on' : locked ? 'brand' : 'neutral';
  const wordColor = on || locked ? c.brandInk : c.muted;

  const press = toggles
    ? {
        accessibilityRole: 'switch' as const,
        accessibilityLabel: device.name,
        accessibilityState: { checked: device.on },
        accessibilityValue: { text: word },
        accessibilityHint: 'Tahan untuk membuka remote',
        accessibilityActions: A11Y_OPEN,
        onAccessibilityAction: () => onOpen(),
        onPress: onToggle,
        haptic: 'selection' as const,
      }
    : {
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${device.name}, ${word}`,
        accessibilityHint: 'Buka remote',
        onPress: onOpen,
        haptic: 'light' as const,
      };

  if (picture) {
    return (
      <Surface
        testID={`ubin-${device.id}`}
        variant="plain"
        padding={0}
        onLongPress={onOpen}
        {...press}
        style={{ width, minHeight, overflow: 'hidden' }}
      >
        <Snapshot
          mediaId={s.snapshotMediaId!}
          mediaUrl={mediaUrl}
          label={`Gambar terakhir ${device.name}`}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Scrim />
        <View
          testID="titik-rekam"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: marker.warn.base,
            boxShadow: '0 0 0 4px rgba(229,72,77,0.25)',
          }}
        />
        <View pointerEvents="none" style={{ flex: 1, justifyContent: 'flex-end', padding: 16 }}>
          <Txt v="subtitle" numberOfLines={1} color="#FFFFFF" style={{ fontSize: 17 }}>
            {name}
          </Txt>
        </View>
      </Surface>
    );
  }

  const wide = temp !== undefined;
  return (
    <Surface
      testID={`ubin-${device.id}`}
      variant={on ? 'on' : device.reachable ? 'plain' : 'ghost'}
      padding={16}
      onLongPress={onOpen}
      {...press}
      style={[
        { width, minHeight },
        wide ? { flexDirection: 'row', alignItems: 'center', gap: 16 } : { justifyContent: 'space-between' },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <AccentIcon icon={deviceIcon(device)} tone={iconTone} size={46} />
          {!device.reachable ? (
            <View
              testID="titik-tak-terjangkau"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: marker.warn.base,
                borderWidth: 2,
                borderColor: c.bg,
              }}
            />
          ) : null}
        </View>
        {!wide && device.kind === 'speaker' && on && s.playing ? <Equalizer /> : null}
      </View>
      <View style={wide ? { flex: 1, gap: 2 } : { gap: 2, paddingTop: 12 }}>
        <Txt v="subtitle" numberOfLines={2} color={device.reachable ? c.text : c.muted} style={{ fontSize: 17 }}>
          {name}
        </Txt>
        <Txt v="label" tabular numberOfLines={1} color={wordColor}>
          {word}
        </Txt>
      </View>
      {wide ? <BigNumber value={temp} unit="°" size={56} accessibilityLabel={`${temp} derajat`} /> : null}
    </Surface>
  );
}

/** Bayangan gelap di bawah gambar kamera supaya namanya terbaca. */
function Scrim() {
  const id = `redup${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}>
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.6} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Tiga batang hijau di ubin speaker yang sedang memutar (papan 16). Hiasan. */
function Equalizer() {
  const { c } = useTheme();
  return (
    <View
      testID="batang-putar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 24, paddingTop: 4 }}
    >
      {[20, 13, 7, 20].map((h, i) => (
        <View key={i} style={{ width: 5, height: h, borderRadius: 2.5, backgroundColor: c.brandInk }} />
      ))}
    </View>
  );
}

/** Ubin Kotak Sekretaris AI: lingkaran tinta dengan ikon Kotak, keadaan mic. Ketuk atau tahan membuka remote Kotak. */
export function BoxTile({
  box,
  width,
  minHeight,
  onOpen,
}: {
  box: Box;
  width: number;
  minHeight: number;
  onOpen: () => void;
}) {
  const { c } = useTheme();
  const word = boxWord(box);
  return (
    <Surface
      testID="ubin-kotak"
      variant={box.online ? 'plain' : 'ghost'}
      padding={16}
      onPress={onOpen}
      onLongPress={onOpen}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`Kotak Sekretaris AI, ${word}`}
      accessibilityHint="Buka remote"
      style={{ width, minHeight, justifyContent: 'space-between' }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: c.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={box.micOn ? 'box' : 'micOff'} size={22} color={c.bg} />
      </View>
      <View style={{ gap: 2, paddingTop: 12 }}>
        <Txt v="subtitle" numberOfLines={2} style={{ fontSize: 17 }}>
          Kotak
        </Txt>
        <Txt v="label" color={box.online && box.micOn ? c.brandInk : c.muted}>
          {word}
        </Txt>
      </View>
    </Surface>
  );
}
