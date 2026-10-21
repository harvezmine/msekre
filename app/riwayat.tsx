import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { HistoryEntry } from '@/api/contract';
import { formatJam } from '@/api/format';
import { countdownText, groupByDay, HISTORY_FILTERS, linkHref, remainingSec, STATUS_TEXT } from '@/api/history';
import { useHistory } from '@/api/useHistory';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { FilterChips } from '@/ui/FilterChips';
import { Icon } from '@/ui/Icon';
import { iconOr } from '@/ui/icons';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const LABELS = HISTORY_FILTERS.map((f) => f.label);
/** Jarak dari ujung bawah (dp) saat halaman berikutnya mulai dimuat. */
const NEAR_END = 240;

// Riwayat (desain 2m): yang sudah dikerjakan asisten, per hari, dengan Batalkan untuk kiriman yang masih tertahan.
// Daftarnya dari GET /history, halaman demi halaman.
export default function Riwayat() {
  const { c, marker } = useTheme();
  const assistant = useAssistantName();
  const [label, setLabel] = useState(LABELS[0]!);
  const kind = HISTORY_FILTERS.find((f) => f.label === label)?.kind;
  const h = useHistory(kind);
  const toast = useToast();
  const cancel = async (entry: HistoryEntry) => {
    const res = await h.cancel(entry);
    if (res.ok) toast('Kiriman dibatalkan.');
    else if (res.message) toast(res.message);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentSize.height - (contentOffset.y + layoutMeasurement.height) < NEAR_END) void h.loadMore();
  };
  const groups = groupByDay(h.items, h.now);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Riwayat" />
      <View style={{ paddingBottom: 8 }}>
        <FilterChips options={LABELS} value={label} onChange={setLabel} />
      </View>
      <ScrollView
        testID="riwayat-daftar"
        onScroll={onScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
      >
        {h.status === 'loading' && h.items.length === 0 ? (
          <Txt color={c.muted} style={{ paddingTop: 24 }}>
            Sebentar ya, saya ambil dulu.
          </Txt>
        ) : null}
        {h.status === 'error' ? (
          <View style={{ paddingTop: 24, gap: 12 }}>
            <Txt color={c.muted}>{h.error}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void h.retry()}>
              <Txt weight={600} color={c.brandInk}>
                Coba lagi
              </Txt>
            </Pressable>
          </View>
        ) : null}
        {h.status === 'ready' && h.items.length === 0 ? (
          <Txt color={c.muted} style={{ paddingTop: 24 }}>
            Belum ada yang dikerjakan di sini. Nanti muncul begitu {assistant} mulai bekerja.
          </Txt>
        ) : null}
        {groups.map((g) => (
          <View key={g.day}>
            <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingTop: 8, paddingBottom: 12 }}>
              {g.day}
            </Txt>
            {g.items.map((entry, i) => (
              <Entry
                key={entry.id}
                entry={entry}
                last={i === g.items.length - 1}
                now={h.now}
                busy={!!entry.undoable && h.cancelling.has(entry.undoable.draftId)}
                onCancel={() => void cancel(entry)}
              />
            ))}
          </View>
        ))}
        {h.hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tampilkan yang lebih lama"
            accessibilityState={{ disabled: h.loadingMore }}
            disabled={h.loadingMore}
            onPress={() => void h.loadMore()}
            style={{ height: 48, justifyContent: 'center', alignItems: 'center', opacity: h.loadingMore ? 0.5 : 1 }}
          >
            <Txt weight={600} color={c.brandInk}>
              {h.loadingMore ? 'Sebentar ya…' : 'Tampilkan yang lebih lama'}
            </Txt>
          </Pressable>
        ) : null}
        {h.moreError ? (
          <Txt v="caption" color={marker.warn.ink} style={{ textAlign: 'center' }}>
            {h.moreError}
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Entry({
  entry,
  last,
  now,
  busy,
  onCancel,
}: {
  entry: HistoryEntry;
  last: boolean;
  now: number;
  busy: boolean;
  onCancel: () => void;
}) {
  const { c, shadow, marker } = useTheme();
  const struck = entry.status === 'dibatalkan';
  const strike = struck ? ({ textDecorationLine: 'line-through' } as const) : null;
  const href = linkHref(entry.link);
  const jam = formatJam(entry.at);
  const line = entry.detail ? `${jam} · ${entry.detail}` : jam;
  const left = entry.undoable ? remainingSec(entry.undoable.until, now) : 0;
  const body = (
    <>
      <Txt weight={500} color={struck ? c.muted : c.text} style={strike}>
        {entry.title}
      </Txt>
      <Txt v="caption" color={c.muted} style={strike}>
        {line}
      </Txt>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={iconOr(entry.icon, 'history')} size={20} color={c.text} />
        </View>
        {last ? null : <View style={{ flex: 1, width: 1.5, backgroundColor: c.line }} />}
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 8, paddingBottom: 20 }}>
        {href ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${entry.title}. ${line}`}
            onPress={() => router.push(href)}
            style={{ gap: 2 }}
          >
            {body}
          </Pressable>
        ) : (
          <View style={{ gap: 2 }}>{body}</View>
        )}
        {entry.status && !(entry.status === 'menunggu' && entry.undoable && left > 0) ? (
          <Txt
            v="caption"
            weight={600}
            color={entry.status === 'terkirim' ? c.brandInk : entry.status === 'gagal' ? marker.warn.ink : c.muted}
          >
            {STATUS_TEXT[entry.status]}
          </Txt>
        ) : null}
        {entry.undoable && left > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Batalkan"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onCancel}
              android_ripple={{ color: c.ripple }}
              style={{
                height: 48,
                paddingHorizontal: 16,
                borderRadius: 24,
                boxShadow: shadow.e1,
                backgroundColor: c.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Icon name="undo" size={18} />
              <Txt weight={600} style={{ fontSize: 15 }}>
                Batalkan
              </Txt>
            </Pressable>
            <Txt v="caption" color={c.muted} tabular>
              sisa {countdownText(left)}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}
