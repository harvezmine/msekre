import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeSummary, user } from '@/sample/profile';
import { approvalText, homeAgenda, houseCard, pendingApproval, ringNodes, useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { PlaceButton } from '@/ui/PlaceButton';
import { Orbit } from '@/ui/orbit/Orbit';
import { useLive } from '@/ui/useLive';
import { ringLabel } from '@/ui/orbit/label';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';

export default function Beranda() {
  const { c } = useTheme();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useSample();
  const approval = pendingApproval(state);
  const ring = ringNodes(state);
  const today = homeAgenda(state);

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
          <PlaceButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
            onPress={() => router.push('/akun')}
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
              {user.initials}
            </Txt>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
          <Txt v="display">Selamat pagi, {user.name}</Txt>
          <Txt v="subtitle" weight={400} color={c.muted}>
            {homeSummary}
          </Txt>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' }}>
          <Orbit
            nodes={ring}
            paused={!live}
            onPressRing={() => router.push('/terhubung')}
            onPressInti={() => router.navigate('/chat')}
            onLongPressInti={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/suara');
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ringLabel(ring)}
            onPress={() => router.push('/terhubung')}
            style={{ height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Txt v="caption" color={c.muted}>
              {ringLabel(ring)}
            </Txt>
            <Icon name="chevR" size={16} color={c.muted} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          {approval ? (
            <View style={{ backgroundColor: c.mint, borderRadius: 24, padding: 20, gap: 16 }}>
              <Txt v="caption" weight={600} color={c.green}>
                Butuh persetujuan Anda
              </Txt>
              <Txt>{approvalText(approval)}</Txt>
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
          ) : null}

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
            {today.map((a, i) => (
              <View
                key={a.id}
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  paddingVertical: 12,
                  borderBottomWidth: i < today.length - 1 ? 1 : 0,
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
            {houseCard(state).map(({ device: d, text }) => {
              // Baris AC punya sakelar dan ikon berwarna; baris lain hanya keterangan.
              const ac = d.kind === 'ac';
              return (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                  <IconTile icon={d.icon} tinted={ac} />
                  <Txt weight={ac ? 500 : undefined} style={{ flex: 1 }}>
                    {text}
                  </Txt>
                  {ac && d.reachable ? (
                    <Toggle
                      value={d.on}
                      onChange={(on) => dispatch({ type: 'setAc', deviceId: d.id, on, source: 'aplikasi' })}
                      label={d.name}
                    />
                  ) : null}
                </View>
              );
            })}
          </Card>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Txt v="subtitle">Usaha</Txt>
              <Txt v="caption" color={c.muted}>
                {state.business.source}
              </Txt>
            </View>
            <View style={{ gap: 2 }}>
              <Txt v="caption" color={c.muted}>
                Penjualan hari ini
              </Txt>
              <Txt weight={600} tabular style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.28 }}>
                {state.business.sales}
              </Txt>
              <Txt weight={500} color={c.leafText}>
                {state.business.change}
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
                {state.business.alert}
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
