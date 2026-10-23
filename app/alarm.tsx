import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/ui/kit/PressableScale';
import { useLayoutClass } from '@/ui/kit/layout';
import { useApi } from '@/api/ApiProvider';
import type { AgendaItem } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { dayLabel } from '@/api/dates';
import { DEMO_ALARM_ID } from '@/api/demo';
import { needsSignIn } from '@/api/mode';
import { useAuth } from '@/api/useAuth';
import { useAssistantName } from '@/api/useProfile';
import { getAlarmScheduler } from '@/alarm';
import { SNOOZE_CHOICES, snoozeAlarm } from '@/alarm/snooze';
import { localAlarmItem, snoozeTestAlarm, TEST_ALARM_ID, testAlarmItem } from '@/alarm/testAlarm';
import { ringWindowEnd } from '@/alarm/ringWindow';
import type { ScheduledAlarm } from '@/alarm/types';
import { useSoundSettings } from '@/reminders/soundSettings';
import { gradients, light, onVoice } from '@/theme/tokens';
import { BreathingGlow } from '@/ui/alarm/BreathingGlow';
import { Icon } from '@/ui/Icon';
import { IntiOrb } from '@/ui/inti/IntiOrb';
import { SwipeToConfirm } from '@/ui/SwipeToConfirm';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';
import { useToast } from '@/ui/toastStore';

