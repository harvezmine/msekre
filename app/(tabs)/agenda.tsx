import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AgendaItem as Item } from '@/api/contract';
import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { useAgenda } from '@/api/useAgenda';
import { daysInMonth, dayLabel, isoDate, parts } from '@/sample/dates';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { AgendaItem, isPast } from '@/ui/agenda/AgendaItem';
import { MonthGrid } from '@/ui/agenda/MonthGrid';
import { NowLine } from '@/ui/agenda/NowLine';
import { WeekList } from '@/ui/agenda/WeekList';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Segmented } from '@/ui/Segmented';
import { Initials } from '@/ui/Initials';
import { Txt } from '@/ui/Txt';

const SEGMENTS = ['Hari ini', 'Minggu ini', 'Kalender'] as const;
type Segment = (typeof SEGMENTS)[number];

export default function Agenda() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useSampleDispatch();
  const alarm = useAlarmStatus();
  const agenda = useAgenda();
  const { itemsOn, marked, leftover, ensureRange } = agenda;
  const [segment, setSegment] = useState<Segment>('Hari ini');
  const [picked, setSelected] = useState<string | null>(null);
  const TODAY = agenda.today;
  const NOW = agenda.now;

  // Kalender menampilkan satu bulan penuh: pastikan agenda bulan itu sudah dimuat.
  useEffect(() => {
    if (segment !== 'Kalender' || !TODAY) return;
    const { y, m } = parts(TODAY);
    void ensureRange(isoDate(y, m, 1), isoDate(y, m, daysInMonth(y, m)));
  }, [segment, TODAY, ensureRange]);

  const say = (error: string | null) => {
    if (error) toast({ type: 'showToast', text: error });
  };

  if (!TODAY || !NOW) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top, paddingHorizontal: 20 }}>
        <Txt v="title" accessibilityRole="header" style={{ paddingTop: 8 }}>
          Agenda
        </Txt>
        {agenda.status === 'error' ? (
          <View style={{ paddingTop: 24, gap: 12 }}>
            <Txt color={c.muted}>{agenda.error}</Txt>
            <PillButton label="Coba lagi" green onPress={() => void agenda.retry()} />
          </View>
        ) : (
          <Txt color={c.muted} style={{ paddingTop: 24 }}>
            Sebentar, agenda sedang dimuat…
          </Txt>
        )}
      </View>
    );
  }

  const selected = picked ?? TODAY;
  // Hanya diingatkan kalau memang ada pengingat yang dibunyikan HP.
  const blocked =
    alarmBlocked(alarm.status) && agenda.items.some((i) => i.way === 'alarm' && !i.done && i.kind !== 'task');
  const onToggle = (id: string) => void agenda.toggle(id).then(say);
  const onLongPress = (id: string) => router.push({ pathname: '/alarm', params: { id } });

  const today = itemsOn(TODAY);
  const remaining = today.filter((a) => !isPast(a, TODAY, NOW) && !a.done).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 20,
            paddingRight: 16,
          }}
        >
          <Txt v="title" accessibilityRole="header">
            Agenda
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akun"
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
        {blocked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alarm belum bisa bunyi tepat waktu. Atur izinnya"
            onPress={() => router.push('/izin-alarm')}
            android_ripple={{ color: c.ripple }}
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 20,
              backgroundColor: c.clayBg,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="bell" size={22} color={c.clay} />
            <View style={{ flex: 1 }}>
              <Txt weight={600} color={c.clay}>
                Alarm belum bisa bunyi tepat waktu
              </Txt>
              <Txt v="caption" color={c.muted}>
                Ada izin yang perlu dinyalakan. Ketuk untuk mengaturnya.
              </Txt>
            </View>
            <Icon name="chevR" size={20} color={c.muted} />
          </Pressable>
        ) : null}
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Segmented options={SEGMENTS} value={segment} onChange={setSegment} label="Tampilan agenda" />
        </View>

        {segment === 'Hari ini' ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                paddingTop: 24,
                paddingHorizontal: 20,
                paddingBottom: 8,
              }}
            >
              <Txt v="subtitle" accessibilityRole="header">
                {dayLabel(TODAY)}
              </Txt>
              {remaining > 0 ? (
                <Txt v="caption" color={c.muted}>
                  {remaining} lagi hari ini
                </Txt>
              ) : null}
            </View>
            {leftover ? (
              <Card style={{ marginHorizontal: 16, marginTop: 8, paddingTop: 16, paddingBottom: 20, gap: 12 }}>
                <Txt weight={600} color={c.green} style={{ fontSize: 15, lineHeight: 20 }}>
                  Kemarin belum selesai
                </Txt>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <Icon name="task" size={24} color={c.muted} />
                  <Txt style={{ flex: 1 }}>{leftover.title}</Txt>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PillButton
                    label="Kerjakan hari ini"
                    green
                    onPress={() => void agenda.resolveLeftover('today').then(say)}
                  />
                  <PillButton label="Lepaskan" onPress={() => void agenda.resolveLeftover('drop').then(say)} />
                </View>
              </Card>
            ) : null}
            <View style={{ paddingTop: 16, paddingHorizontal: 16 }}>
              {today.length === 0 ? (
                <EmptyDay text="Hari ini longgar. Mau saya ingatkan sesuatu?" />
              ) : (
                <DayList items={today} today={TODAY} now={NOW} showNow onToggle={onToggle} onLongPress={onLongPress} />
              )}
            </View>
          </>
        ) : null}

        {segment === 'Minggu ini' ? (
          <WeekList today={TODAY} now={NOW} itemsOn={itemsOn} onToggle={onToggle} onLongPress={onLongPress} />
        ) : null}

        {segment === 'Kalender' ? (
          <>
            <MonthGrid today={TODAY} selected={selected} marked={marked} onSelect={setSelected} />
            <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 4 }}>
              <Txt v="subtitle" accessibilityRole="header">
                {dayLabel(selected)}
              </Txt>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {itemsOn(selected).length === 0 ? (
                <EmptyDay
                  text={
                    selected === TODAY
                      ? 'Hari ini longgar. Mau saya ingatkan sesuatu?'
                      : 'Hari itu masih longgar. Mau saya ingatkan sesuatu?'
                  }
                />
              ) : (
                <DayList
                  items={itemsOn(selected)}
                  today={TODAY}
                  now={NOW}
                  onToggle={onToggle}
                  onLongPress={onLongPress}
                />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah"
        onPress={() => router.push('/agenda/tambah')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 16,
          height: 56,
          paddingLeft: 18,
          paddingRight: 24,
          borderRadius: 28,
          backgroundColor: c.green,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          elevation: 3,
          shadowColor: '#0D2B22',
          shadowOpacity: scheme === 'dark' ? 0.4 : 0.14,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Icon name="plus" size={22} color={c.onGreen} />
        <Txt weight={600} color={c.onGreen}>
          Tambah
        </Txt>
      </Pressable>
    </View>
  );
}

function PillButton({ label, green = false, onPress }: { label: string; green?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        flex: 1,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt weight={600} color={green ? c.green : c.ink} style={{ fontSize: 15 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function EmptyDay({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <Txt color={c.muted} style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
      {text}
    </Txt>
  );
}

function DayList({
  items,
  today,
  now,
  showNow = false,
  onToggle,
  onLongPress,
}: {
  items: Item[];
  today: string;
  now: string;
  showNow?: boolean;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const pasts = items.map((item) => isPast(item, today, now));
  // Garis "sekarang" duduk sebelum item pertama yang belum lewat, atau di akhir bila semua sudah lewat.
  const firstUpcoming = showNow ? pasts.indexOf(false) : -2;
  return (
    <View>
      {items.map((item, i) => (
        <View key={item.id}>
          {i === firstUpcoming ? <NowLine now={now} /> : null}
          <AgendaItem item={item} past={pasts[i]} onToggle={onToggle} onLongPress={onLongPress} />
        </View>
      ))}
      {firstUpcoming === -1 ? <NowLine now={now} /> : null}
    </View>
  );
}
