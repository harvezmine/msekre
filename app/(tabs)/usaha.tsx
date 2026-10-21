import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BusinessStock } from '@/api/contract';
import { useBusiness } from '@/api/useBusiness';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { MoneyInCard } from '@/ui/business/MoneyInCard';
import { OrdersCard } from '@/ui/business/OrdersCard';
import { ReportCard } from '@/ui/business/ReportCard';
import { SalesCard } from '@/ui/business/SalesCard';
import { SourcesRow } from '@/ui/business/SourcesRow';
import { StockCard } from '@/ui/business/StockCard';
import { Card } from '@/ui/Card';
import { PlaceButton } from '@/ui/PlaceButton';
import { Initials } from '@/ui/Initials';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

export default function Usaha() {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { home } = useHome();
  const place = home?.place ?? null;
  const { data, hasData, status, error, retry, reorder, isReordering, mediaUrl } = useBusiness(place, 'hari');
  const toast = useToast();

  const openDraft = (draftId: string, messageId?: string) =>
    router.push({ pathname: '/chat', params: messageId ? { draf: draftId, pesan: messageId } : { draf: draftId } });
  const orderAgain = async (item: BusinessStock) => {
    const res = await reorder(item.id);
    if (res.ok) openDraft(res.draftId, res.messageId);
    else if (res.message) toast(res.message);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            paddingLeft: 12,
            paddingRight: 16,
          }}
        >
          <PlaceButton labelFor={(p) => (p === 'Semua' ? 'Semua cabang' : p)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
            onPress={() => router.push('/akun')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.surface,
              boxShadow: shadow.e1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Initials />
          </Pressable>
        </View>
        <Txt v="title" accessibilityRole="header" style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          Usaha
        </Txt>

        <View style={{ paddingTop: 16, paddingHorizontal: 16, gap: 12 }}>
          {!data ? (
            status === 'error' ? (
              <Card style={{ gap: 16 }}>
                <Txt>{error}</Txt>
                <Action label="Coba lagi" onPress={() => void retry()} />
              </Card>
            ) : null
          ) : hasData ? (
            <>
              <SalesCard data={data} />
              {data.moneyIn.length > 0 ? <MoneyInCard data={data} /> : null}
              {data.lowStock.length > 0 ? (
                <StockCard
                  data={data}
                  isBusy={isReordering}
                  onOrder={(item) => void orderAgain(item)}
                  onSeeDraft={(item) => item.reorderDraftId && openDraft(item.reorderDraftId)}
                />
              ) : null}
              <OrdersCard orders={data.orders} />
              {data.report ? <ReportCard report={data.report} mediaUrl={mediaUrl} /> : null}
              <SourcesRow sources={data.sources} />
            </>
          ) : (
            <Card style={{ gap: 16 }}>
              <Txt>Belum ada data usaha. Sambungkan kasir atau rekening di Terhubung.</Txt>
              <Action label="Buka Terhubung" onPress={() => router.push('/terhubung')} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pilih tempat"
                onPress={() => router.push('/tempat')}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Txt weight={600} color={c.brandInk}>
                  Pilih tempat
                </Txt>
              </Pressable>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        height: 52,
        borderRadius: 26,
        backgroundColor: c.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight={600} color={c.onBrand}>
        {label}
      </Txt>
    </Pressable>
  );
}