const BUZZ_MS = 2000;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Niat layar: mematikan alarm dengan tenang, atau menundanya. Tindakan tersering: geser untuk mematikan, paling bawah
// di zona jempol (pilihan tunda 5, 10, 30 menit tepat di atasnya, "Tanya" kecil di atasnya lagi); jam besar dengan
// cahaya bernapas dan judulnya di atas.
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
  const compact = useLayoutClass() === 'compact';
  const live = useLive();
  const toast = useToast();
  const { vibrate } = useSoundSettings();
  const { mode } = useApi();
  const { status: auth } = useAuth();
  const agenda = useAgenda();
  const params = useLocalSearchParams<{ id?: string; preview?: string }>();
  const preview = one(params.preview) === '1';
  // Mode contoh tanpa id (dibuka dari menu uji): pengingat contoh. Mode akun dan server tanpa id: tidak ada yang
  // dibunyikan.
  const id = one(params.id) ?? (mode === 'contoh' ? DEMO_ALARM_ID : undefined);
  // Hanya dengan sesi aktif (atau mode contoh) item bisa dimuat, tunda dikabarkan ke server, dan chat dibuka.
  const online = !needsSignIn(mode) || auth === 'signedIn';
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

  // Getar hanya selama layar ini terlihat, aplikasi aktif, jendela bunyi belum habis, dan getar tidak dimatikan di
  // Akun → Pemberitahuan; setelah pindah ke chat atau ke latar, berhenti.
  useEffect(() => {
    if (!live || expired || !vibrate) return;
    const buzz = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    buzz();
    const t = setInterval(buzz, BUZZ_MS);
    return () => clearInterval(t);
  }, [live, expired, vibrate]);

  const busy = useRef(false);
  if (!item) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: light.voiceCanvas,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 36,
          paddingHorizontal: 28,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        <StatusBar style="light" />
        <IntiOrb size={88} paused={!live} />
        <Txt testID="alarm-kosong" v="title" color={onVoice.strong} style={{ textAlign: 'center' }}>
          {id ? 'Memuat alarm…' : 'Tidak ada alarm yang sedang berbunyi.'}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={id ? 'Tutup' : 'Ke Beranda'}
          onPress={leave}
          style={{
            height: 56,
            paddingHorizontal: 40,
            borderRadius: 28,
            backgroundColor: onVoice.strong,
            justifyContent: 'center',
          }}
        >
          <Txt v="subtitle" color={onVoice.onStrong}>
            {id ? 'Tutup' : 'Ke Beranda'}
          </Txt>
        </Pressable>
      </View>
    );
  }
  const isFlight = /bandara|penerbangan|pesawat|terbang/i.test(`${item.title} ${item.note ?? ''}`);
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

  const snooze = async (minutes: number) => {
    if (preview) return leave();
    if (busy.current) return;
    busy.current = true;
    const scheduler = getAlarmScheduler();
    if (item.id === TEST_ALARM_ID) {
      await snoozeTestAlarm(scheduler, item, minutes);
      await scheduler.releaseLockScreen();
      return leave();
    }
    // Dipasang di HP lebih dulu (tanpa menunggu internet), baru dikabarkan ke server. Server tidak terjangkau: alarm
    // tundaan tetap berbunyi pada waktunya dan kabarnya diulang pada penyamaan alarm berikutnya.
    const result = await snoozeAlarm({ scheduler, item, minutes, snooze: online ? agenda.snooze : null });
    await scheduler.releaseLockScreen();
    if (!result.armed) {
      toast('Alarm belum bisa bunyi di HP ini. Cek izinnya di Akun.');
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
      toast(`Buka kunci HP dulu untuk bertanya ke ${assistantName}.`);
      return;
    }
    router.replace('/chat');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: light.voiceCanvas,
        paddingTop: insets.top + (compact ? 24 : 64),
        paddingBottom: Math.max(compact ? 20 : 32, insets.bottom + 16),
        paddingHorizontal: 20,
      }}
    >
      <StatusBar style="light" />
      {/* Atas: apa yang berbunyi. Jam besar dan judulnya terbaca dari jauh. */}
      <View style={{ alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="bell" size={16} color={onVoice.soft} />
          <Txt weight={600} color={onVoice.soft} style={{ fontSize: 15, lineHeight: 20 }}>
            Pengingat · {dayLabel(item.date)}
          </Txt>
        </View>
        {preview ? (
          <Txt v="caption" color={onVoice.soft} style={{ textAlign: 'center' }}>
            Ini hanya pratinjau. Alarm yang sebenarnya tidak berubah.
          </Txt>
        ) : null}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <BreathingGlow
            size={compact ? 260 : 320}
            paused={!live || expired}
            style={{ position: 'absolute', alignSelf: 'center' }}
          />
          <Txt
            weight={300}
            tabular
            color={onVoice.strong}
            maxFontSizeMultiplier={1.1}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ fontSize: compact ? 88 : 104, lineHeight: compact ? 96 : 112, letterSpacing: -4 }}
          >
            {item.time}
          </Txt>
        </View>
        <Txt
          weight={600}
          color={onVoice.strong}
          numberOfLines={3}
          style={{ fontSize: 28, lineHeight: 36, textAlign: 'center' }}
        >
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
              backgroundColor: onVoice.button,
              paddingVertical: 14,
              paddingHorizontal: 18,
            }}
          >
            <Icon name={isFlight ? 'plane' : 'note'} size={22} color={gradients.waves.mint} />
            <Txt color={onVoice.text} numberOfLines={3} style={{ flexShrink: 1, fontSize: 17 }}>
              {item.note}
            </Txt>
          </View>
        ) : null}
      </View>

      {/* Ruang lentur: semua tindakan menempel di bawah (zona jempol), tanpa jarak tetap dari atas. */}
      <View style={{ flexGrow: 1, minHeight: 24 }} />
      <View testID="zona-jempol" style={{ gap: 16 }}>
        {canAsk ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Tanya ${assistantName}`}
            onPress={() => void ask()}
            haptic="light"
            style={{
              alignSelf: 'center',
              minHeight: 48,
              paddingHorizontal: 16,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IntiOrb size={24} glow={false} paused={!live} />
            <Txt weight={600} color={onVoice.label} numberOfLines={1}>
              Tanya {assistantName}
            </Txt>
          </PressableScale>
        ) : null}
        <View style={{ gap: 8 }}>
          <Txt weight={600} color={onVoice.soft} style={{ textAlign: 'center', fontSize: 15, lineHeight: 20 }}>
            Tunda
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {SNOOZE_CHOICES.map((minutes) => (
              <SnoozePill key={minutes} minutes={minutes} onPress={() => void snooze(minutes)} />
            ))}
          </View>
        </View>
        <SwipeToConfirm label="Geser untuk mematikan" actionLabel="Matikan" onConfirm={() => void stop()} />
      </View>
    </View>
  );
}

/** Satu pilihan tunda: pil besar di zona jempol, angkanya menonjol. */
function SnoozePill({ minutes, onPress }: { minutes: number; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Tunda ${minutes} menit`}
      onPress={onPress}
      haptic="light"
      style={{
        flex: 1,
        minHeight: 64,
        borderRadius: 32,
        backgroundColor: onVoice.button,
        borderWidth: 1,
        borderColor: onVoice.buttonLine,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
      }}
    >
      <Txt weight={600} tabular color={onVoice.text} style={{ fontSize: 22, lineHeight: 28 }}>
        {minutes}
      </Txt>
      <Txt color={onVoice.soft} style={{ fontSize: 15, lineHeight: 20 }}>
        menit
      </Txt>
    </PressableScale>
  );
}
