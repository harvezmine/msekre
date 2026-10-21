# Alarm lokal di HP

Pengingat berjenis alarm (`way: "alarm"`) dibunyikan HP sendiri, tanpa internet, lewat modul Expo lokal `modules/alarm`
(Kotlin). Tidak memakai pustaka pihak ketiga: `@notifee/react-native` terakhir diperbarui Desember 2024 dan tidak lagi
dirawat; belum ada pustaka alarm Expo yang terawat dengan `setAlarmClock` dan intent layar penuh. Aturan kontrak
(`alarm-ack`, tidak ada pengingat ganda lewat WhatsApp) ada di `docs/api-v1.md` bagian 2.13.

## Isi

- `modules/alarm/android/.../AlarmModule.kt`: fungsi untuk JS (`schedule`, `cancel`, `cancelAll`, `list`, `getRinging`,
  `status`, `openSettings`, `releaseLockScreen`, `moveToBack`, `dismissKeyguard`). `openSettings`, `releaseLockScreen`,
  `moveToBack`, dan `dismissKeyguard` jalan di thread utama (`Queues.MAIN`); `releaseLockScreen` baru selesai sesudah
  izinnya benar-benar lepas, jadi JS bisa menunggunya sebelum pindah layar. `getRinging` membawa `until` (akhir jendela
  bunyi) untuk alarm yang sedang berbunyi. Saat modul dimuat (`OnCreate`) jadwal dipasang ulang dari penyimpanan (`AlarmEngine.restore`):
  jadwal hilang kalau aplikasi dihentikan paksa atau dimatikan penghemat baterai, dan pemasangan ulang aman diulang
  (FLAG_UPDATE_CURRENT).
- `AlarmEngine.kt`: `AlarmManager.setAlarmClock` (bunyi saat HP tidur/Doze, tampil di ikon alarm bilah status);
  `restore` memasang ulang dari penyimpanan.
- `AlarmStore.kt`: jadwal di SharedPreferences (JSON per id). `RingingStore.kt`: catatan alarm yang sedang berbunyi
  (id, judul, waktu, catatan; hilang setelah 10 menit atau saat dimatikan), dibaca layar alarm lewat `getRinging(id)` kalau
  item agendanya tidak bisa dimuat.
- `AlarmReceiver.kt`: alarm jatuh tempo, memasang notifikasi (saluran `alarm`, suara USAGE_ALARM berulang, getar,
  kategori ALARM, `setFullScreenIntent` ke `<skema>://alarm?id=<id>`; judul tidak ikut di tautan, layar alarm membacanya dari
  `getRinging`). Notifikasinya privat: layar kunci hanya
  menampilkan "Pengingat" (`setPublicVersion`), judul baru terlihat setelah HP dibuka. Ikon alarm di bilah status membuka
  Agenda, bukan layar alarm.
- `RescheduleReceiver.kt`: `BOOT_COMPLETED`, `QUICKBOOT_POWERON` (juga versi HTC), `MY_PACKAGE_REPLACED`, `TIME_SET`,
  `TIMEZONE_CHANGED`, dan `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` memasang ulang jadwal. Yang terlewat kurang dari
  15 menit dibunyikan langsung; yang lebih lama menjadi notifikasi biasa "Pengingat terlewat: <judul>" (saluran
  `alarm_terlewat`, tanpa layar penuh), bukan dibuang diam-diam; membatalkan alarm (`AlarmEngine.cancel`) juga membuang
  notifikasi "Pengingat terlewat" untuk id itu. Broadcast `QUICKBOOT_POWERON` tidak dilindungi sistem (aplikasi lain bisa
  mengirimnya); aman, karena `restore` idempoten dan tidak membaca isi intent.
- `AlarmActivityListener.kt` / `AlarmWindow.kt` / `AlarmPackage.kt`: activity utama tampil di atas layar kunci dan
  menyalakan layar hanya saat dibuka LANGSUNG oleh alarm (ekstra pada intent, dibuang begitu dibaca). Activity yang dibuat
  ulang (`savedInstanceState`) atau dibuka dari Recents (`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`) tidak mendapatkannya, dan
  tautan `<skema>://alarm` dilepas dari intentnya supaya Recents tidak membuka layar alarm lagi. Izin dilepas saat alarm
  dimatikan atau ditunda, saat layar alarm ditutup (Kembali, layar lain menggantikan), saat jendela bunyi habis (10 menit:
  layar menutup sendiri, getar berhenti, dan di HP terkunci aplikasi pindah ke latar lewat `moveToBack` supaya layar kunci
  kembali), dan saat activity berhenti sementara tidak ada alarm yang berbunyi (`onPause`, `onUserLeaveHint`;
  `RingingStore.hasActive` memakai `apply()` karena jalan di thread utama). JS **tidak** melepas izin saat aplikasi ke
  latar: Android menjeda aplikasi sebentar saat tampil di atas layar kunci dan saat `requestDismissKeyguard`. Pengaman
  native: `applyIfAlarm` memasang `Handler` yang melepas izin setelah jendela bunyi (+15 detik) walau JS tidak sempat.
  Modul hanya menghapus penanda jendela yang ia pasang sendiri (`ownedFlags`), jadi `FLAG_KEEP_SCREEN_ON` milik
  expo-keep-awake (mode suara) tetap utuh. Matikan menunggu izin lepas dulu baru pindah layar (Beranda atau chat tidak
  sempat tampil di atas layar kunci). "Tanya" memanggil `dismissKeyguard`
  (`KeyguardManager.requestDismissKeyguard`) dan baru pindah ke chat setelah HP dibuka.
