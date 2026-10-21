import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import type { AgendaItem } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { useAuth } from '@/api/useAuth';
import { useAssistantName } from '@/api/useProfile';
import { getAlarmScheduler } from '@/alarm';
import { SNOOZE_MINUTES, snoozeAlarm } from '@/alarm/snooze';
import { localAlarmItem, TEST_ALARM_ID, testAlarmItem } from '@/alarm/testAlarm';
import { ringWindowEnd } from '@/alarm/ringWindow';
import type { ScheduledAlarm } from '@/alarm/types';
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

// Alarm layar penuh (desain 2l). Dibuka dari alarm di HP (`sekretarisai://alarm?id=`) atau dengan menahan sebuah
// pengingat di Agenda (`preview=1`: hanya melihat, alarm aslinya tidak disentuh). Itemnya dimuat lewat kontrak; kalau
// tidak bisa (tanpa internet, sesi habis), layar tetap tampil dari catatan alarm di HP (`getRinging`), dengan Tunda dan
// Matikan tapi tanpa "Tanya". Getarnya berpola dan berulang selama layar terbuka dan jendela bunyi belum habis.
// Izin tampil di atas layar kunci dilepas saat Matikan, Tunda, jendela bunyi habis (layar menutup sendiri, getar
// berhenti, dan di HP terkunci aplikasi pindah ke latar), atau layar ini ditutup. Aplikasi ke latar TIDAK melepasnya:
// Android menjeda aplikasi sebentar saat tampil di atas layar kunci dan saat meminta buka kunci; native yang menjaga
// jeda yang sungguhan (`releaseIfIdle`).
export default function Alarm() {
  const assistantName = useAssistantName();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const toast = useSampleDispatch();
  const { mode } = useApi();
  const { status: auth } = useAuth();
  const agenda = useAgenda();
  const params = useLocalSearchParams<{ id?: string; preview?: string }>();
  const preview = one(params.preview) === '1';
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
  const [ringingRecord, setRingingRecord] = useState<ScheduledAlarm | null>(null);
  const ringing = ringingRecord ? localAlarmItem(ringingRecord) : null;
  const full =
    id === TEST_ALARM_ID ? test : (agenda.items.find((a) => a.id === id) ?? (loaded?.id === id ? loaded : null));
  const fallback = ringing && ringing.id === id ? ringing : null;
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
        if (!stale && found) setRingingRecord(found);
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

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // Izin tampil di atas layar kunci dilepas begitu layar ini tidak lagi dipakai: ditutup (Kembali, geser, layar lain
  // menggantikan), Matikan, Tunda, atau jendela bunyi habis. Pratinjau tidak pernah menyentuhnya. Aplikasi ke latar
  // sengaja TIDAK melepasnya (lihat catatan di atas).
  const release = useCallback(() => {
    if (!preview) void getAlarmScheduler().releaseLockScreen();
  }, [preview]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      release();
      return false;
    });
    return () => {
      back.remove();
      release();
    };
  }, [release]);

  // Jendela bunyi: sampai `until` dari catatan di HP, kalau tidak ada waktu alarm + 10 menit, kalau tidak ada 10 menit
  // sejak layar dibuka. Habis: getar berhenti, izin dilepas (ditunggu dulu supaya layar lain tidak tampil di atas layar
  // kunci), layar menutup, dan di HP terkunci aplikasi pindah ke latar sehingga layar kunci kembali.
  const [expired, setExpired] = useState(false);
  const windowEnd = ringWindowEnd(ringingRecord, openedAt);
  useEffect(() => {
    if (preview || !id) return;
    const timer = setTimeout(
      () => {
        setExpired(true);
        const scheduler = getAlarmScheduler();
        void scheduler.releaseLockScreen().then(() => {
          leave();
          return scheduler.moveToBack();
        });
      },
      Math.max(0, windowEnd - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [preview, id, windowEnd, leave]);

  // Getar hanya selama layar ini terlihat, aplikasi aktif, dan jendela bunyi belum habis; setelah pindah ke chat atau
  // ke latar, berhenti.
  useEffect(() => {
    if (!live || expired) return;
    const buzz = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    buzz();
    const t = setInterval(buzz, BUZZ_MS);
    return () => clearInterval(t);
  }, [live, expired]);

  const busy = useRef(false);
  if (!item) return null;
  const isFlight = item.id === ALARM_SAMPLE_ID;
  // "Tanya" butuh item dari server dan sesi aktif; alarm dari catatan HP hanya bisa ditunda atau dimatikan.
  const canAsk = full !== null && online;

  const stop = async () => {
    if (preview) return leave();
    if (busy.current) return;
    busy.current = true;
    // Notifikasi alarm yang sedang berbunyi dimatikan, dan aplikasi tidak lagi tampil di atas layar kunci. Pindah layar
    // baru sesudah izinnya lepas, supaya Beranda atau chat tidak sempat tampil di atas layar kunci.
    const scheduler = getAlarmScheduler();
    await scheduler.cancel(item.id);
    await scheduler.releaseLockScreen();
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
      await scheduler.releaseLockScreen();
      return leave();
    }
    // Dipasang di HP lebih dulu (tanpa menunggu internet), baru dikabarkan ke server. Server tidak terjangkau: alarm
    // tundaan tetap berbunyi pada waktunya dan kabarnya diulang pada penyamaan alarm berikutnya.
    const result = await snoozeAlarm({ scheduler, item, snooze: online ? agenda.snooze : null });
    await scheduler.releaseLockScreen();
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
        <SwipeToConfirm label="Geser untuk mematikan" actionLabel="Matikan" onConfirm={() => void stop()} />
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
