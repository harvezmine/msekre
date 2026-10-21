import { Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Txt } from '../Txt';

/** Satu kejadian di rel waktu: jam, 2–3 kata, dan satu ikon jenis (tanpa keterangan tambahan). */
export interface TimeItem {
  id: string;
  /** Jam tampil, contoh "13.00". */
  time: string;
  /** Judul pendek, contoh "Bayar listrik". */
  title: string;
  /** Ikon jenis di kanan (telepon, tugas, alarm, video). */
  icon?: IconName;
  /** Pengganti ikon kanan (contoh kotak centang besar, tautan notulen). */
  trailing?: ReactNode;
  /** `past` diredupkan, `next` di kartu putih dengan titik biru, sisanya biasa. */
  state?: 'past' | 'next' | 'upcoming';
  /** Bacaan tambahan untuk pembaca layar saja (contoh "ditelepon"). */
  accessibilityHint?: string;
  /** Nama lengkap untuk pembaca layar; bawaan "jam, judul". */
  accessibilityLabel?: string;
  /** Tugas: baris berperan kotak centang dengan keadaan ini. */
  checked?: boolean;
  /** Judul dicoret dan redup (tugas selesai). */
  done?: boolean;
  /** Jam berupa kata ("Seharian"): tulisan kecil supaya muat di kolom jam. */
  timeWord?: boolean;
  /** Satu baris kecil di bawah judul, hanya untuk keadaan penting (contoh "Ditunda sampai 16.10"). */
  detail?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

/** Penanda "sekarang": jam tampil dan sebelum butir ke berapa (0 = sebelum butir pertama). */
export interface NowMark {
  label: string;
  before: number;
}

const labelOf = (it: TimeItem) => it.accessibilityLabel ?? [it.time, it.title].join(', ');

/** Lebar kolom jam dan rel (dp); judul mulai sesudahnya. */
export const RAIL_TIME_W = 56;
export const RAIL_DOT_W = 24;

/**
 * Rel waktu tegak (Agenda, §7/§8): kolom jam 56, rel 2 dp, garis "sekarang" hijau selebar layar, butir berikutnya di
 * kartu putih dengan titik biru (penanda Agenda), butir yang lewat redup. Tiap butir: jam + judul + satu ikon. Tinggi
 * minimum, bukan tinggi tetap: judul dua baris dan skala huruf 1,3 tetap rapi.
 */
export function TimeRail({ items, now, style }: { items: TimeItem[]; now?: NowMark; style?: StyleProp<ViewStyle> }) {
  const { c, marker, shadow } = useTheme();
  const nowLine = now ? (
    <View
      testID="garis-sekarang"
      accessible
      accessibilityLabel={`Sekarang ${now.label}`}
      style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center' }}
    >
      <Txt
        v="caption"
        weight={700}
        tabular
        color={c.brandInk}
        maxFontSizeMultiplier={1.2}
        style={{ width: RAIL_TIME_W }}
      >
        {now.label}
      </Txt>
      <View style={{ width: RAIL_DOT_W, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: c.line }} />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand }} />
      </View>
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: c.brand, marginLeft: 4 }} />
    </View>
  ) : null;
  return (
    <View style={style}>
      {items.map((it, i) => {
        const next = it.state === 'next';
        const past = it.state === 'past';
        const tone = past ? c.muted : c.text;
        const first = i === 0 && !(now && now.before === 0);
        const last = i === items.length - 1 && !(now && now.before >= items.length);
        const body = (
          <>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt
                v="row"
                color={past || it.done ? c.muted : c.text}
                numberOfLines={2}
                style={[{ fontSize: 18, lineHeight: 24 }, it.done ? { textDecorationLine: 'line-through' } : null]}
              >
                {it.title}
              </Txt>
              {it.detail ?? null}
            </View>
            {it.trailing ?? (it.icon ? <Icon name={it.icon} size={24} color={past ? c.faint : c.muted} /> : null)}
          </>
        );
        const bodyStyle: ViewStyle = {
          flex: 1,
          minHeight: 64,
          marginLeft: 8,
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 20,
          backgroundColor: next ? c.surface : 'transparent',
          boxShadow: next ? shadow.e1 : undefined,
        };
        const role = it.checked !== undefined ? 'checkbox' : 'button';
        return (
          <Fragment key={it.id}>
            {now && now.before === i ? nowLine : null}
            <View style={{ flexDirection: 'row', minHeight: 76, alignItems: 'center' }}>
              <Txt
                v="row"
                weight={600}
                tabular
                color={tone}
                maxFontSizeMultiplier={1.2}
                style={[
                  { width: RAIL_TIME_W, fontSize: 18, lineHeight: 24 },
                  it.timeWord ? { fontSize: 13, lineHeight: 18 } : null,
                ]}
              >
                {it.time}
              </Txt>
              <View style={{ width: RAIL_DOT_W, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    position: 'absolute',
                    top: first ? '50%' : 0,
                    bottom: last ? '50%' : 0,
                    width: 2,
                    backgroundColor: c.line,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: next ? marker.agenda.base : past ? c.sunken2 : c.faint,
                    backgroundColor: next ? marker.agenda.base : past ? c.sunken2 : c.bg,
                  }}
                />
              </View>
              {it.onPress || it.onLongPress ? (
                <Pressable
                  accessibilityRole={role}
                  accessibilityLabel={labelOf(it)}
                  accessibilityHint={it.accessibilityHint}
                  accessibilityState={it.checked !== undefined ? { checked: it.checked } : undefined}
                  onPress={it.onPress}
                  onLongPress={it.onLongPress}
                  delayLongPress={300}
                  android_ripple={{ color: c.ripple, foreground: true }}
                  style={bodyStyle}
                >
                  {body}
                </Pressable>
              ) : (
                <View
                  accessible
                  accessibilityLabel={labelOf(it)}
                  accessibilityHint={it.accessibilityHint}
                  style={bodyStyle}
                >
                  {body}
                </View>
              )}
            </View>
          </Fragment>
        );
      })}
      {now && now.before >= items.length ? nowLine : null}
    </View>
  );
}

