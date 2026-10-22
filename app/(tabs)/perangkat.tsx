// Perangkat: satu niat, menyalakan dan mematikan perangkat dengan sekali ketuk; ruangan di atas, ubin besar di bawahnya,
// tahan ubin (atau ketuk ubin yang bukan sakelar) membuka remote-nya.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Box, Device, Routine } from '@/api/contract';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { BoxTile, DeviceTile } from '@/ui/device/DeviceTile';
import { gridRows, type GridItem } from '@/ui/device/grid';
import { Icon } from '@/ui/Icon';
import { iconOr } from '@/ui/icons';
import { AccentIcon } from '@/ui/kit/AccentIcon';
import { HScroller } from '@/ui/kit/HScroller';
import { byLayout, useLayoutClass } from '@/ui/kit/layout';
import { PressableScale } from '@/ui/kit/PressableScale';
import { Segmented } from '@/ui/kit/Segmented';
import { Surface } from '@/ui/kit/Surface';
import { SampleBanner } from '@/ui/SampleBanner';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const GAP = 12;
const EDGE = 16;
/** Pilihan "Semua" di segmen ruangan (nilai yang tidak mungkin jadi nama ruangan). */
const ALL = '\u0000semua';

export default function Perangkat() {
  const { c, shadow, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cls = useLayoutClass();
  const toast = useToast();
  const { home } = useHome();
  const place = home?.place;
  const { data, devices, rooms, routines, box, status, error, retry, control, runRoutine, mediaUrl } =
    useDeviceControl(place);
  const [picked, setPicked] = useState<string>(ALL);

  const everywhere = place === 'Semua';
  // Segmen: di "Semua" per tempat, di satu tempat per ruangan; "Semua" selalu pertama.
  const groups = everywhere ? (data?.places ?? []) : rooms.map((r) => r.name);
  const segment = groups.includes(picked) ? picked : ALL;
  const tiles = devices.filter((d) => d.kind !== 'box');
  // Kotak tinggal di ruangan (dan tempat) perangkat ber-id `box.deviceId`; tanpa perangkat itu, di ruangan pertama.
  const boxDevice = box ? devices.find((d) => d.id === box.deviceId) : undefined;
  const boxPlace = boxDevice?.place ?? data?.places[0];
  const boxRoom = boxDevice?.room ?? rooms[0]?.name;
  const inGroup = (d: { place: string; room: string }) =>
    segment === ALL || (everywhere ? d.place === segment : d.room === segment);
  const boxShown = !!box && (segment === ALL || segment === (everywhere ? boxPlace : boxRoom));

  const half = (width - EDGE * 2 - GAP) / 2;
  const tileH = byLayout(cls, { compact: 116, regular: 132, tall: 136 });
  const wideH = byLayout(cls, { compact: 104, regular: 116, tall: 120 });
  const open = (id: string) => router.push({ pathname: '/perangkat/[id]', params: { id } });

  const tile = (item: GridItem, w: number, h: number) =>
    item.type === 'box' ? (
      <BoxTile key="kotak" box={item.box} width={w} minHeight={h} onOpen={() => boxDevice && open(boxDevice.id)} />
    ) : (
      <DeviceTile
        key={item.device.id}
        device={item.device}
        width={w}
        minHeight={h}
        mediaUrl={mediaUrl}
        // Ubin sakelar: perintah lewat server, dengan aturan yang sama dengan Beranda (PIN, tanya dulu sebelum membuka).
        onToggle={() => void control(item.device.id, { on: !item.device.on })}
        onOpen={() => open(item.device.id)}
      />
    );
  const grid = (list: Device[], withBox: Box | null) => (
    <View style={{ gap: GAP }}>
      {gridRows(list, withBox).map((row, i) =>
        row.type === 'wide' ? (
          tile(row.item, width - EDGE * 2, wideH)
        ) : (
          <View key={`baris-${i}`} style={{ flexDirection: 'row', gap: GAP }}>
            {row.items.map((it) => tile(it, half, tileH))}
          </View>
        ),
      )}
    </View>
  );
  const run = async (r: Routine) => {
    const result = await runRoutine(r.id, place ?? 'Semua');
    toast(result.ok ? result.summary : result.message);
  };

  const shown = tiles.filter(inGroup);
  let body;
  if (!data) {
    body =
      status === 'error' ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 32, gap: 16, alignItems: 'flex-start' }}>
          <Txt>{error}</Txt>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={() => void retry()}
            style={{
              height: 48,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: c.brand,
              justifyContent: 'center',
            }}
          >
            <Txt v="label" color={c.onBrand}>
              Coba lagi
            </Txt>
          </PressableScale>
        </View>
      ) : (
        <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingTop: 32 }}>
          Sebentar ya, saya ambil dulu.
        </Txt>
      );
  } else if (tiles.length === 0 && !box) {
    body = (
      <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        Belum ada perangkat. Tambahkan dari tombol + atau sambungkan layanan rumah di Terhubung.
      </Txt>
    );
  } else if (everywhere && segment === ALL) {
    // Semua tempat: satu kisi per tempat, dengan nama tempat sebagai pemisah.
    body = (
      <View style={{ paddingHorizontal: EDGE, gap: 20 }}>
        {data.places.map((p) => {
          const list = tiles.filter((d) => d.place === p);
          const withBox = box && boxPlace === p ? box : null;
          if (list.length === 0 && !withBox) return null;
          return (
            <View key={p} style={{ gap: 12 }}>
              <Txt v="section" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>
                {p}
              </Txt>
              {grid(list, withBox)}
            </View>
          );
        })}
      </View>
    );
  } else if (shown.length === 0 && !boxShown) {
    body = (
      <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        Belum ada perangkat di sini.
      </Txt>
    );
  } else {
    body = <View style={{ paddingHorizontal: EDGE }}>{grid(shown, boxShown ? box : null)}</View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingTop: 16,
            paddingBottom: 8,
            paddingLeft: 20,
            paddingRight: EDGE,
          }}
        >
          <Txt v="title" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 30, lineHeight: 36 }}>
            Perangkat
          </Txt>
          {(data?.places.length ?? home?.places.length ?? 0) > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tempat: ${place ?? 'Semua'}`}
              onPress={() => router.push('/tempat')}
              hitSlop={4}
              android_ripple={{ color: c.ripple }}
              style={{
                height: 40,
                paddingLeft: 14,
                paddingRight: 10,
                borderRadius: 20,
                backgroundColor: c.sunken,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                maxWidth: 150,
              }}
            >
              <Txt v="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                {place ?? 'Semua'}
              </Txt>
              <Icon name="chevD" size={18} color={c.muted} />
            </Pressable>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Tambah perangkat"
            onPress={() => router.push('/perangkat/tambah')}
            haptic="light"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: scheme === 'dark' ? c.raised : c.surface,
              boxShadow: shadow.key,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={26} color={c.text} strokeWidth={2} />
          </PressableScale>
        </View>
        <SampleBanner area="perangkat" />

        {data && groups.length > 1 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
            <Segmented
              testID="pilih-ruangan"
              label={everywhere ? 'Tempat' : 'Ruangan'}
              options={[ALL, ...groups]}
              labels={{ [ALL]: 'Semua' }}
              value={segment}
              onChange={setPicked}
              scrollable
            />
          </View>
        ) : (
          <View style={{ height: 12 }} />
        )}

        {body}

        {data && routines.length > 0 ? (
          <View style={{ paddingTop: 28, gap: 12 }}>
            <Txt v="section" accessibilityRole="header" style={{ paddingHorizontal: 20 }}>
              Rutinitas
            </Txt>
            <HScroller>
              {routines.map((r) => (
                <Surface
                  key={r.id}
                  variant="plain"
                  radius={28}
                  onPress={() => void run(r)}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`Jalankan ${r.name}`}
                  style={{
                    minHeight: 56,
                    paddingLeft: 8,
                    paddingRight: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AccentIcon icon={iconOr(r.icon, 'repeat')} tone="rumah" size={40} />
                  <Txt v="label">{r.name}</Txt>
                </Surface>
              ))}
            </HScroller>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
