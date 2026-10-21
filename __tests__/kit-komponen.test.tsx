import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getAnimatedStyle as animatedStyle } from 'react-native-reanimated';
import { ThemeProvider, type Scheme } from '@/theme/ThemeProvider';
import { dark, light } from '@/theme/tokens';
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
  PressableScale,
  RemoteKey,
  Rocker,
  SectionHeader,
  Segmented,
  Slider,
  Sparkline,
  Surface,
  ThumbZone,
  TimeRail,
  TimeStrip,
  byLayout,
  layoutClassFor,
  toneForName,
  useLayoutClass,
} from '@/ui/kit';
import { Toggle } from '@/ui/Toggle';

type AnimatedStyle = { opacity?: number; transform?: Record<string, number>[] };
const getAnimatedStyle = animatedStyle as unknown as (el: unknown) => AnimatedStyle;

beforeEach(() => jest.clearAllMocks());

function wrap(ui: ReactNode, scheme: Scheme = 'light') {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </GestureHandlerRootView>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

const action = (name: 'increment' | 'decrement') => ({ nativeEvent: { actionName: name } });
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};

describe('PressableScale', () => {
  test('peran dan label diteruskan, getar saat ditekan, mengecil ke 0,97 saat ditahan', async () => {
    const onPress = jest.fn();
    await wrap(
      <PressableScale accessibilityRole="button" accessibilityLabel="Simpan" haptic="selection" onPress={onPress}>
        <Text>Simpan</Text>
      </PressableScale>,
    );
    const btn = screen.getByRole('button', { name: 'Simpan' });
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    await fireEvent(btn, 'pressIn');
    await advance(600);
    expect(getAnimatedStyle(btn).transform?.[0]?.scale).toBeCloseTo(0.97, 2);
    await fireEvent(btn, 'pressOut');
    await advance(600);
    expect(getAnimatedStyle(btn).transform?.[0]?.scale).toBeCloseTo(1, 2);
  });
});

describe('Surface', () => {
  test('polos memakai permukaan + bayangan tanpa garis tepi; menyala memakai hijau lembut', async () => {
    await wrap(
      <>
        <Surface testID="polos" />
        <Surface testID="nyala" variant="on" />
        <Surface testID="hilang" variant="ghost" />
      </>,
    );
    const plain = flat(screen.getByTestId('polos'));
    expect(plain).toMatchObject({ backgroundColor: light.surface, borderRadius: 26 });
    expect(plain.boxShadow).toBeTruthy();
    expect(plain.borderWidth).toBeUndefined();
    expect(flat(screen.getByTestId('nyala'))).toMatchObject({ backgroundColor: light.brandSoft });
    expect(screen.queryByTestId('cahaya-nyala')).not.toBeOnTheScreen();
    expect(String(flat(screen.getByTestId('hilang')).boxShadow)).toContain('inset');
  });

  test('menyala di mode gelap: tetap arang, dengan cahaya hijau di pojok (tanpa permukaan hijau)', async () => {
    await wrap(<Surface testID="nyala" variant="on" />, 'dark');
    expect(flat(screen.getByTestId('nyala'))).toMatchObject({ backgroundColor: dark.surface });
    expect(screen.getByTestId('cahaya-nyala')).toBeOnTheScreen();
  });

  test('bisa ditekan: tombol dengan label', async () => {
    const onPress = jest.fn();
    await wrap(<Surface onPress={onPress} accessibilityLabel="AC kamar" haptic="light" />);
    await fireEvent.press(screen.getByRole('button', { name: 'AC kamar' }));
    expect(onPress).toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });
});

test('AccentIcon: warna kategori hanya pada ikon di lingkaran netral; brand dan menyala hijau; tersembunyi', async () => {
  await wrap(
    <>
      <AccentIcon icon="calendar" tone="agenda" size={48} />
      <AccentIcon icon="chat" tone="brand" />
      <AccentIcon icon="bulb" tone="on" />
    </>,
  );
  const blue = screen.getByTestId('aksen-calendar', { includeHiddenElements: true });
  expect(flat(blue)).toMatchObject({ width: 48, height: 48, borderRadius: 24, backgroundColor: light.sunken });
  expect(screen.getByTestId('ikon-calendar', { includeHiddenElements: true }).props.stroke).toBe('#2F5BC4');
  expect(flat(screen.getByTestId('aksen-chat', { includeHiddenElements: true }))).toMatchObject({
    backgroundColor: light.brandSoft,
  });
  expect(flat(screen.getByTestId('aksen-bulb', { includeHiddenElements: true }))).toMatchObject({
    backgroundColor: light.brand,
  });
  expect(screen.queryByTestId('aksen-calendar')).not.toBeOnTheScreen();
});

