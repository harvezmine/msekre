import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeSample } from '@/sample/home';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Orbit } from '@/ui/orbit/Orbit';
import { useLive } from '@/ui/useLive';
import { ringLabel } from '@/ui/orbit/label';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';

export default function Beranda() {
  const { c } = useTheme();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const d = homeSample;
  const [acOn, setAcOn] = useState(d.house.acOn);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 12,
            paddingRight: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tempat: ${d.place}`}
            style={{
              height: 48,
              paddingLeft: 16,
              paddingRight: 12,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.card,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Txt weight={600}>{d.place}</Txt>
            <Icon name="chevD" size={20} color={c.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
            onLongPress={__DEV__ ? () => router.push('/inti') : undefined}
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
              {d.initials}
            </Txt>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
          <Txt v="display">Selamat pagi, {d.name}</Txt>
          <Txt v="subtitle" weight={400} color={c.muted}>
            {d.summary}
          </Txt>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' }}>
          <Orbit
            nodes={d.nodes}
            paused={!live}
            onPressInti={() => router.navigate('/chat')}
            onLongPressInti={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/suara');
            }}
          />
          <View style={{ height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt v="caption" color={c.muted}>
              {ringLabel(d.nodes)}
            </Txt>
            <Icon name="chevR" size={16} color={c.muted} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <View style={{ backgroundColor: c.mint, borderRadius: 24, padding: 20, gap: 16 }}>
            <Txt v="caption" weight={600} color={c.green}>
              Butuh persetujuan Anda
            </Txt>
            <Txt>{d.approval}</Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lihat"
              onPress={() => router.navigate('/chat')}
              style={{
                height: 48,
                borderRadius: 24,
                backgroundColor: c.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt weight={600} color={c.onGreen}>
                Lihat
              </Txt>
            </Pressable>
          </View>

          <Card style={{ paddingBottom: 8 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <Txt v="subtitle">Agenda hari ini</Txt>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.navigate('/agenda')}
                style={{ paddingVertical: 12, paddingLeft: 12 }}
              >
                <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                  Lihat semua
                </Txt>
              </Pressable>
            </View>
            {d.agenda.map((a, i) => (
              <View
                key={a.time}
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  paddingVertical: 12,
                  borderBottomWidth: i < d.agenda.length - 1 ? 1 : 0,
                  borderBottomColor: c.line,
                }}
              >
                <Txt weight={600} tabular style={{ width: 52 }}>
                  {a.time}
                </Txt>
                <Txt style={{ flex: 1 }}>{a.title}</Txt>
              </View>
            ))}
          </Card>

          <Card style={{ gap: 4 }}>
            <Txt v="subtitle" style={{ marginBottom: 8 }}>
              Rumah
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <IconTile icon="snow" tinted />
              <Txt weight={500} style={{ flex: 1 }}>
                {acOn ? `AC kamar nyala · ${d.house.acTemp}°` : 'AC kamar mati'}
              </Txt>
              <Toggle value={acOn} onChange={setAcOn} label="AC kamar" />
            </View>
            {d.house.others.map((o) => (
              <View key={o.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <IconTile icon={o.icon} />
                <Txt style={{ flex: 1 }}>{o.text}</Txt>
              </View>
            ))}
          </Card>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Txt v="subtitle">Usaha</Txt>
              <Txt v="caption" color={c.muted}>
                {d.business.source}
              </Txt>
            </View>
            <View style={{ gap: 2 }}>
              <Txt v="caption" color={c.muted}>
                Penjualan hari ini
              </Txt>
              <Txt weight={600} tabular style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.28 }}>
                {d.business.sales}
              </Txt>
              <Txt weight={500} color={c.leafText}>
                {d.business.change}
              </Txt>
            </View>
            <View
              style={{
                backgroundColor: c.clayBg,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.clay }} />
              <Txt weight={500} color={c.clay} style={{ flexShrink: 1 }}>
                {d.business.alert}
              </Txt>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function IconTile({ icon, tinted = false }: { icon: IconName; tinted?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: tinted ? c.mint : c.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={22} color={tinted ? c.green : c.ink} />
    </View>
  );
}
