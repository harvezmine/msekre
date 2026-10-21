import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, type Scheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import {
  AccentIcon,
  AreaChart,
  BigNumber,
  Dial,
  Enter,
  GradientField,
  HScroller,
  ListRow,
  MoreSheet,
  RemoteKey,
  Rocker,
  SectionHeader,
  Segmented,
  Slider,
  Sparkline,
  Surface,
  TimeRail,
  TimeStrip,
} from '@/ui/kit';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';

const SCHEMES = ['Ikuti HP', 'Terang', 'Gelap'] as const;
type SchemeLabel = (typeof SCHEMES)[number];

const ITEMS = [
  { id: '1', time: '09.00', title: 'Rapat supplier', icon: 'note' as const, state: 'past' as const },
  { id: '2', time: '13.00', title: 'Bayar listrik', icon: 'call' as const, state: 'next' as const },
  { id: '3', time: '15.00', title: 'Cek stok', icon: 'task' as const },
];

/** Katalog komponen Fase R untuk pengembang (build pengembangan saja): semua komponen dasar di terang dan gelap. */
export default function KitDemo() {
  const [label, setLabel] = useState<SchemeLabel>('Ikuti HP');
  if (!__DEV__) return <Redirect href="/" />;
  const scheme: Scheme | undefined = label === 'Gelap' ? 'dark' : label === 'Terang' ? 'light' : undefined;
  const catalog = <Catalog label={label} onLabel={setLabel} />;
  // "Ikuti HP": tema aplikasi; Terang/Gelap: dipaksa untuk halaman ini saja.
  return scheme ? <ThemeProvider scheme={scheme}>{catalog}</ThemeProvider> : catalog;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Catalog({ label, onLabel }: { label: SchemeLabel; onLabel: (l: SchemeLabel) => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [temp, setTemp] = useState(24);
  const [volume, setVolume] = useState(58);
  const [lamp, setLamp] = useState(80);
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState<'Dingin' | 'Kering' | 'Kipas'>('Dingin');
  const [swing, setSwing] = useState(true);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <GradientField recipe="hero" />
      <BackHeader title="Komponen" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 32 }}>
        <Segmented options={SCHEMES} value={label} onChange={onLabel} label="Tema" />

        <Enter index={0}>
          <Block title="Warna dan ikon">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <AccentIcon icon="chat" tone="brand" />
              <AccentIcon icon="bulb" tone="on" />
              <AccentIcon icon="calendar" tone="agenda" />
              <AccentIcon icon="snow" tone="rumah" />
              <AccentIcon icon="store" tone="usaha" />
              <AccentIcon icon="link" tone="terhubung" />
              <AccentIcon icon="logout" tone="warn" />
              <AccentIcon icon="help" />
            </View>
          </Block>
        </Enter>

        <Enter index={1}>
          <Block title="Permukaan">
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Surface variant="on" padding={16} style={{ flex: 1, minHeight: 120, justifyContent: 'space-between' }}>
                <AccentIcon icon="snow" tone="on" />
                <View>
                  <Txt v="subtitle">AC kamar</Txt>
                  <Txt v="caption" weight={600} color={c.brandInk}>
                    24°
                  </Txt>
                </View>
              </Surface>
              <Surface padding={16} style={{ flex: 1, minHeight: 120, justifyContent: 'space-between' }}>
                <AccentIcon icon="tv" />
                <View>
                  <Txt v="subtitle">TV</Txt>
                  <Txt v="caption" color={c.muted}>
                    Mati
                  </Txt>
                </View>
              </Surface>
              <Surface variant="ghost" padding={16} style={{ flex: 1, minHeight: 120 }}>
                <AccentIcon icon="bulb" />
              </Surface>
            </View>
            <Surface variant="raised" padding={20} style={{ gap: 12 }}>
              <Txt v="row" weight={600}>
                Pak Budi
              </Txt>
              <Txt v="bubble" numberOfLines={1} color={c.muted}>
                Sewa tempatnya bisa Rp15 juta, Pak.
              </Txt>
            </Surface>
          </Block>
        </Enter>

        <Enter index={2}>
          <Block title="Angka">
            <BigNumber value={temp} unit="°" />
            <BigNumber value="4,25" prefix="Rp" unit="jt" variant="figure" />
            <Sparkline values={[3.1, 3.6, 2.9, 3.8, 4.4, 4.9, 4.25]} />
            <AreaChart values={[3.1, 3.6, 2.9, 3.8, 4.4, 4.9, 4.25]} accessibilityLabel="Penjualan seminggu" />
          </Block>
        </Enter>

        <Block title="Daftar">
          <View style={{ marginHorizontal: -20 }}>
            <ListRow icon="chat" tone="brand" title="Asisten" value="Nadia" onPress={() => {}} />
            <ListRow icon="bell" tone="agenda" title="Pemberitahuan" value="Nyala" onPress={() => {}} />
            <ListRow icon="help" title="Bantuan" onPress={() => {}} />
          </View>
          <Toggle value={swing} onChange={setSwing} label="Ayun" />
        </Block>

        <Block title="Waktu">
          <View style={{ marginHorizontal: -20 }}>
            <TimeStrip items={ITEMS} now={{ label: '09.41', before: 1 }} />
          </View>
          <TimeRail items={ITEMS} now={{ label: '09.41', before: 1 }} />
        </Block>

        <Block title="Remote">
          <Dial value={temp} onChange={setTemp} label="Suhu AC" modeIcon="snow" sub="Kamar 27°" subIcon="thermo" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' }}>
            {(['Dingin', 'Kering', 'Kipas'] as const).map((m) => (
              <RemoteKey
                key={m}
                label={m}
                caption={m}
                icon={m === 'Dingin' ? 'snow' : m === 'Kering' ? 'drop' : 'fan'}
                variant={mode === m ? 'selected' : 'neutral'}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            <RemoteKey
              label="Turunkan suhu"
              icon="minus"
              size={76}
              onPress={() => setTemp((t) => Math.max(16, t - 1))}
            />
            <RemoteKey
              label="Daya"
              icon="power"
              variant="power"
              on={power}
              size={100}
              onPress={() => setPower(!power)}
            />
            <RemoteKey label="Naikkan suhu" icon="plus" size={76} onPress={() => setTemp((t) => Math.min(30, t + 1))} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Rocker label="VOL" name="Volume" onUp={() => {}} onDown={() => {}} />
            <RemoteKey label="Bisukan" icon="speakerOff" />
            <Rocker label="CH" name="Saluran" upIcon="chevU" downIcon="chevD" onUp={() => {}} onDown={() => {}} />
          </View>
          <Slider
            value={volume}
            onChange={setVolume}
            label="Volume"
            icon="speakerLo"
            showValue
            valueText={(v) => `${v}%`}
          />
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-end' }}>
            <Slider value={lamp} onChange={setLamp} label="Terang lampu" orientation="vertical" length={300} />
            <View style={{ flex: 1, alignItems: 'flex-start', gap: 16 }}>
              <BigNumber value={lamp} unit="%" size={64} />
              <MoreSheet
                items={[
                  { icon: 'swing', label: 'Ayun', control: <Toggle value={swing} onChange={setSwing} label="Ayun" /> },
                  { icon: 'clock', label: 'Timer', value: '22.00', onPress: () => {} },
                ]}
              />
            </View>
          </View>
        </Block>

        <Block title="Geser">
          <View style={{ marginHorizontal: -20 }}>
            <HScroller itemWidth={140}>
              {['Tidur', 'Pulang', 'Pergi', 'Pagi'].map((n) => (
                <Surface key={n} padding={16} style={{ width: 140, height: 72, justifyContent: 'center' }}>
                  <Txt v="subtitle">{n}</Txt>
                </Surface>
              ))}
            </HScroller>
          </View>
        </Block>
      </ScrollView>
    </View>
  );
}
