// Niat layar: tahu dalam dua detik bagaimana usaha berjalan (satu angka besar dan grafiknya). Tindakan tersering: Pesan
// barang yang menipis, di zona jempol paling bawah. Uang masuk, pesanan, laporan, dan sumber data ada di Lainnya.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Business, BusinessPeriod, BusinessStock } from '@/api/contract';
import { useBusiness } from '@/api/useBusiness';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { BranchRows, firstLowStock, SalesHero, StockRow } from '@/ui/business/Hero';
import { openDraft } from '@/ui/business/openDraft';
import { Icon } from '@/ui/Icon';
import { byLayout, PressableScale, Segmented, useLayoutClass } from '@/ui/kit';
import { PlaceButton } from '@/ui/PlaceButton';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const PERIODS = ['hari', 'minggu', 'bulan'] as const satisfies readonly BusinessPeriod[];
const PERIOD_LABEL: Record<BusinessPeriod, string> = { hari: 'Hari ini', minggu: 'Minggu', bulan: 'Bulan' };

export default function Usaha() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const cls = useLayoutClass();
  const toast = useToast();
  const { home } = useHome();
  const place = home?.place ?? null;
  const [period, setPeriod] = useState<BusinessPeriod>('hari');
  const { data, hasData, status, error, retry, reorder, isReordering } = useBusiness(place, period);
  // Selagi rentang lain dimuat, angka sebelumnya tetap tampil (tanpa kedip kosong).
  const [last, setLast] = useState<Business | null>(data);
  if (data && data !== last) setLast(data);
  const shown = data ?? (status === 'loading' && last?.place === place ? last : null);
  const showsData = data ? hasData : shown !== null;

  const orderAgain = async (item: BusinessStock) => {
    const res = await reorder(item.id);
    if (res.ok) openDraft(res.draftId, res.messageId);
    else if (res.message) toast(res.message);
  };
  const stock = shown ? firstLowStock(shown.lowStock) : null;

  let body;
  if (!shown) {
    body =
      status === 'error' ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 16, alignItems: 'flex-start' }}>
          <Txt>{error}</Txt>
          <MainButton label="Coba lagi" onPress={() => void retry()} />
        </View>
      ) : (
        <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          Sebentar ya, saya ambil dulu.
        </Txt>
      );
  } else if (!showsData) {
    // Kosong yang tenang: satu kalimat, satu tindakan.
    body = (
      <View style={{ paddingHorizontal: 20, paddingTop: 32, gap: 20, alignItems: 'flex-start' }}>
        <Txt v="row" color={c.muted}>
          Belum ada data usaha di sini.
        </Txt>
        <MainButton label="Sambungkan kasir" onPress={() => router.push('/terhubung')} />
      </View>
    );
  } else {
    body = (
      <View style={{ flexGrow: 1 }}>
        <SalesHero data={shown} chartHeight={byLayout(cls, { compact: 120, regular: 168, tall: 180 })} />
        {shown.branches.length > 0 ? (
          <View style={{ paddingTop: cls === 'compact' ? 8 : 16 }}>
            <BranchRows branches={shown.branches} />
          </View>
        ) : null}
        {/* Ruang lentur: stok menipis (aksi tersering) duduk di zona jempol, tepat di atas bilah tab. */}
        <View style={{ flexGrow: 1, minHeight: 16 }} />
        {stock ? (
          <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingHorizontal: 20, paddingTop: 8 }}>
            <StockRow
              item={stock}
              busy={isReordering(stock.id)}
              onOrder={(item) => void orderAgain(item)}
              onSeeDraft={(item) => item.reorderDraftId && openDraft(item.reorderDraftId)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 20,
            paddingRight: 16,
            paddingTop: cls === 'compact' ? 8 : 24,
            paddingBottom: 12,
          }}
        >
          <Txt v="title" accessibilityRole="header" style={{ flex: 1 }}>
            Usaha
          </Txt>
          <PlaceButton quiet />
          {shown && showsData ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Lainnya"
              haptic="light"
              onPress={() => router.push({ pathname: '/usaha/lainnya', params: { periode: period } })}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.sunken,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={2}
            >
              <Icon name="more" size={22} color={c.text} />
            </PressableScale>
          ) : null}
        </View>
        {showsData || !shown ? (
          <Segmented
            options={PERIODS}
            labels={PERIOD_LABEL}
            value={period}
            onChange={setPeriod}
            label="Rentang"
            style={{ marginHorizontal: 20, marginBottom: cls === 'compact' ? 16 : 28 }}
          />
        ) : null}
        {body}
      </ScrollView>
    </View>
  );
}

function MainButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 56,
        paddingHorizontal: 28,
        borderRadius: 28,
        backgroundColor: c.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight={600} color={c.onBrand} style={{ fontSize: 17 }}>
        {label}
      </Txt>
    </PressableScale>
  );
}
