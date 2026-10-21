import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devQuery } from '@/dev/query';
import { useTheme } from '@/theme/ThemeProvider';
import type { FieldRecipe } from '@/theme/tokens';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { GradientField } from '../kit/GradientField';
import { byLayout, useLayoutClass } from '../kit/layout';
import { MoreSheet, type MoreItem } from '../kit/MoreSheet';
import { PressableScale } from '../kit/PressableScale';
import { ThumbZone } from '../kit/ThumbZone';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { useRemote } from './RemoteContext';

/** Kalimat penjelas tanda "Perkiraan" (perangkat inframerah), hanya di Lainnya. */
export const ASSUMED_TEXT = 'Keadaan ini perkiraan dari perintah terakhir.';

/**
 * Bingkai setiap remote (§7): kepala (kembali, nama, "Lainnya"), isi atas, ruang lentur, lalu kontrol utama yang menempel
 * di bawah (zona jempol). Lainnya selalu memuat bintang Favorit (Beranda), dan untuk perangkat inframerah satu kalimat
 * tentang "perkiraan". Perangkat tidak terjangkau: kontrol diredupkan dan tidak bisa disentuh, dengan satu baris
 * "Tidak terjangkau" dan Coba lagi. Isi bisa digeser hanya bila tidak muat (layar pendek), supaya geseran dial dan
 * penggeser tidak berebut dengan gulir.
 */
export function RemoteFrame({
  top,
  bottom,
  more = [],
  moreFooter,
  field,
  backdrop,
  favorite = true,
}: {
  /** Isi atas: angka besar, gambar, dial. */
  top: ReactNode;
  /** Kontrol utama di zona jempol. */
  bottom?: ReactNode;
  /** Kontrol kedua di Lainnya. */
  more?: MoreItem[];
  /** Isi tambahan Lainnya (papan angka). */
  moreFooter?: ReactNode;
  /** Cahaya lembut di atas (AC dingin, lampu). */
  field?: FieldRecipe;
  /** Lapisan hiasan di belakang semuanya, tidak ikut digeser (cahaya bola lampu). */
  backdrop?: ReactNode;
  /** Baris Favorit di Lainnya (bukan untuk Kotak dan sensor). */
  favorite?: boolean;
}) {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const cls = useLayoutClass();
  const { device, setFavorite, retry } = useRemote();
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const assumed = device.stateIsAssumed === true;
  const reachable = device.reachable;

  const items: MoreItem[] = [
    ...more,
    ...(favorite
      ? [
          {
            icon: 'star' as const,
            label: 'Favorit',
            tone: device.favorite ? ('brand' as const) : ('neutral' as const),
            control: <Toggle label="Favorit" value={device.favorite === true} onChange={setFavorite} />,
          },
        ]
      : []),
  ];
  const footer =
    assumed || moreFooter ? (
      <View style={{ gap: 12 }}>
        {moreFooter}
        {assumed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            <Icon name="info" size={20} color={c.muted} />
            <Txt v="caption" color={c.muted} style={{ flex: 1 }}>
              {ASSUMED_TEXT}
            </Txt>
          </View>
        ) : null}
      </View>
    ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {field && reachable ? <GradientField recipe={field} /> : null}
      {reachable ? backdrop : null}
      <View
        style={{
          paddingTop: insets.top,
          paddingLeft: 8,
          paddingRight: 16,
          minHeight: 64 + insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Txt v="header" accessibilityRole="header" numberOfLines={1}>
            {device.name}
          </Txt>
          {assumed ? (
            <Txt
              v="caption"
              color={c.muted}
              testID="tanda-perkiraan"
              accessibilityLabel="Keadaan perkiraan"
              style={{ fontSize: 13, lineHeight: 16 }}
            >
              Perkiraan
            </Txt>
          ) : null}
        </View>
        {items.length > 0 || footer ? (
          <MoreSheet items={items} footer={footer} defaultOpen={devQuery().lainnya === '1'} />
        ) : null}
      </View>
      {!reachable ? (
        <View
          testID="tak-terjangkau"
          style={{ marginHorizontal: 20, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: marker.warn.base }} />
          <Txt v="label" style={{ flex: 1 }}>
            Tidak terjangkau
          </Txt>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={retry}
            haptic="light"
            style={{
              height: 44,
              borderRadius: 22,
              paddingHorizontal: 18,
              justifyContent: 'center',
              backgroundColor: c.sunken,
            }}
          >
            <Txt v="label" color={c.brandInk}>
              Coba lagi
            </Txt>
          </PressableScale>
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        scrollEnabled={content > viewport + 1}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewport(Math.round(e.nativeEvent.layout.height))}
        onContentSizeChange={(_w, h) => setContent(Math.round(h))}
      >
        <View
          testID="isi-remote"
          pointerEvents={reachable ? 'auto' : 'none'}
          accessibilityElementsHidden={!reachable}
          importantForAccessibility={reachable ? 'auto' : 'no-hide-descendants'}
          style={{ flex: 1, opacity: reachable ? 1 : 0.38 }}
        >
          <ThumbZone
            top={top}
            gap={byLayout(cls, { compact: 16, regular: 24, tall: 32 })}
            bottomPadding={byLayout(cls, { compact: 16, regular: 28, tall: 40 })}
          >
            {bottom ?? null}
          </ThumbZone>
        </View>
      </ScrollView>
    </View>
  );
}
