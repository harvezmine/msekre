# Alarm lokal di HP

Pengingat berjenis alarm (`way: "alarm"`) dibunyikan HP sendiri, tanpa internet, lewat modul Expo lokal `modules/alarm`
(Kotlin). Tidak memakai pustaka pihak ketiga: `@notifee/react-native` terakhir diperbarui Desember 2024 dan tidak lagi
dirawat; belum ada pustaka alarm Expo yang terawat dengan `setAlarmClock` dan intent layar penuh. Aturan kontrak
(`alarm-ack`, tidak ada pengingat ganda lewat WhatsApp) ada di `docs/api-v1.md` bagian 2.13.

## Isi

- `modules/alarm/android/.../AlarmModule.kt`: fungsi untuk JS (`schedule`, `cancel`, `cancelAll`, `list`, `status`,
  `openSettings`, `releaseLockScreen`).
- `AlarmEngine.kt`: `AlarmManager.setAlarmClock` (bunyi saat HP tidur/Doze, tampil di ikon alarm bilah status);
  `restore` memasang ulang dari penyimpanan.
- `AlarmStore.kt`: jadwal di SharedPreferences (JSON per id).
- `AlarmReceiver.kt`: alarm jatuh tempo, memasang notifikasi (saluran `alarm`, suara USAGE_ALARM berulang, getar,
  kategori ALARM, `setFullScreenIntent` ke `<skema>://alarm?id=<id>`).
- `RescheduleReceiver.kt`: `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, `TIMEZONE_CHANGED`, dan
  `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` memasang ulang jadwal (yang terlewat kurang dari 15 menit saat HP mati
  dibunyikan langsung).
- `AlarmActivityListener.kt` / `AlarmWindow.kt` / `AlarmPackage.kt`: activity utama tampil di atas layar kunci dan
  menyalakan layar hanya saat dibuka oleh alarm (ekstra pada intent); dilepas lagi saat alarm dimatikan.
- `AlarmStatus.kt`: status izin (`canScheduleExactAlarms`, `canUseFullScreenIntent`, notifikasi dan saluran `alarm`,
  `isIgnoringBatteryOptimizations`) dan pintasan ke pengaturannya.
- `modules/alarm/app.plugin.js`: izin AndroidManifest dan meta-data skema tautan (receiver ada di
  `android/src/main/AndroidManifest.xml` modul, digabung otomatis).
- JS: `src/alarm/` (antarmuka `AlarmScheduler`, `NativeAlarmScheduler`, `MemoryAlarmScheduler`, `AlarmSync`,
  `useAlarmSync`), `app/izin-alarm.tsx` (panduan izin).

## Izin dan kebijakan Google Play

| Izin | Keterangan |
| --- | --- |
| `SCHEDULE_EXACT_ALARM` | Pengguna menyalakan "Alarm dan pengingat" di pengaturan (bawaan mati di Android 14+ untuk pemasangan baru). Dengan `useExactAlarm`, dibatasi `maxSdkVersion 32`. |
| `USE_EXACT_ALARM` | Android 13+, otomatis diberikan. Google Play hanya mengizinkannya untuk aplikasi yang fungsi utamanya alarm atau kalender dan meminta pernyataan di Play Console. Kalau pernyataan itu tidak dipakai, setel `useExactAlarm: false` di `app.config.ts` (lalu panduan izin yang menuntun pengguna). |
| `USE_FULL_SCREEN_INTENT` | Layar penuh saat terkunci. Android 14+ bisa dicabut pengguna; Google Play membatasinya untuk aplikasi panggilan dan alarm (pernyataan di Play Console). |
| `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE` | Notifikasi, pasang ulang setelah HP dinyalakan, menjaga HP terjaga sebentar saat alarm, getar. |

Penghemat baterai tidak diminta lewat `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (izin itu dibatasi Google Play);
panduan membuka daftar pengaturan baterai (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`).

## Yang harus dicoba di HP (build EAS)

Kode native belum pernah dikompilasi atau dijalankan di Mac ini. Setelah build EAS pertama:

1. Build berhasil (Kotlin dan manifest tergabung); `adb shell dumpsys package id.my.secretary.dev | grep -i alarm`
   menunjukkan receiver `AlarmReceiver` dan `RescheduleReceiver`.
2. Akun → Notifikasi → Alarm tepat waktu: tiga izin terbaca benar; Buka pengaturan membuka layar yang tepat
   (Android 12, 13, 14+).
3. Coba alarm 1 menit lagi, HP dikunci: layar menyala, suara alarm berulang, layar alarm tampil di atas layar kunci;
   Geser mematikan suara; setelah itu aplikasi tidak lagi tampil di atas layar kunci.
4. Tunda 10 menit membunyikan lagi 10 menit kemudian; HP dinyalakan ulang di antara keduanya: tetap bunyi.
5. Ubah jam HP atau zona waktu: jadwal tetap pada saat yang benar.
6. Mode pesawat: alarm tetap bunyi. Android 14 dengan izin layar penuh dicabut: tetap muncul sebagai notifikasi
   berbunyi.
7. Xiaomi, Oppo, Vivo: dengan "Mulai otomatis" dan penghemat baterai dimatikan, alarm bunyi setelah aplikasi ditutup
   dari daftar aplikasi terbaru.