test('SectionHeader: judul sebagai header, aksi tautan hijau atau hanya ikon', async () => {
  const onPress = jest.fn();
  await wrap(
    <>
      <SectionHeader title="Hari ini" action={{ label: 'Agenda', onPress }} />
      <SectionHeader title="Rumah" action={{ label: 'Semua perangkat', onPress, iconOnly: true }} />
    </>,
  );
  expect(screen.getByRole('header', { name: 'Hari ini' })).toBeOnTheScreen();
  expect(screen.getByText('Agenda')).toHaveStyle({ color: light.brandInk });
  await fireEvent.press(screen.getByRole('button', { name: 'Semua perangkat' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Semua perangkat')).not.toBeOnTheScreen();
});

test('GradientField: elips cahaya per resep, tanpa menangkap sentuhan', async () => {
  await wrap(<GradientField recipe="hero" />, 'dark');
  const field = screen.getByTestId('gradasi-hero', { includeHiddenElements: true });
  expect(field.props.pointerEvents).toBe('none');
  expect(flat(field)).toMatchObject({ position: 'absolute', height: 460 });
});

test('BigNumber: dibaca lengkap dengan satuan, angka tabular, berganti dengan animasi', async () => {
  function Demo() {
    const [v, setV] = useState(24);
    return (
      <>
        <BigNumber value={v} unit="°" testID="angka" />
        <Text onPress={() => setV(25)}>naik</Text>
      </>
    );
  }
  await wrap(<Demo />);
  expect(screen.getByLabelText('24°')).toBeOnTheScreen();
  const num = screen.getByText('24');
  expect(flat(num)).toMatchObject({ fontVariant: ['tabular-nums'], fontFamily: 'PlusJakartaSans_300Light' });
  expect(num.props.maxFontSizeMultiplier).toBe(1.1);
  await fireEvent.press(screen.getByText('naik'));
  expect(screen.getByLabelText('25°')).toBeOnTheScreen();
  // Angka baru masuk dari bawah; sesudah 160 ms sudah di tempat.
  await advance(300);
  expect(getAnimatedStyle(screen.getByText('25')).opacity).toBe(1);
});

test('HScroller: geser mendatar dengan berhenti per butir', async () => {
  await wrap(
    <HScroller itemWidth={122} testID="deret">
      <Text>A</Text>
      <Text>B</Text>
    </HScroller>,
  );
  const s = screen.getByTestId('deret');
  expect(s.props.horizontal).toBe(true);
  expect(s.props.snapToInterval).toBe(122 + 12);
});

test('Segmented: tab dengan keadaan terpilih, berganti dengan getar, tinggi lega', async () => {
  function Demo() {
    const [v, setV] = useState<'Hari ini' | 'Minggu'>('Hari ini');
    return <Segmented options={['Hari ini', 'Minggu'] as const} value={v} onChange={setV} label="Rentang" />;
  }
  await wrap(<Demo />);
  expect(screen.getByLabelText('Rentang')).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'Hari ini' })).toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Minggu' }));
  expect(screen.getByRole('tab', { name: 'Minggu' })).toBeSelected();
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  expect(flat(screen.getByRole('tab', { name: 'Minggu' })).height).toBeGreaterThanOrEqual(44);
});

