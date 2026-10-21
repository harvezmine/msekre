// Remote lampu: satu niat, mengatur terang; bola lampu bercahaya dan angka di kiri, penggeser tegak di kanan, daya di zona
// jempol.
import { useId } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { AccentIcon } from '../kit/AccentIcon';
import { BigNumber } from '../kit/BigNumber';
import { haptic } from '../kit/haptics';
import { byLayout } from '../kit/layout';
import type { MoreItem } from '../kit/MoreSheet';
import { Segmented } from '../kit/Segmented';
import { Slider } from '../kit/Slider';
import { Txt } from '../Txt';
import { capOf, capsOf } from './caps';
import { colorTempChoices, lightTint } from './light';
import { PowerKey, useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function LampRemote() {
  const { c } = useTheme();
  const { device, control, adjust } = useRemote();
  const sizes = useRemoteSizes();
  const insets = useSafeAreaInsets();
  const s = deviceStateOf(device);
  const on = s.on ?? device.on;
  const power = capOf(device, 'power');
  const brightness = capOf(device, 'brightness');
  const colorTemp = capOf(device, 'colorTemp');
  const color = capOf(device, 'color');
  const level = s.brightness ?? (brightness ? brightness.max : 100);
  const tint = lightTint(s, capsOf(device));
  const glow = on ? Math.max(0.15, level / 100) : 0;
  const length = byLayout(sizes.cls, { compact: 280, regular: 380, tall: 440 });
  const bulb = byLayout(sizes.cls, { compact: 104, regular: 124, tall: 136 });

  const more: MoreItem[] = [];
  if (colorTemp) {
    const choices = colorTempChoices(colorTemp.minK, colorTemp.maxK);
    const current =
      s.colorTemp === undefined || s.color
        ? ''
        : choices.reduce((a, b) => (Math.abs(b.k - s.colorTemp!) < Math.abs(a.k - s.colorTemp!) ? b : a)).id;
    more.push({
      icon: 'sun',
      label: 'Suhu',
      control: (
        <Segmented
          label="Suhu warna"
          options={choices.map((ch) => ch.id)}
          labels={Object.fromEntries(choices.map((ch) => [ch.id, ch.label]))}
          value={current}
          onChange={(id) => void control({ colorTemp: choices.find((ch) => ch.id === id)!.k })}
          style={{ width: 228 }}
        />
      ),
    });
  }
  const swatches = color ? (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <AccentIcon icon="palette" size={44} />
        <Txt v="row">Warna</Txt>
      </View>
      <View
        testID="pilihan-warna"
        accessibilityRole="radiogroup"
        accessibilityLabel="Warna"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingLeft: 60 }}
      >
        {color.presets.map((p) => {
          const picked = s.color === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityLabel={p.label}
              accessibilityState={{ checked: picked }}
              onPress={() => {
                haptic('selection');
                if (!picked) void control({ color: p.id });
              }}
              hitSlop={4}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: p.hex,
                boxShadow: picked
                  ? `inset 0 0 0 2px ${c.surface}, 0 0 0 2.5px ${c.brand}`
                  : `inset 0 0 0 1px ${c.line}`,
              }}
            />
          );
        })}
      </View>
    </View>
  ) : undefined;

  const top = (
    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: sizes.lead, gap: 16 }}>
      <View style={{ flex: 1, justifyContent: 'space-between', minHeight: brightness ? length : bulb * 2 }}>
        <Bulb size={bulb} glow={glow} tint={tint} />
        {brightness ? (
          <BigNumber
            testID="terang"
            value={on ? level : 0}
            unit="%"
            size={byLayout(sizes.cls, { compact: 64, regular: 80, tall: 88 })}
            color={on ? c.text : c.muted}
            style={{ marginBottom: 8, marginLeft: 8 }}
          />
        ) : (
          <Txt v="headline" color={on ? c.brandInk : c.muted} style={{ marginLeft: 8 }}>
            {on ? 'Nyala' : 'Mati'}
          </Txt>
        )}
      </View>
      {brightness ? (
        <Slider
          testID="penggeser-terang"
          orientation="vertical"
          length={length}
          label="Terang"
          value={level}
          min={brightness.min}
          max={brightness.max}
          valueText={(v) => `${v}%`}
          warmColors={tint.stops}
          onChange={(v) => {
            // Menggeser lampu yang mati sekaligus menyalakannya (sekali), lalu terangnya dikirim setelah jeda.
            if (!on && power) void control({ on: true });
            void adjust({ brightness: v });
          }}
        />
      ) : null}
    </View>
  );

  const bottom = power ? (
    <View style={{ alignItems: 'center' }}>
      <PowerKey size={sizes.power} on={on} onPress={() => void control({ on: !on })} />
    </View>
  ) : null;

  // Pusat kaca bola lampu di layar: kepala 64, jarak atas, lalu 0,47 × lebar bola (lihat viewBox Bulb).
  const halo =
    glow > 0 ? (
      <Halo
        x={20 + 8 + bulb / 2}
        y={insets.top + 64 + sizes.lead + bulb * 0.47}
        radius={bulb * 1.45}
        glow={glow}
        color={tint.glow}
      />
    ) : null;
  return (
    <RemoteFrame
      field={on ? 'warm' : undefined}
      backdrop={halo}
      top={top}
      bottom={bottom}
      more={more}
      moreFooter={swatches}
    />
  );
}

