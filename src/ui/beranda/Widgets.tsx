import { useEffect, useId, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { WeatherCondition } from '@/api/contract';
import { DAY_NAMES, MONTH_NAMES } from '@/api/dates';
import type { WeatherView } from '@/api/useWeather';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Surface } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import type { NextAgenda } from './blocks';

const pad = (n: number) => String(n).padStart(2, '0');

/** Jam dinding HP yang berganti tepat di pergantian menit. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    const d = new Date();
    timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/** "Senin, 27 Oktober · 09.41": tanggal dan jam di bawah sapaan. */
export function todayText(d: Date): string {
  const day = DAY_NAMES[(d.getDay() + 6) % 7];
  return `${day}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

/** Satu baris tenang di bawah sapaan: hari, tanggal, dan jam yang berjalan. */
export function TodayLine({ compact }: { compact: boolean }) {
  const { c } = useTheme();
  const now = useMinuteClock();
  return (
    <Txt testID="beranda-hari-ini" color={c.muted} weight={500} style={{ fontSize: compact ? 14 : 15, lineHeight: 20 }}>
      {todayText(now)}
    </Txt>
  );
}

const CONDITION: Record<WeatherCondition, { word: string; icon: IconName; tint: string }> = {
  cerah: { word: 'Cerah', icon: 'sun', tint: '#F5B14C' },
  berawan: { word: 'Berawan', icon: 'cloudSun', tint: '#4DA36E' },
  hujan: { word: 'Hujan', icon: 'drop', tint: '#4C9BE3' },
  badai: { word: 'Badai', icon: 'bolt', tint: '#7C5CE6' },
  kabut: { word: 'Berkabut', icon: 'cloudSun', tint: '#9CA1A8' },
  salju: { word: 'Salju', icon: 'snow', tint: '#4CC3E3' },
  lainnya: { word: 'Cuaca', icon: 'cloudSun', tint: '#4DA36E' },
};

/** Cahaya lembut di pojok kanan atas widget, warnanya mengikuti cuaca. Hiasan saja. */
function CornerTint({ color }: { color: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const size = 220;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: -90, right: -90, width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`wt${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={size / 2} cy={size / 2} rx={size / 2} ry={size / 2} fill={`url(#wt${uid})`} />
      </Svg>
    </View>
  );
}

/** Tinggi widget: dua widget sejajar, cukup untuk angka besar dan dua baris keterangan. */
const widgetHeight = (compact: boolean) => (compact ? 138 : 156);

/**
 * Widget cuaca: suhu besar, keadaan, tempat, tertinggi dan terendah hari ini, dengan cahaya lembut sesuai cuaca.
 * Ketuk: tanya cuaca ke asisten di chat. Tanpa tempat tersimpan: menawarkan perkiraan lokasi (izin hanya saat diketuk).
 */
