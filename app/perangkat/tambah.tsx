import { Pressable, ScrollView, View } from 'react-native';
import { BRANDS } from '@/api/constants';
import { useTheme } from '@/theme/ThemeProvider';
import { onVoice } from '@/theme/tokens';
import { BackHeader } from '@/ui/BackHeader';
import { SampleBanner } from '@/ui/SampleBanner';
import { Icon } from '@/ui/Icon';
import { ListGroup } from '@/ui/ListRow';
import { useToast } from '@/ui/toastStore';
import { Txt } from '@/ui/Txt';

// Tambah perangkat (desain 2f): pasang Kotak, atau masuk dengan akun merek.
export default function TambahPerangkat() {
  const { c, shadow } = useTheme();
  const toast = useToast();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Tambah perangkat" />
      <SampleBanner area="perangkat" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
        <View style={{ backgroundColor: c.surface, boxShadow: shadow.e2, borderRadius: 28, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: c.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="box" size={24} color={onVoice.text} />
            </View>
            <Txt v="subtitle">Kotak Sekretaris AI</Txt>
          </View>
          <Txt>Dipasang lewat Bluetooth. Nyalakan kotaknya, lalu dekatkan HP Anda.</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pasang Kotak"
            onPress={() => toast('Pemasangan lewat Bluetooth segera hadir.')}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            style={{
              height: 52,
              borderRadius: 26,
              backgroundColor: c.brand,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="bt" size={22} color={c.onBrand} />
            <Txt weight={600} color={c.onBrand}>
              Pasang Kotak
            </Txt>
          </Pressable>
        </View>
        <View style={{ gap: 4, paddingTop: 8, paddingHorizontal: 4 }}>
          <Txt v="subtitle" accessibilityRole="header">
            Atau pilih merek perangkat
          </Txt>
          <Txt color={c.muted}>Masuk dengan akun merek itu. Semua perangkatnya langsung muncul di sini.</Txt>
        </View>
        <ListGroup>
          {BRANDS.map((b, i) => (
            <Pressable
              key={b.n}
              accessibilityRole="button"
              accessibilityLabel={b.n}
              onPress={() => toast(`Masuk ke akun ${b.n} segera hadir.`)}
              android_ripple={{ color: c.ripple }}
              style={{
                minHeight: 60,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderBottomWidth: i < BRANDS.length - 1 ? 1 : 0,
                borderBottomColor: c.line,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: c.sunken,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt weight={700} style={{ fontSize: 13, lineHeight: 18 }}>
                  {b.m}
                </Txt>
              </View>
              <Txt weight={500} style={{ flex: 1 }}>
                {b.n}
              </Txt>
              <Icon name="chevR" size={20} color={c.muted} />
            </Pressable>
          ))}
        </ListGroup>
      </ScrollView>
    </View>
  );
}