/**
 * Deretan waktu mendatar: rel 2 dp, bagian yang sudah lewat hijau 35%, penanda sekarang hijau 3×22 dengan jam, butir 122
 * lebar berisi jam / titik / judul 2 baris. Butir berikutnya bertitik biru (penanda Agenda).
 */
export function TimeStrip({
  items,
  now,
  itemWidth = 122,
  style,
}: {
  items: TimeItem[];
  now?: NowMark;
  itemWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, marker } = useTheme();
  const height = 96;
  const NOW_W = 56;
  const GAP = 14;
  const before = now ? Math.min(now.before, items.length) : 0;
  const doneW = now ? 20 + before * (itemWidth + GAP) + NOW_W / 2 : 0;
  const totalW = 20 + items.length * (itemWidth + GAP) + (now ? NOW_W + GAP : 0) + 20;
  const marker2 = now ? (
    <View
      key="sekarang"
      accessible
      accessibilityLabel={`Sekarang ${now.label}`}
      style={{ width: NOW_W, height, alignItems: 'center' }}
    >
      <Txt v="micro" weight={700} tabular color={c.brandInk} style={{ marginTop: 4 }}>
        {now.label}
      </Txt>
      <View
        style={{ position: 'absolute', top: 21, width: 3, height: 22, borderRadius: 2, backgroundColor: c.brand }}
      />
    </View>
  ) : null;
  const children = items.map((it) => {
    const next = it.state === 'next';
    const past = it.state === 'past';
    const content = (
      <>
        <Txt v="label" tabular color={past ? c.muted : c.text}>
          {it.time}
        </Txt>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 26,
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: next ? marker.agenda.base : past ? c.sunken2 : c.faint,
            backgroundColor: next ? marker.agenda.base : past ? c.sunken2 : c.bg,
          }}
        />
        <Txt
          v="body"
          weight={next ? 600 : 500}
          numberOfLines={2}
          color={past ? c.muted : c.text}
          style={{ position: 'absolute', top: 46, left: 0, width: itemWidth - 4, fontSize: 15, lineHeight: 20 }}
        >
          {it.title}
        </Txt>
      </>
    );
    const box: ViewStyle = { width: itemWidth, height };
    return it.onPress ? (
      <Pressable
        key={it.id}
        accessibilityRole="button"
        accessibilityLabel={labelOf(it)}
        accessibilityHint={it.accessibilityHint}
        onPress={it.onPress}
        style={box}
      >
        {content}
      </Pressable>
    ) : (
      <View key={it.id} accessible accessibilityLabel={labelOf(it)} style={box}>
        {content}
      </View>
    );
  });
  const row = [...children];
  if (marker2) row.splice(before, 0, marker2);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ height }, style]}
      contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, width: totalW, top: 31, height: 2, backgroundColor: c.line }}
      />
      {now ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            width: doneW,
            top: 31,
            height: 2,
            backgroundColor: c.brand,
            opacity: 0.35,
          }}
        />
      ) : null}
      {row}
    </ScrollView>
  );
}
