import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HistoryEntry } from '@/api/contract';
import { formatJam } from '@/api/format';
import { countdownText, groupByDay, HISTORY_FILTERS, linkHref, remainingSec, STATUS_TEXT } from '@/api/history';
import { useHistory } from '@/api/useHistory';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { iconOr } from '@/ui/icons';
import { AccentIcon, ChoiceSheet, PressableScale, type AccentTone } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const LABELS = HISTORY_FILTERS.map((f) => f.label);
/** Jarak dari ujung bawah (dp) saat halaman berikutnya mulai dimuat. */
const NEAR_END = 240;

// Niat layar: melihat apa yang sudah dikerjakan asisten, per hari, sebagai garis waktu (ikon, judul, jam). Tindakan
// tersering: Batalkan kiriman yang masih tertahan (dengan hitung mundur). Saringan satu tombol di kepala.
// Daftarnya dari GET /history, halaman demi halaman.
export default function Riwayat() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const assistant = useAssistantName();
  const [label, setLabel] = useState(LABELS[0]!);
  const [picking, setPicking] = useState(false);
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
      <View
        style={{
          paddingTop: insets.top,
          minHeight: 64 + insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 8,
          paddingRight: 12,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <Txt v="header" accessibilityRole="header" style={{ flex: 1 }}>
          Riwayat
        </Txt>
        {/* Saringan: satu tombol tenang, pilihannya di lembar bawah. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Saring: ${label}`}
          onPress={() => setPicking(true)}
          hitSlop={4}
          android_ripple={{ color: c.ripple, borderless: true }}
          style={{
            minHeight: 44,
            borderRadius: 22,
            paddingLeft: 16,
            paddingRight: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: label === LABELS[0] ? c.sunken : c.brandSoft,
          }}
        >
          <Txt v="label" color={label === LABELS[0] ? c.text : c.brandInk}>
            {label}
          </Txt>
          <Icon name="chevD" size={18} color={label === LABELS[0] ? c.text : c.brandInk} />
        </Pressable>
      </View>
      <ChoiceSheet
        visible={picking}
        title="Tampilkan"
        choices={LABELS.map((l) => ({ id: l, label: l }))}
        value={label}
        onPick={setLabel}
        onClose={() => setPicking(false)}
      />
      <ScrollView
        testID="riwayat-daftar"
        onScroll={onScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
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
            <Txt v="section" accessibilityRole="header" style={{ paddingTop: 12, paddingBottom: 12 }}>
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

/** Penanda kategori per jenis: warna hanya pada ikon di lingkaran netral (§1.3). */
const TONE: Partial<Record<HistoryEntry['kind'], AccentTone>> = {
  kirim: 'terhubung',
  rumah: 'rumah',
  agenda: 'agenda',
  usaha: 'usaha',
  bayar: 'brand',
  sambung: 'terhubung',
};

/** Satu titik di garis waktu: ikon (penanda kategori) di rel, judul, jam di kanan, satu keterangan kecil bila ada. */
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
  const { c, marker } = useTheme();
  const struck = entry.status === 'dibatalkan';
  const strike = struck ? ({ textDecorationLine: 'line-through' } as const) : null;
  const href = linkHref(entry.link);
  const jam = formatJam(entry.at);
  const left = entry.undoable ? remainingSec(entry.undoable.until, now) : 0;
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Txt v="row" color={struck ? c.muted : c.text} style={[{ flex: 1 }, strike]}>
          {entry.title}
        </Txt>
        <Txt v="caption" color={c.muted} tabular>
          {jam}
        </Txt>
      </View>
      {entry.detail ? (
        <Txt v="caption" color={c.muted} style={strike}>
          {entry.detail}
        </Txt>
      ) : null}
    </>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <AccentIcon icon={iconOr(entry.icon, 'history')} tone={TONE[entry.kind] ?? 'neutral'} size={44} />
        {last ? null : <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: c.line, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 10, paddingBottom: 22 }}>
        {href ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[entry.title, jam, entry.detail].filter(Boolean).join('. ')}
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
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Batalkan"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              haptic="light"
              onPress={onCancel}
              style={{
                minHeight: 48,
                paddingHorizontal: 18,
                borderRadius: 24,
                backgroundColor: c.sunken,
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
            </PressableScale>
            <Txt v="caption" color={c.muted} tabular>
              sisa {countdownText(left)}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}