export function WeatherWidget({
  view,
  compact,
  onAsk,
}: {
  view: WeatherView;
  compact: boolean;
  /** Ketuk cuaca yang tampil: buka chat dengan pertanyaan cuaca. */
  onAsk: () => void;
}) {
  const { c } = useTheme();
  const { status, weather } = view;
  const height = widgetHeight(compact);
  if (status === 'ready' && weather) {
    const look = CONDITION[weather.condition] ?? CONDITION.lainnya;
    const range =
      weather.highC !== undefined && weather.lowC !== undefined
        ? `${Math.round(weather.highC)}° / ${Math.round(weather.lowC)}°`
        : null;
    return (
      <Surface
        testID="widget-cuaca"
        radius={28}
        onPress={onAsk}
        haptic="light"
        accessibilityLabel={`Cuaca ${weather.place}: ${look.word}, ${Math.round(weather.tempC)} derajat`}
        accessibilityHint="Tanya cuaca hari ini di chat"
        style={{ flex: 1, height, padding: 18, overflow: 'hidden', justifyContent: 'space-between' }}
      >
        <CornerTint color={look.tint} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={look.icon} size={22} color={look.tint} />
          <Txt color={c.muted} weight={500} numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
            {weather.place}
          </Txt>
        </View>
        <Txt
          weight={300}
          tabular
          maxFontSizeMultiplier={1.1}
          style={{ fontSize: compact ? 40 : 46, lineHeight: compact ? 46 : 52, letterSpacing: -1.5 }}
        >
          {`${Math.round(weather.tempC)}°`}
        </Txt>
        <View style={{ gap: 2 }}>
          <Txt weight={600} numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
            {look.word}
          </Txt>
          {range ? (
            <Txt color={c.muted} tabular style={{ fontSize: 13, lineHeight: 18 }}>
              {range}
            </Txt>
          ) : null}
        </View>
      </Surface>
    );
  }
  // Belum ada cuaca: satu ajakan tenang (izinkan lokasi, buka pengaturan, atau coba lagi), atau kerangka saat dimuat.
  const ask =
    status === 'needLocation'
      ? { text: 'Cuaca di sekitar Anda', action: 'Izinkan lokasi', run: () => void view.askLocation() }
      : status === 'denied'
        ? { text: 'Lokasi belum diizinkan', action: 'Buka pengaturan', run: view.openSettings }
        : status === 'error'
          ? { text: 'Cuaca belum termuat', action: 'Coba lagi', run: view.refresh }
          : null;
  return (
    <Surface
      testID="widget-cuaca"
      radius={28}
      onPress={ask?.run}
      haptic={ask ? 'light' : undefined}
      accessibilityLabel={ask ? `${ask.text}. ${ask.action}` : 'Memuat cuaca'}
      style={{ flex: 1, height, padding: 18, overflow: 'hidden', justifyContent: 'space-between' }}
    >
      <CornerTint color={CONDITION.cerah.tint} />
      <Icon name={status === 'needLocation' || status === 'denied' ? 'pin' : 'cloudSun'} size={24} color={c.muted} />
      {ask ? (
        <View style={{ gap: 6 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
            {ask.text}
          </Txt>
          <Txt weight={600} color={c.brandInk} style={{ fontSize: 14, lineHeight: 18 }}>
            {ask.action}
          </Txt>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ width: 64, height: 30, borderRadius: 12, backgroundColor: c.sunken }} />
          <View style={{ width: 90, height: 14, borderRadius: 7, backgroundColor: c.sunken }} />
        </View>
      )}
    </Surface>
  );
}

/**
 * Widget agenda: yang berikutnya hari ini atau besok (jam besar, judul dua baris). Tanpa agenda dekat: ajakan tenang
 * menambah pengingat. Ketuk: Agenda.
 */
export function AgendaWidget({
  next,
  compact,
  onOpen,
}: {
  next: NextAgenda | null;
  compact: boolean;
  onOpen: () => void;
}) {
  const { c, marker } = useTheme();
  const height = widgetHeight(compact);
  return (
    <Surface
      testID="widget-agenda"
      radius={28}
      onPress={onOpen}
      haptic="light"
      accessibilityLabel={
        next
          ? `Agenda ${next.day === 1 ? 'besok' : 'berikutnya'}, ${next.time}, ${next.title}`
          : 'Agenda hari ini masih lega. Tambah pengingat'
      }
      style={{ flex: 1, height, padding: 18, overflow: 'hidden', justifyContent: 'space-between' }}
    >
      <CornerTint color={marker.agenda.base} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="calendar" size={22} color={marker.agenda.base} />
        <Txt color={c.muted} weight={500} style={{ fontSize: 13, lineHeight: 18 }}>
          {next ? (next.day === 1 ? 'Besok' : 'Berikutnya') : 'Agenda'}
        </Txt>
      </View>
      {next ? (
        <>
          <Txt
            weight={600}
            tabular
            maxFontSizeMultiplier={1.1}
            style={{ fontSize: compact ? 28 : 32, lineHeight: compact ? 34 : 38, letterSpacing: -0.6 }}
          >
            {next.time}
          </Txt>
          <Txt weight={500} numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>
            {next.title}
          </Txt>
        </>
      ) : (
        <View style={{ gap: 6 }}>
          <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
            Hari ini masih lega
          </Txt>
          <Txt weight={600} color={c.brandInk} style={{ fontSize: 14, lineHeight: 18 }}>
            Tambah pengingat
          </Txt>
        </View>
      )}
    </Surface>
  );
}
