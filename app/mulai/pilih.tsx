import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { StepDots } from '@/ui/StepDots';
import { Txt } from '@/ui/Txt';

type Minat = 'jadwal' | 'rumah' | 'usaha';
const OPTIONS: { id: Minat; icon: IconName; title: string; sub: string }[] = [
  { id: 'jadwal', icon: 'calendar', title: 'Jadwal & pesan', sub: 'Kalender, email, WhatsApp, dan pengingat' },
  { id: 'rumah', icon: 'home', title: 'Rumah', sub: 'AC, lampu, kamera, dan Kotak Sekretaris AI' },
  { id: 'usaha', icon: 'store', title: 'Usaha', sub: 'Penjualan, stok, uang masuk, dan pesanan online' },
];
const NEXT: Record<Minat, { button: string; helper: string; toast: string }> = {
  jadwal: {
    button: 'Sambungkan Google Kalender',
    helper: 'Kita mulai dari Google Kalender. Yang lain bisa menyusul.',
    toast: 'Google Kalender bisa disambungkan dari Terhubung.',
  },
  rumah: {
    button: 'Pasang Kotak Sekretaris AI',
    helper: 'Kita mulai dari Kotak Sekretaris AI. Yang lain bisa menyusul.',
    toast: 'Kotak Sekretaris AI bisa dipasang dari Perangkat.',
  },
  usaha: {
    button: 'Sambungkan Moka',
    helper: 'Kita mulai dari Moka. Yang lain bisa menyusul.',
    toast: 'Moka bisa disambungkan dari Terhubung.',
  },
};

// Layar pertama kali 3 (desain 2p): pilih satu atau lebih. Tombol utama mengikuti pilihan yang paling dulu.
export default function MulaiPilih() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { dispatch } = useSample();
  const [picked, setPicked] = useState<Minat[]>(['jadwal']);
  const first = OPTIONS.find((o) => picked.includes(o.id))?.id;
  const next = first ? NEXT[first] : undefined;

  const toggle = (id: Minat) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const finish = (toast?: string) => {
    dispatch({ type: 'finishOnboarding' });
    if (toast) dispatch({ type: 'showToast', text: toast });
    router.dismissTo('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View
        style={{
          paddingTop: insets.top,
          height: 64 + insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 8,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lewati dulu"
          onPress={() => finish()}
          android_ripple={{ color: c.ripple }}
          style={{ height: 48, paddingHorizontal: 16, justifyContent: 'center' }}
        >
          <Txt weight={600}>Lewati dulu</Txt>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, gap: 12 }}>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Txt v="display" accessibilityRole="header">
            Apa yang mau saya bantu urus?
          </Txt>
          <Txt weight={400} color={c.muted} style={{ fontSize: 17, lineHeight: 26 }}>
            Pilih satu atau lebih. Bisa ditambah kapan saja.
          </Txt>
        </View>
        {OPTIONS.map((o) => {
          const on = picked.includes(o.id);
          return (
            <Pressable
              key={o.id}
              accessibilityRole="checkbox"
              accessibilityLabel={o.title}
              accessibilityState={{ checked: on }}
              onPress={() => toggle(o.id)}
              android_ripple={{ color: c.ripple }}
              style={{
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? c.green : c.line,
                backgroundColor: on ? c.mint : c.card,
                borderRadius: 24,
                padding: 18,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: on ? c.card : c.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={o.icon} size={22} color={on ? c.green : c.ink} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="subtitle">{o.title}</Txt>
                <Txt color={c.muted}>{o.sub}</Txt>
              </View>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: on ? c.green : 'transparent',
                  borderWidth: on ? 0 : 2,
                  borderColor: c.track,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Icon name="check" size={16} color={c.onGreen} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 32, gap: 12 }}>
        {next ? (
          <Txt color={c.muted} style={{ textAlign: 'center' }}>
            {next.helper}
          </Txt>
        ) : null}
        <StepDots step={3} />
        <PrimaryButton label={next?.button ?? 'Lanjut ke Beranda'} onPress={() => finish(next?.toast)} />
      </View>
    </View>
  );
}
