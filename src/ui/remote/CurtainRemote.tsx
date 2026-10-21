// Remote tirai: satu niat, membuka atau menutup; jendela bergambar dan persen di kiri, penggeser tegak di kanan, Tutup dan
// Buka di zona jempol.
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { BigNumber } from '../kit/BigNumber';
import { byLayout } from '../kit/layout';
import { RemoteKey } from '../kit/RemoteKey';
import { Slider } from '../kit/Slider';
import { Txt } from '../Txt';
import { capOf } from './caps';
import { useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

export function CurtainRemote() {
  const { c } = useTheme();
  const { device, control, adjust } = useRemote();
  const sizes = useRemoteSizes();
  const s = deviceStateOf(device);
  const position = capOf(device, 'position');
  const pos = s.position ?? (device.on ? 100 : 0);
  const length = byLayout(sizes.cls, { compact: 260, regular: 360, tall: 420 });
  const art = byLayout(sizes.cls, { compact: 120, regular: 150, tall: 168 });

  const top = (
    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: sizes.lead, gap: 16 }}>
      <View style={{ flex: 1, justifyContent: 'space-between', minHeight: position ? length : art * 1.6 }}>
        <Window size={art} open={pos / 100} />
        {position ? (
          <BigNumber
            testID="posisi"
            value={pos}
            unit="%"
            size={byLayout(sizes.cls, { compact: 64, regular: 80, tall: 88 })}
            style={{ marginBottom: 8, marginLeft: 4 }}
          />
        ) : (
          <Txt v="headline" color={device.on ? c.brandInk : c.muted}>
            {device.on ? 'Terbuka' : 'Tertutup'}
          </Txt>
        )}
      </View>
      {position ? (
        <Slider
          testID="penggeser-tirai"
          orientation="vertical"
          fill="brand"
          endIcons={null}
          length={length}
          label="Bukaan tirai"
          value={pos}
          valueText={(v) => `${v}%`}
          onChange={(v) => void adjust({ position: v })}
        />
      ) : null}
    </View>
  );

  const bottom = position ? (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 48 }}>
      <RemoteKey label="Tutup" size={sizes.side} onPress={() => void control({ position: 0 })} disabled={pos === 0}>
        <Txt v="label">Tutup</Txt>
      </RemoteKey>
      <RemoteKey label="Buka" size={sizes.side} onPress={() => void control({ position: 100 })} disabled={pos === 100}>
        <Txt v="label">Buka</Txt>
      </RemoteKey>
    </View>
  ) : null;

  return <RemoteFrame top={top} bottom={bottom} />;
}

/** Jendela dengan dua tirai yang bergeser ke samping sesuai bukaan (0 tertutup, 1 terbuka). Hiasan. */
function Window({ size, open }: { size: number; open: number }) {
  const { c, marker } = useTheme();
  const w = size;
  const h = size * 1.2;
  const pad = 10;
  const half = (w - pad * 2) / 2;
  const panel = Math.max(10, half * (1 - open * 0.82));
  const fold = (x: number, width: number) => {
    const n = 3;
    const step = width / n;
    let d = `M${x} ${pad}`;
    for (let i = 1; i <= n; i++) d += ` Q${x + step * (i - 0.5)} ${pad + 6} ${x + step * i} ${pad}`;
    d += ` L${x + width} ${h - 6} L${x} ${h - 6} Z`;
    return d;
  };
  return (
    <View testID="gambar-tirai" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h}>
        <Rect x={pad} y={pad} width={w - pad * 2} height={h - pad - 6} rx={12} fill={c.sunken} />
        <Rect
          x={pad + 8}
          y={pad + 8}
          width={w - pad * 2 - 16}
          height={h - pad - 22}
          rx={8}
          fill={marker.terhubung.base}
          opacity={0.18}
        />
        <Path d={fold(pad, panel)} fill={c.sunken2} />
        <Path d={fold(w - pad - panel, panel)} fill={c.sunken2} />
        <Rect x={2} y={4} width={w - 4} height={6} rx={3} fill={c.muted} />
      </Svg>
    </View>
  );
}
