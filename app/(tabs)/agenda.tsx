// Niat layar: melihat satu hari sebagai rel waktu dan tahu apa yang berikutnya. Tindakan tersering: Tambah, menempel di
// zona jempol tepat di atas bilah tab (ketuk untuk menulis, mic untuk bicara).
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alarmBlocked, useAlarmStatus } from '@/alarm/useAlarmStatus';
import { daysInMonth, isoDate, MONTH_NAMES, parts } from '@/api/dates';
import { useAgenda } from '@/api/useAgenda';
import { hasUpcomingReminders, offerReminderPermission, useReminderPermission } from '@/reminders/useReminders';
import { useTheme } from '@/theme/ThemeProvider';
import { isPast, railItem } from '@/ui/agenda/AgendaItem';
import { MonthSheet } from '@/ui/agenda/MonthGrid';
import { weekDays, WeekStrip } from '@/ui/agenda/WeekStrip';
import { Icon } from '@/ui/Icon';
import { PressableScale, TimeRail, useLayoutClass } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';
import { useOpenVoice } from '@/voice/available';

export default function Agenda() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useLayoutClass() === 'compact';
  const toast = useToast();
  const alarm = useAlarmStatus();
  const agenda = useAgenda();
  const focused = useIsFocused();
  const reminderPermission = useReminderPermission();
  const { itemsOn, marked, ensureRange } = agenda;
  const [picked, setPicked] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [calendar, setCalendar] = useState(false);
  const TODAY = agenda.today;
  const NOW = agenda.now;
  const selected = picked ?? TODAY;

  // Dibuka dari notifikasi pengingat (`/agenda?id=&tanggal=`): hari item itu, dengan butirnya terbuka.
  const params = useLocalSearchParams<{ id?: string; tanggal?: string }>();
  const linkId = typeof params.id === 'string' ? params.id : null;
  const linkDate = typeof params.tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.tanggal) ? params.tanggal : null;
  const [shownLink, setShownLink] = useState<string | null>(null);
  const linked = linkId ? (agenda.items.find((i) => i.id === linkId) ?? null) : null;
  const linkKey = linkId ? `${linkId}@${linkDate}` : null;
  const linkTarget = linked?.date ?? linkDate;
  // Diatur saat render (bukan di efek), sekali per tautan: hari itu dipilih dan butirnya dibuka.
  if (linkId && linkKey !== shownLink && linkTarget) {
    setShownLink(linkKey);
    setPicked(linkTarget);
    setOpened(linkId);
  }

  // Pengingat yang tidak akan tampil karena notifikasi belum diizinkan: lembar izin dibuka sekali seumur pemasangan.
  const needsNotifications =
    reminderPermission !== null && reminderPermission !== 'granted' && hasUpcomingReminders(agenda.items, TODAY);
  useEffect(() => {
    if (needsNotifications && focused) void offerReminderPermission(reminderPermission);
  }, [needsNotifications, focused, reminderPermission]);

  // Pekan yang tampil (dan bulan di lembar kalender) dimuat bila di luar rentang bawaan.
  useEffect(() => {
    if (!selected) return;
    const days = weekDays(selected);
    void ensureRange(days[0]!, days[6]!);
  }, [selected, ensureRange]);
  useEffect(() => {
    if (!calendar || !selected) return;
    const { y, m } = parts(selected);
    void ensureRange(isoDate(y, m, 1), isoDate(y, m, daysInMonth(y, m)));
  }, [calendar, selected, ensureRange]);

  const say = (error: string | null) => {
    if (error) toast(error);
  };

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 8,
        paddingTop: compact ? 8 : 24,
        paddingBottom: compact ? 12 : 20,
      }}
    >
      <Txt v="title" accessibilityRole="header">
        Agenda
      </Txt>
      {selected ? (
        // Bulan lain satu ketukan lagi: kalender sebulan di lembar bawah.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Kalender, ${MONTH_NAMES[parts(selected).m - 1]}`}
          onPress={() => setCalendar(true)}
          android_ripple={{ color: c.ripple, borderless: true }}
          style={{ minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Txt v="row" weight={600}>
            {MONTH_NAMES[parts(selected).m - 1]}
          </Txt>
          <Icon name="chevD" size={20} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );

  if (!TODAY || !NOW || !selected) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 16, alignItems: 'flex-start' }}>
          {agenda.status === 'error' ? (
            <>
              <Txt color={c.muted}>{agenda.error}</Txt>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Coba lagi"
                onPress={() => void agenda.retry()}
                style={{
                  minHeight: 56,
                  paddingHorizontal: 28,
                  borderRadius: 28,
                  backgroundColor: c.brand,
                  justifyContent: 'center',
                }}
              >
                <Txt weight={600} color={c.onBrand}>
                  Coba lagi
                </Txt>
              </PressableScale>
            </>
          ) : (
            <Txt color={c.muted}>Sebentar, agenda sedang dimuat…</Txt>
          )}
        </View>
      </View>
    );
  }

  // Hanya diingatkan kalau memang ada pengingat yang dibunyikan HP.
  const blocked =
    alarmBlocked(alarm.status) && agenda.items.some((i) => i.way === 'alarm' && !i.done && i.kind !== 'task');
  const tz = agenda.tzOffsetMinutes;
  const isToday = selected === TODAY;
  const items = itemsOn(selected);
  const pasts = items.map((i) => isToday && isPast(i, TODAY, NOW));
  // Garis "sekarang" duduk sebelum butir pertama yang belum lewat (hari ini saja); butir itu "berikutnya".
  const firstUpcoming = pasts.indexOf(false);
  const nextIndex = isToday ? items.findIndex((it, i) => !pasts[i] && !it.done) : -1;
  const rail = items.map((it, i) =>
    railItem(
      it,
      {
        past: pasts[i]!,
        next: i === nextIndex,
        open: opened === it.id,
        tz,
        onToggle: (id) => void agenda.toggle(id).then(say),
        onOpen: (id) => setOpened((o) => (o === id ? null : id)),
        // Pratinjau layar alarm; `preview` menjaga alarm yang sebenarnya tidak ikut dimatikan atau ditunda.
        onLongPress: (id) => router.push({ pathname: '/alarm', params: { id, preview: '1' } }),
      },
      c,
    ),
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {header}
        <WeekStrip
          selected={selected}
          today={TODAY}
          marked={marked}
          onSelect={(date) => {
            setOpened(null);
            setPicked(date);
          }}
        />
        {needsNotifications ? (
          <PermissionRow
            label="Pengingat perlu izin"
            a11y="Pengingat belum bisa muncul di HP ini. Izinkan notifikasi"
            onPress={() => router.push('/izin-notifikasi')}
          />
        ) : blocked ? (
          <PermissionRow
            label="Alarm perlu izin"
            a11y="Alarm belum bisa bunyi tepat waktu. Atur izinnya"
            onPress={() => router.push('/izin-alarm')}
          />
        ) : null}
        <View style={{ paddingTop: compact ? 8 : 16, paddingLeft: 20, paddingRight: 16 }}>
          {items.length === 0 ? (
            <Txt color={c.muted} style={{ paddingVertical: 24 }}>
              {isToday ? 'Hari ini longgar.' : 'Hari itu longgar.'}
            </Txt>
          ) : (
            <TimeRail
              items={rail}
              now={isToday ? { label: NOW, before: firstUpcoming < 0 ? items.length : firstUpcoming } : undefined}
            />
          )}
        </View>
      </ScrollView>
      <AddBar onAdd={() => router.push('/agenda/tambah')} />
      <MonthSheet
        visible={calendar}
        today={TODAY}
        selected={selected}
        marked={marked}
        onClose={() => setCalendar(false)}
        onSelect={(date) => {
          setOpened(null);
          setPicked(date);
        }}
      />
    </View>
  );
}