test('ListRow: ikon + judul + nilai, tanpa penjelasan bawaan, chevron bila bisa ditekan', async () => {
  const onPress = jest.fn();
  await wrap(
    <>
      <ListRow icon="bell" tone="agenda" title="Pemberitahuan" value="Nyala" onPress={onPress} />
      <ListRow icon="help" title="Bantuan" onPress={onPress} />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Pemberitahuan. Nyala' }));
  expect(onPress).toHaveBeenCalled();
  expect(screen.getByTestId('ikon-chevR')).toBeOnTheScreen();
  expect(flat(screen.getByRole('button', { name: 'Bantuan' })).minHeight).toBeGreaterThanOrEqual(68);
});

describe('RemoteKey', () => {
  test('tombol daya: hijau saat menyala, netral saat mati, getar sedang saat disentuh', async () => {
    const onPress = jest.fn();
    await wrap(
      <>
        <RemoteKey label="Daya" icon="power" variant="power" on onPress={onPress} testID="nyala" />
        <RemoteKey label="Daya mati" icon="power" variant="power" testID="mati" />
      </>,
    );
    const on = screen.getByRole('switch', { name: 'Daya' });
    expect(on).toBeChecked();
    expect(flat(on)).toMatchObject({ backgroundColor: light.brand, width: 64, height: 64 });
    const off = screen.getByRole('switch', { name: 'Daya mati' });
    expect(off).not.toBeChecked();
    expect(flat(off)).toMatchObject({ backgroundColor: light.surface });
    await fireEvent(on, 'pressIn');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    await fireEvent.press(on);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('tombol biasa: getar ringan, keterangan opsional, mode gelap memakai raised', async () => {
    await wrap(<RemoteKey label="Volume naik" icon="plus" caption="Naik" />, 'dark');
    const key = screen.getByRole('button', { name: 'Volume naik' });
    expect(flat(key).backgroundColor).toBe(dark.raised);
    await fireEvent(key, 'pressIn');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(screen.getByText('Naik', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

test('Rocker: dua tombol terbaca terpisah', async () => {
  const up = jest.fn();
  const down = jest.fn();
  await wrap(<Rocker label="VOL" name="Volume" onUp={up} onDown={down} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Volume naik' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Volume turun' }));
  expect(up).toHaveBeenCalledTimes(1);
  expect(down).toHaveBeenCalledTimes(1);
});

describe('Slider', () => {
  function Demo({ vertical = false }: { vertical?: boolean }) {
    const [v, setV] = useState(50);
    return (
      <Slider
        value={v}
        onChange={setV}
        label={vertical ? 'Terang lampu' : 'Volume'}
        valueText={(x) => `${x}%`}
        orientation={vertical ? 'vertical' : 'horizontal'}
        length={vertical ? 400 : undefined}
        showValue
      />
    );
  }

  test('horizontal: kontrol adjustable, naik/turun 5% untuk rentang 0–100', async () => {
    await wrap(<Demo />);
    const s = screen.getByRole('adjustable', { name: 'Volume' });
    expect(s.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 50, text: '50%' });
    await fireEvent(s, 'accessibilityAction', action('increment'));
    expect(screen.getByRole('adjustable', { name: 'Volume' }).props.accessibilityValue.now).toBe(55);
    await fireEvent(s, 'accessibilityAction', action('decrement'));
    await fireEvent(s, 'accessibilityAction', action('decrement'));
    expect(screen.getByRole('adjustable', { name: 'Volume' }).props.accessibilityValue.now).toBe(45);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(screen.getByText('45%')).toBeOnTheScreen();
  });

  test('vertikal: tetap adjustable dan ditahan di batas', async () => {
    await wrap(<Demo vertical />);
    const s = screen.getByRole('adjustable', { name: 'Terang lampu' });
    for (let i = 0; i < 15; i++) await fireEvent(s, 'accessibilityAction', action('increment'));
    expect(screen.getByRole('adjustable', { name: 'Terang lampu' }).props.accessibilityValue.now).toBe(100);
  });
});

test('Dial: suhu adjustable satu derajat, getar tiap langkah, ditahan di 16–30', async () => {
  function Demo() {
    const [t, setT] = useState(29);
    return <Dial value={t} onChange={setT} label="Suhu AC kamar" modeIcon="snow" sub="Kamar 27°" subIcon="thermo" />;
  }
  await wrap(<Demo />);
  const d = screen.getByRole('adjustable', { name: 'Suhu AC kamar' });
  expect(d.props.accessibilityValue.text).toBe('29 derajat');
  await fireEvent(d, 'accessibilityAction', action('increment'));
  await fireEvent(d, 'accessibilityAction', action('increment'));
  expect(screen.getByRole('adjustable', { name: 'Suhu AC kamar' }).props.accessibilityValue.text).toBe('30 derajat');
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  await fireEvent(d, 'accessibilityAction', action('decrement'));
  expect(screen.getByRole('adjustable', { name: 'Suhu AC kamar' }).props.accessibilityValue.text).toBe('29 derajat');
  expect(screen.getByText('Kamar 27°')).toBeOnTheScreen();
});

test('Toggle: hijau saat menyala, getar, sentuhan lega', async () => {
  const onChange = jest.fn();
  await wrap(<Toggle value={false} onChange={onChange} label="Pengingat" />);
  const sw = screen.getByRole('switch', { name: 'Pengingat' });
  expect(sw.props.hitSlop).toBeGreaterThanOrEqual(12);
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(true);
  expect(Haptics.selectionAsync).toHaveBeenCalled();
});

test('TimeRail dan TimeStrip: butir terbaca lengkap, penanda sekarang', async () => {
  const items = [
    { id: '1', time: '09.00', title: 'Rapat supplier', state: 'past' as const },
    {
      id: '2',
      time: '13.00',
      title: 'Bayar listrik',
      icon: 'call' as const,
      state: 'next' as const,
      onPress: jest.fn(),
    },
  ];
  await wrap(
    <>
      <TimeRail items={items} now={{ label: '09.41', before: 1 }} />
      <TimeStrip items={items} now={{ label: '09.41', before: 1 }} />
    </>,
  );
  expect(screen.getAllByLabelText('Sekarang 09.41')).toHaveLength(2);
  await fireEvent.press(screen.getAllByRole('button', { name: '13.00, Bayar listrik' })[0]!);
  expect(items[1]!.onPress).toHaveBeenCalled();
});

test('grafik: Sparkline hiasan, AreaChart berlabel untuk pembaca layar', async () => {
  await wrap(
    <>
      <Sparkline values={[3.1, 3.6, 2.9, 4.25]} />
      <AreaChart
        values={[3.1, 3.6, 2.9, 4.25]}
        labels={['Sen', 'Sel', 'Rab', 'Kam']}
        accessibilityLabel="Penjualan naik"
      />
    </>,
  );
  const chart = screen.getByRole('image', { name: 'Penjualan naik' });
  await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 320, height: 200, x: 0, y: 0 } } });
  expect(screen.getByText('Kam')).toBeOnTheScreen();
});

test('MoreSheet: kontrol kedua disimpan di "Lainnya": sakelar di tempat, chip nilai menutup lalu menjalankan', async () => {
  const timer = jest.fn();
  const swing = jest.fn();
  await wrap(
    <MoreSheet
      items={[
        { icon: 'swing', label: 'Ayun', control: <Toggle value={false} onChange={swing} label="Ayun" /> },
        { icon: 'clock', label: 'Timer', value: '22.00', onPress: timer },
      ]}
    />,
  );
  expect(screen.queryByText('Timer')).not.toBeOnTheScreen();
  const trigger = screen.getByRole('button', { name: 'Lainnya' });
  expect(flat(trigger).height).toBe(44);
  await fireEvent.press(trigger);
  await fireEvent.press(screen.getByRole('switch', { name: 'Ayun' }));
  expect(swing).toHaveBeenCalledWith(true);
  expect(screen.getByText('Timer')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Timer, 22.00' }));
  await advance(300);
  expect(timer).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Timer')).not.toBeOnTheScreen();
});

test('ThumbZone: aksi menempel di bawah, spacer lentur di antaranya', async () => {
  await wrap(
    <ThumbZone testID="zona" top={<Text>Judul</Text>}>
      <Text>Kirim</Text>
    </ThumbZone>,
  );
  expect(flat(screen.getByTestId('zona-spacer')).flexGrow).toBe(1);
  expect(screen.getByText('Kirim')).toBeOnTheScreen();
});

test('Enter: memudar masuk lalu tampil penuh', async () => {
  await wrap(
    <Enter index={2} testID="masuk">
      <Text>Isi</Text>
    </Enter>,
  );
  expect(getAnimatedStyle(screen.getByTestId('masuk')).opacity).toBe(0);
  // Blok ke-3: jeda 2 × 80 ms, lalu 320 ms.
  await advance(600);
  expect(getAnimatedStyle(screen.getByTestId('masuk')).opacity).toBe(1);
});

describe('kelas tata letak', () => {
  test.each([
    [360, 640, 'compact'],
    [360, 800, 'tall'],
    [393, 873, 'tall'],
    [412, 915, 'tall'],
    [412, 780, 'regular'],
  ] as const)('%i×%i → %s', (w, h, cls) => {
    expect(layoutClassFor(w, h)).toBe(cls);
  });

  test('useLayoutClass membaca ukuran jendela; byLayout memilih nilai', async () => {
    const { result } = await renderHook(() => useLayoutClass());
    expect(['compact', 'regular', 'tall']).toContain(result.current);
    expect(byLayout('compact', { compact: 72, regular: 84, tall: 88 })).toBe(72);
  });
});

test('toneForName: nama sama selalu sewarna, hanya aksen bidang', () => {
  expect(toneForName('Pak Budi')).toBe(toneForName(' pak budi '));
  expect(['terhubung', 'agenda', 'usaha', 'rumah', 'coral']).toContain(toneForName('Bu Sari'));
});

test('Skia di tes memakai tiruan ringan: Canvas tampil tanpa modul native', async () => {
  await wrap(
    <Canvas testID="kanvas" style={{ height: 40 }}>
      <Path path={Skia.Path.Make()} color="#1D7550" />
    </Canvas>,
  );
  expect(screen.getByTestId('kanvas')).toBeOnTheScreen();
});
