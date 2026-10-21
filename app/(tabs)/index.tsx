import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Draft } from '@/api/contract';
import { useHome } from '@/api/useHome';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { iconOr, type IconName } from '@/ui/icons';
import { PlaceButton } from '@/ui/PlaceButton';
import { Orbit } from '@/ui/orbit/Orbit';
import { useLive } from '@/ui/useLive';
import { ringLabel } from '@/ui/orbit/label';
import { Toggle } from '@/ui/Toggle';
import { Initials } from '@/ui/Initials';
import { Txt } from '@/ui/Txt';

/** Kalimat kartu persetujuan: dari server (`ask`), atau disusun dari jenis dan penerimanya. */
function approvalText(d: Draft): string {
  return d.ask ?? `${d.what[0]!.toUpperCase()}${d.what.slice(1)} untuk ${d.to} sudah siap. Kirim?`;
}

/** Isi muncul memudar sekejap saat Beranda selesai dimuat (tanpa kerangka). */
function FadeIn({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [reduce, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function Beranda() {
  const { c } = useTheme();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const dispatch = useSampleDispatch();
  const { home, ring, status, error, retry, controlDevice } = useHome();
  const approval = home?.approvals[0] ?? null;
  const alert = home?.business?.alert ?? null;

  // Sakelar AC: lewat kendali perangkat di server (asli atau tiruan); Beranda ikut event `home`.
  const switchAc = async (deviceId: string, on: boolean) => {
    const failed = await controlDevice(deviceId, on);
    if (failed) dispatch({ type: 'showToast', text: failed });
  };

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
            <Initials />
          </Pressable>
        </View>

        {!home ? (
          status === 'error' ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 32, gap: 16, alignItems: 'flex-start' }}>
              <Txt>{error}</Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Coba lagi"
                onPress={() => void retry()}
                style={{
                  height: 48,
                  paddingHorizontal: 24,
                  borderRadius: 24,
                  backgroundColor: c.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt weight={600} color={c.onGreen}>
                  Coba lagi
                </Txt>
              </Pressable>
            </View>
          ) : null
        ) : (
          <FadeIn>
            <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
              <Txt v="display">{home.greetingName ? `Selamat pagi, ${home.greetingName}` : 'Selamat pagi'}</Txt>
              <Txt v="subtitle" weight={400} color={c.muted}>
                {home.summary}
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
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
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
                {home.agendaToday.map((a, i) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      gap: 16,
                      paddingVertical: 12,
                      borderBottomWidth: i < home.agendaToday.length - 1 ? 1 : 0,
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
                {home.house.lines.map((line) => {
                  // Baris AC punya sakelar dan ikon berwarna; baris lain hanya keterangan.
                  const ac = line.on !== undefined;
                  return (
                    <View
                      key={line.deviceId}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
                    >
                      <IconTile icon={iconOr(line.icon, 'home')} tinted={ac} />
                      <Txt weight={ac ? 500 : undefined} style={{ flex: 1 }}>
                        {line.text}
                      </Txt>
                      {ac && line.switchable ? (
                        <Toggle
                          value={line.on === true}
                          onChange={(on) => void switchAc(line.deviceId, on)}
                          label={line.label ?? line.text}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </Card>

              {home.business ? (
                <Card style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Txt v="subtitle">Usaha</Txt>
                    <Txt v="caption" color={c.muted}>
                      {home.business.source}
                    </Txt>
                  </View>
                  <View style={{ gap: 2 }}>
                    <Txt v="caption" color={c.muted}>
                      Penjualan hari ini
                    </Txt>
                    <Txt weight={600} tabular style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.28 }}>
                      {home.business.sales}
                    </Txt>
                    <Txt weight={500} color={home.business.down ? c.clay : c.leafText}>
                      {home.business.change}
                    </Txt>
                  </View>
                  {alert ? (
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
                        {alert}
                      </Txt>
                    </View>
                  ) : null}
                </Card>
              ) : null}
            </View>
          </FadeIn>
        )}
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
