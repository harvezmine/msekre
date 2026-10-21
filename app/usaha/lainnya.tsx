// Niat layar: rincian usaha yang tidak perlu dilihat tiap hari (uang masuk, pesanan, semua stok menipis, laporan, sumber
// data), satu ketukan dari Usaha. Tindakan tersering: Pesan barang yang menipis atau membuka laporan.
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BusinessPeriod, BusinessStock } from '@/api/contract';
import { useBusiness } from '@/api/useBusiness';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { openDraft } from '@/ui/business/openDraft';
import { MoneyInSection, OrdersSection, ReportSection, StockSection } from '@/ui/business/Sections';
import { SourcesRow } from '@/ui/business/SourcesRow';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const PERIODS: readonly string[] = ['hari', 'minggu', 'bulan'];

export default function UsahaLainnya() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { periode } = useLocalSearchParams<{ periode?: string }>();
  const period = (typeof periode === 'string' && PERIODS.includes(periode) ? periode : 'hari') as BusinessPeriod;
  const { home } = useHome();
  const { data, status, error, reorder, isReordering, mediaUrl } = useBusiness(home?.place ?? null, period);

  const orderAgain = async (item: BusinessStock) => {
    const res = await reorder(item.id);
    if (res.ok) openDraft(res.draftId, res.messageId);
    else if (res.message) toast(res.message);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Lainnya" large />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 24 }}>
        {!data ? (
          <Txt color={c.muted} style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            {status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}
          </Txt>
        ) : (
          <>
            <StockSection
              data={data}
              isBusy={isReordering}
              onOrder={(item) => void orderAgain(item)}
              onSeeDraft={(item) => item.reorderDraftId && openDraft(item.reorderDraftId)}
            />
            <MoneyInSection data={data} />
            <OrdersSection orders={data.orders} />
            {data.report ? <ReportSection report={data.report} mediaUrl={mediaUrl} /> : null}
            <SourcesRow sources={data.sources} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