/** Satu baris tenang di atas rel waktu: ada yang belum bisa berbunyi di HP ini, ketuk untuk mengatur izinnya. */
function PermissionRow({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const { c, marker } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        minHeight: 56,
        borderRadius: 20,
        backgroundColor: c.sunken,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name="bell" size={22} color={marker.warn.ink} />
      <Txt weight={600} color={marker.warn.ink} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Icon name="chevR" size={20} color={c.muted} />
    </Pressable>
  );
}

/**
 * "Tambah…" menempel di atas bilah tab (papan 17), di zona jempol: ketuk membuka lembar Tambah (server merapikan
 * kalimatnya), mic hijau membuka Mode Suara.
 */
function AddBar({ onAdd }: { onAdd: () => void }) {
  const { c, scheme } = useTheme();
  const openVoice = useOpenVoice();
  return (
    <View
      testID="zona-jempol"
      style={{
        backgroundColor: c.tabbar,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 8,
        boxShadow: scheme === 'dark' ? undefined : '0 -10px 24px -18px rgba(21,24,27,0.22)',
      }}
    >
      <View
        style={{
          minHeight: 56,
          borderRadius: 28,
          backgroundColor: c.sunken,
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah"
          onPress={onAdd}
          style={{ flex: 1, minHeight: 56, justifyContent: 'center', paddingLeft: 20 }}
        >
          <Txt v="row" color={c.muted} numberOfLines={1}>
            Tambah…
          </Txt>
        </Pressable>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Bicara"
          haptic="light"
          onPress={() => openVoice('push')}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="mic" size={24} color={c.onBrand} />
        </PressableScale>
      </View>
    </View>
  );
}
