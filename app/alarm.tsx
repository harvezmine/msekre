import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import type { AgendaItem } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { useAuth } from '@/api/useAuth';
import { useAssistantName } from '@/api/useProfile';
import { getAlarmScheduler } from '@/alarm';
import { SNOOZE_MINUTES, snoozeAlarm } from '@/alarm/snooze';
import { localAlarmItem, TEST_ALARM_ID, testAlarmItem } from '@/alarm/testAlarm';
import { ALARM_SAMPLE_ID } from '@/sample/agenda';
import { dayLabel } from '@/sample/dates';
import { useSampleDispatch } from '@/sample/store';
import { light, onForest } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Inti } from '@/ui/inti/Inti';
import { SwipeToConfirm } from '@/ui/SwipeToConfirm';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

const BUZZ_MS = 2000;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Alarm layar penuh (desain 2l). Dibuka dari alarm di HP (`sekretarisai://alarm?id=&title=`) atau dengan menahan sebuah
// pengingat di Agenda (`preview=1`: hanya melihat, alarm aslinya tidak disentuh). Itemnya dimuat lewat kontrak; kalau
// tidak bisa (tanpa internet, sesi habis), layar tetap tampil dari catatan alarm di HP atau judul di tautan, dengan
// Tunda dan Matikan tapi tanpa "Tanya". Getarnya berpola dan berulang selama layar terbuka. Izin tampil di atas layar
// kunci dilepas begitu layar ini ditutup, ditinggalkan, atau aplikasi ke latar.
export default function Alarm() {
  const assistantName = useAssistantName();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const toast = useSampleDispatch();
  const { mode } = useApi();
  const { status: auth } = useAuth();
  const agenda = useAgenda();
  const params = useLocalSearchParams<{ id?: string; title?: string; preview?: string }>();
  const preview = one(params.preview) === '1';
  const titleParam = one(params.title);
  // Mode contoh tanpa id (dibuka dari menu uji): pengingat contoh. Mode server tanpa id: tidak ada yang dibunyikan.
  const id = one(params.id) ?? (mode === 'contoh' ? ALARM_SAMPLE_ID : undefined);
  // Hanya dengan sesi aktif (atau mode contoh) item bisa dimuat, tunda dikabarkan ke server, dan chat dibuka.
  const online = mode === 'contoh' || auth === 'signedIn';
  const [loaded, setLoaded] = useState<AgendaItem | null>(null);
  // Alarm percobaan dari layar izin alarm hanya ada di HP ini: itemnya dibuat dari jadwal lokal.
  const [test, setTest] = useState<AgendaItem | null>(null);
  // Saat layar dibuka: jam yang ditampilkan bila hanya judul dari tautan yang diketahui.
  const [openedAt] = useState(() => Date.now());
  // Catatan alarm yang berbunyi di HP: cadangan kalau item agendanya tidak bisa dimuat.
  const [ringing, setRinging] = useState<AgendaItem | null>(null);
  const full =
    id === TEST_ALARM_ID ? test : (agenda.items.find((a) => a.id === id) ?? (loaded?.id === id ? loaded : null));
  const fallback =
    ringing && ringing.id === id
      ? ringing
      : id && titleParam
        ? localAlarmItem({ id, at: openedAt, title: titleParam })
        : null;
  const item = full ?? fallback;
  const { item: load } = agenda;
  useEffect(() => {
    if (id !== TEST_ALARM_ID) return;
    let stale = false;
    void getAlarmScheduler()
      .list()
      .then((all) => {
        const mine = all.find((a) => a.id === TEST_ALARM_ID);
        // Sudah berbunyi (tidak lagi terjadwal) atau dibuka tanpa jadwal: jam sekarang.
        if (!stale) setTest(testAlarmItem(mine?.at ?? Date.now()));
      });
    return () => {
      stale = true;
    };
  }, [id]);
  useEffect(() => {
    if (!id || id === TEST_ALARM_ID || preview) return;
    let stale = false;
    void getAlarmScheduler()
      .getRinging(id)
      .then((found) => {
        if (!stale && found) setRinging(localAlarmItem(found));
      });
    return () => {
      stale = true;
    };
  }, [id, preview]);
  useEffect(() => {
    if (!id || id === TEST_ALARM_ID || !online || agenda.items.some((a) => a.id === id)) return;
    let stale = false;
    void load(id).then((found) => {
      if (!stale) setLoaded(found);
    });
    return () => {
      stale = true;
    };
  }, [id, load, agenda.items, online]);

  // Izin tampil di atas layar kunci dilepas begitu layar ini tidak lagi dipakai: ditutup (tombol, geser, Kembali),
  // aplikasi ke latar, atau pindah ke layar lain. Bukan hanya saat Matikan atau Tunda ditekan.
  const release = useCallback(() => void getAlarmScheduler().releaseLockScreen(), []);
  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'background') release();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      release();
      return false;
    });
    return () => {
      app.remove();
      back.remove();
      release();
    };
  }, [release]);

  // Getar hanya selama layar ini terlihat dan aplikasi aktif; setelah pindah ke chat atau ke latar, berhenti.
  useEffect(() => {
    if (!live) return;
    const buzz = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    buzz();
    const t = setInterval(buzz, BUZZ_MS);
    return () => clearInterval(t);
  }, [live]);

  const busy = useRef(false);
  if (!item) return null;
  const isFlight = item.id === ALARM_SAMPLE_ID;
  // "Tanya" butuh item dari server dan sesi aktif; alarm dari catatan HP hanya bisa ditunda atau dimatikan.
  const canAsk = full !== null && online;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const stop = () => {
    if (preview) return leave();
    // Notifikasi alarm yang sedang berbunyi dimatikan, dan aplikasi tidak lagi tampil di atas layar kunci.
    const scheduler = getAlarmScheduler();
    void scheduler.cancel(item.id).then(() => scheduler.releaseLockScreen());
    leave();
  };

  const snooze = async () => {
    if (preview) return leave();
    if (busy.current) return;
    busy.current = true;
    const scheduler = getAlarmScheduler();
    if (item.id === TEST_ALARM_ID) {
      // Alarm percobaan: tidak ada server, jadwal ulang langsung di HP.
      await scheduler.cancel(item.id);
      await scheduler.schedule({
        id: item.id,
        at: Date.now() + SNOOZE_MINUTES * 60_000,
        title: item.title,
        note: item.note,
      });
      void scheduler.releaseLockScreen();
      return leave();
    }
    // Dipasang di HP lebih dulu (tanpa menunggu internet), baru dikabarkan ke server. Server tidak terjangkau: alarm
    // tundaan tetap berbunyi pada waktunya dan kabarnya diulang pada penyamaan alarm berikutnya.
    const result = await snoozeAlarm({ scheduler, item, snooze: online ? agenda.snooze : null });
    void scheduler.releaseLockScreen();
    if (!result.armed) {
      toast({ type: 'showToast', text: 'Alarm belum bisa bunyi di HP ini. Cek izinnya di Akun.' });
    }
    leave();
  };

  const ask = async () => {
    if (busy.current) return;
    busy.current = true;
    // HP terkunci: minta dibuka dulu. Tanpa itu, chat dan isinya terbuka di atas layar kunci.
    const unlocked = preview || (await getAlarmScheduler().dismissKeyguard());
    busy.current = false;
    if (!unlocked) {
      toast({ type: 'showToast', text: `Buka kunci HP dulu untuk bertanya ke ${assistantName}.` });
      return;
    }
    router.replace('/chat');
  };

  return (
    <View style={{ flex: 1, backgroundColor: light.voice }}>
      <StatusBar style="light" />
      <View style={{ alignItems: 'center', paddingTop: insets.top + 56, paddingHorizontal: 28, gap: 8 }}>
        <Inti size={96} onDark paused={!live} />
        <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="bell" size={16} color={onForest.soft} />
          <Txt weight={600} color={onForest.soft} style={{ fontSize: 15, lineHeight: 20 }}>
            Pengingat · {dayLabel(item.date)}
          </Txt>
        </View>
        {preview ? (
          <Txt v="caption" color={onForest.soft} style={{ textAlign: 'center' }}>
            Ini hanya pratinjau. Alarm yang sebenarnya tidak berubah.
          </Txt>
        ) : null}
        <Txt
          weight={600}
          tabular
          color={onForest.strong}
          maxFontSizeMultiplier={1.2}
          style={{ fontSize: 96, lineHeight: 104, letterSpacing: -2.9 }}
        >
          {item.time}
        </Txt>
        <Txt weight={600} color={onForest.strong} style={{ fontSize: 28, lineHeight: 36, textAlign: 'center' }}>
          {item.title}
        </Txt>
        {item.note ? (
          <View
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(236,242,234,0.12)',
              backgroundColor: 'rgba(236,242,234,0.07)',
              paddingVertical: 14,
              paddingHorizontal: 18,
            }}
          >
            <Icon name={isFlight ? 'plane' : 'note'} size={22} color="#81C084" />
            <Txt color={onForest.text} style={{ flexShrink: 1, fontSize: 17 }}>
              {item.note}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(40, insets.bottom + 16), gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <AlarmButton label={`Tunda ${SNOOZE_MINUTES} menit`} onPress={() => void snooze()} />
          {canAsk ? (
            <AlarmButton label={`Tanya ${assistantName}`} onPress={() => void ask()}>
              <Inti size={24} onDark paused />
            </AlarmButton>
          ) : null}
        </View>
        <SwipeToConfirm label="Geser untuk mematikan" actionLabel="Matikan" onConfirm={stop} />
      </View>
    </View>
  );
}

function AlarmButton({ label, onPress, children }: { label: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(236,242,234,0.16)' }}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: onForest.buttonLine,
        backgroundColor: onForest.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {children}
      <Txt weight={600} color={onForest.text}>
        {label}
      </Txt>
    </Pressable>
  );
}
