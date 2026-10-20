import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { businessByPlace } from '@/sample/business';
import { user } from '@/sample/profile';
import { supplierOrderDraft } from '@/sample/outgoing';
import { draftFor, useSampleDispatch, useSampleState } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { MoneyInCard } from '@/ui/business/MoneyInCard';
import { OrdersRow } from '@/ui/business/OrdersRow';
import { ReportCard } from '@/ui/business/ReportCard';
import { SalesCard } from '@/ui/business/SalesCard';
import { StockCard } from '@/ui/business/StockCard';
import { Card } from '@/ui/Card';
import { PlaceButton } from '@/ui/PlaceButton';
import { Txt } from '@/ui/Txt';

export default function Usaha() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useSampleState();
  const dispatch = useSampleDispatch();
  const data = businessByPlace[state.place];
  const toast = (text: string) => dispatch({ type: 'showToast', text });

  const orderAgain = () => {
    // Sudah ada draf terbuka ke supplier ini: cukup buka chat, jangan membuat draf kembar.
    if (!draftFor(state, supplierOrderDraft.to)) dispatch({ type: 'addDraft', draft: supplierOrderDraft });
    router.push('/chat');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
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
          <PlaceButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
            onPress={() => router.push('/akun')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt weight={700} color={c.green} style={{ fontSize: 15 }}>
              {user.initials}
            </Txt>
          </Pressable>
        </View>
        <Txt v="title" accessibilityRole="header" style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          Usaha
        </Txt>

        <View style={{ paddingTop: 16, paddingHorizontal: 16, gap: 12 }}>
          {data ? (
            <>
              <SalesCard data={data} />
              <MoneyInCard rows={data.moneyIn} />
              <StockCard items={data.lowStock} onOrder={orderAgain} />
              <OrdersRow count={data.orders} onPress={() => toast('Daftar pesanan dibangun di Fase 4.')} />
              <ReportCard onOpen={() => toast('Membuka berkas contoh.')} />
            </>
          ) : (
            <Card style={{ gap: 16 }}>
              <Txt>Pilih tempat usaha untuk melihat penjualan.</Txt>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/tempat')}
                android_ripple={{ color: c.ripple }}
                style={{
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: c.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt weight={600} color={c.onGreen}>
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