- `AlarmStatus.kt`: status izin (`canScheduleExactAlarms`, `canUseFullScreenIntent`, notifikasi dan saluran `alarm`,
  `isIgnoringBatteryOptimizations`) dan pintasan ke pengaturannya.
- `modules/alarm/app.plugin.js`: izin AndroidManifest dan meta-data skema tautan (receiver ada di
  `android/src/main/AndroidManifest.xml` modul, digabung otomatis).
- JS: `src/alarm/` (antarmuka `AlarmScheduler`, `NativeAlarmScheduler`, `MemoryAlarmScheduler`, `AlarmSync`,
  `useAlarmSync`, `snooze.ts`, `pendingSnooze.ts`), `app/alarm.tsx` (layar alarm), `app/izin-alarm.tsx` (panduan izin).

## Aturan sinkron dan tunda

- **Setiap penyamaan menjadwalkan ulang semua alarm yang seharusnya berbunyi** (murah), karena daftar tersimpan bukan
  bukti alarmnya masih terpasang. Sebelum menyamakan, rentang hari ini sampai 7 hari ke depan dipastikan sudah dimuat.
- **Tanda terima hanya setelah terpasang DAN terdengar.** `schedule` menjawab `false` kalau izin alarm tepat waktu belum
  ada, notifikasi mati, atau saluran `alarm` dimatikan pengguna; hanya `true` yang dikabarkan ke server, jadi pengingat
  WhatsApp tetap jalan. Panduan izin menyebut notifikasi bila itu penyebabnya.
- **Tunda lebih dulu di HP.** Alarm tundaan dipasang pada maks(`snoozedUntil` ?? `at`, sekarang) + 10 menit, baru `PATCH`.
  Tanpa internet, alarm tetap bunyi; tunda yang belum sampai ke server dicatat di HP (`pendingSnooze.ts`), tetap
  dijadwalkan walau server masih menyebut waktu lama, tanpa tanda terima, dan `PATCH`-nya diulang tiap penyamaan.
- **Layar alarm tanpa data server.** Item tidak bisa dimuat (tanpa internet, sesi habis): layar tampil dari catatan alarm di
  HP (`getRinging`), dengan Tunda dan Matikan tapi tanpa "Tanya". `/alarm` terbuka juga tanpa sesi
  (`src/api/routeAccess.ts`). Menahan pengingat di Agenda membuka pratinjau (`preview=1`) yang tidak menyentuh alarm asli.

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

Tambahan dari tinjauan (F1), juga di `docs/ROADMAP.md` bagian "Daftar uji di HP: alarm lokal":

8. Henti paksa (Info aplikasi > Hentikan) atau geser dari Recents di HP yang agresif; buka aplikasi lagi: alarm tetap
   terpasang (`adb shell dumpsys alarm | grep -A3 id.my.secretary.dev`).
9. Notifikasi dimatikan di pengaturan HP: tidak ada tanda terima ke server (periksa log server), panduan izin
   menyebut notifikasi; WhatsApp tetap mengirim pengingat.
10. Layar kunci: alarm berbunyi, "Tanya" meminta buka kunci dulu (pola/PIN/sidik jari) dan baru membuka chat; Kembali
    mengembalikan layar kunci; setelah 10 menit tanpa disentuh notifikasi hilang dan layar kunci kembali; matikan aplikasi
    lewat Recents lalu buka dari Recents: tidak membuka layar alarm lagi.
11. Mode pesawat dari awal (cold start): alarm berbunyi, layar menampilkan judul dengan Tunda dan Matikan (tanpa Tanya);
    Tunda tanpa internet tetap berbunyi 10 menit kemudian; Tunda telat (ditekan 25 menit setelah waktunya) berbunyi 10
    menit setelah ditekan; internet kembali: Agenda menulis "Ditunda sampai ..." yang sama.
12. Tautan layar penuh di build preview (bukan development client): alarm membuka `/alarm?id=` (tanpa judul) di atas layar kunci.
13. Android 14: cabut izin layar penuh (`adb shell appops set id.my.secretary.dev USE_FULL_SCREEN_INTENT deny`) dan nyalakan
    Jangan Ganggu: tetap muncul sebagai notifikasi berbunyi dan Panduan izin menandainya.
14. Cek manifest hasil gabungan (`aapt dump xmltree` atau Android Studio Merged Manifest): receiver `AlarmReceiver`,
    `RescheduleReceiver` dengan `BOOT_COMPLETED`, `QUICKBOOT_POWERON`, dan izin yang diharapkan.
15. `useExactAlarm: false` di Android 14 pemasangan baru: panduan izin menuntun ke "Alarm dan pengingat"; deklarasi Play
    Console untuk `USE_EXACT_ALARM` dan `USE_FULL_SCREEN_INTENT` terisi.
16. Zona waktu HP berbeda dari zona pengguna (HP di WITA, akun WIB): jam di Agenda dan "Ditunda sampai" mengikuti zona
    akun; alarm tetap berbunyi pada saat yang benar.
17. Aplikasi dibiarkan terbuka dari Minggu malam ke Senin pagi: Hari ini, "sekarang", dan alarm pekan baru benar tanpa
    menutup aplikasi.
18. Dokumen dari chat atau laporan Usaha: Buka di Drive atau WPS; tanpa aplikasi pembuka memakai lembar bagikan; tombol
    tidak tertahan selagi aplikasi pembuka terbuka.