/**
 * Cahaya radial di sekitar bola lampu (§1.4 "Lamp": `rgba(255,196,96,.55·b)` → `.22·b` → 0), sebagai latar bingkai supaya
 * tidak terpotong tepi gulir. `x`, `y` = pusat kaca bola lampu di layar.
 */
function Halo({ x, y, radius, glow, color }: { x: number; y: number; radius: number; glow: number; color: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      testID="cahaya-lampu"
      pointerEvents="none"
      style={{ position: 'absolute', left: x - radius, top: y - radius, width: radius * 2, height: radius * 2 }}
    >
      <Svg width={radius * 2} height={radius * 2}>
        <Defs>
          <RadialGradient id={`halo${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55 * glow} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.22 * glow} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={radius} cy={radius} rx={radius} ry={radius} fill={`url(#halo${uid})`} />
      </Svg>
    </View>
  );
}

/** Bola lampu (§1.4): kaca bergradasi warna cahayanya dan kawat pijar; mati: kaca netral. Hiasan. */
function Bulb({
  size,
  glow,
  tint,
}: {
  size: number;
  /** 0 (mati) – 1 (terang penuh). */
  glow: number;
  tint: ReturnType<typeof lightTint>;
}) {
  const { c } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const w = size;
  const h = size * 1.45;
  const lit = glow > 0;
  return (
    <View
      testID="bola-lampu"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: w, height: h, marginLeft: 8 }}
    >
      <Svg width={w} height={h} viewBox="0 0 100 145">
        <Defs>
          <RadialGradient id={`kaca${uid}`} cx="50%" cy="40%" r="60%">
            <Stop offset="0" stopColor={lit ? tint.core : c.surface} />
            <Stop offset="1" stopColor={lit ? tint.stops[1] : c.sunken2} />
          </RadialGradient>
        </Defs>
        <Path
          d="M50 4C25.7 4 6 23.2 6 47c0 13.6 6.6 23.6 14.5 32.4C26 85.5 29 91 29 98h42c0-7 3-12.5 8.5-18.6C87.4 70.6 94 60.6 94 47 94 23.2 74.3 4 50 4z"
          fill={`url(#kaca${uid})`}
          stroke={lit ? 'transparent' : c.line}
          strokeWidth={1.5}
        />
        <Path
          d="M36 92 L42 60 Q50 48 58 60 L64 92"
          fill="none"
          stroke={lit ? tint.stops[2] : c.faint}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={lit ? 0.85 : 1}
        />
        <Rect x={30} y={102} width={40} height={11} rx={5.5} fill={c.sunken2} />
        <Rect x={32} y={116} width={36} height={11} rx={5.5} fill={c.sunken2} />
        <Path d="M38 130h24l-4 11H42z" fill={c.sunken2} />
      </Svg>
    </View>
  );
}
