/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExpoConfig } from 'expo/config';

// Sama dengan app.json sebelumnya, ditambah notifikasi. FCM butuh `google-services.json` dari Firebase.
// - Build di HP/laptop sendiri: berkas `./google-services.json` (tidak masuk git) dipakai hanya kalau ada, jadi build
//   tetap jalan tanpa itu (notifikasi lokal tetap bisa dites).
// - Build di cloud EAS: berkas yang tidak masuk git tidak ikut terunggah. Simpan sebagai EAS file secret bernama
//   `GOOGLE_SERVICES_JSON` (expo.dev → proyek → Environment variables → jenis File, atau `npx eas-cli env:create`);
//   EAS mengisi variabel itu dengan jalur berkasnya saat build.
// - Alamat server: variabel `EXPO_PUBLIC_API_URL` (asal saja, tanpa `/app/v1`) saat build/`expo start`. Build EAS
//   preview dan production mengisinya di eas.json (`https://app.secretary.my.id`): pemasangan baru mulai di mode akun
//   (masuk dengan kode WhatsApp). Kosong berarti hanya mode contoh.
// - Nomor WhatsApp Sekretaris AI: `EXPO_PUBLIC_WA_NUMBER` (contoh `6281100002222`), cadangan untuk tombol "Mulai lewat
//   WhatsApp" bila server tidak menyebut nomornya.
const localGoogleServices = './google-services.json';
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync(join(__dirname, localGoogleServices)) ? localGoogleServices : undefined);

// Izin yang dibawa pustaka tetapi tidak dipakai aplikasi ini dibuang dari manifes (`tools:node="remove"`):
// - penyimpanan luar (READ/WRITE_EXTERNAL_STORAGE): berkas hanya di folder aplikasi sendiri;
// - USE_BIOMETRIC / USE_FINGERPRINT: aplikasi tidak memakai sidik jari (PIN sendiri);
// - SYSTEM_ALERT_WINDOW ("tampil di atas aplikasi lain"): hanya menu pengembang build `development` yang memerlukannya,
//   jadi dibuang di semua build lain (preview dan production). EAS mengisi `EAS_BUILD_PROFILE`; build lokal
//   (`expo run:android`, `expo prebuild`) tanpa variabel itu juga dianggap pengembangan.
const isDevelopmentBuild =
  process.env.EAS_BUILD_PROFILE === undefined || process.env.EAS_BUILD_PROFILE === 'development';
const blockedPermissions = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  ...(isDevelopmentBuild ? [] : ['android.permission.SYSTEM_ALERT_WINDOW']),
];

const config: ExpoConfig = {
  name: 'Sekretaris AI',
  // Sama dengan slug proyek EAS founder (extra.eas.projectId); tidak tampil di HP.
  slug: 'harvez',
  owner: 'harvezzs-team',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/brand/icon.png',
  scheme: 'sekretarisai',
  userInterfaceStyle: 'automatic',
  // Sama dengan token `bg` (src/theme/tokens.ts), supaya layar pembuka asli menyambung ke layar pertama.
  backgroundColor: '#F7F6F2',
  android: {
    package: 'id.my.secretary.dev',
    adaptiveIcon: {
      backgroundColor: '#F6F6F0',
      foregroundImage: './assets/brand/icon-foreground.png',
      monochromeImage: './assets/brand/icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    blockedPermissions,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  web: {
    output: 'server',
    favicon: './assets/brand/s-mark.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/brand/s-mark.png',
        imageWidth: 120,
        backgroundColor: '#F7F6F2',
        dark: {
          image: './assets/brand/s-mark-light.png',
          backgroundColor: '#0E1012',
        },
      },
    ],
    'expo-font',
    // APK lebih kecil: hanya arsitektur HP Android yang masih beredar (arm64 dan arm 32-bit), tanpa x86.
    ['expo-build-properties', { android: { buildArchs: ['arm64-v8a', 'armeabi-v7a'] } }],
    'expo-status-bar',
    'expo-secure-store',
    'expo-sharing',
    // Mode Suara: mikrofon (RECORD_AUDIO) hanya saat layar suara terbuka; tidak merekam atau memutar di latar.
    [
      'expo-audio',
      {
        microphonePermission: 'Sekretaris AI memakai mikrofon agar Anda bisa berbicara dengan asisten.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/brand/icon-monochrome.png',
        color: '#1D7550',
        defaultChannel: 'pesan',
      },
    ],
    // Alarm lokal di HP (modul native modules/alarm): izin AndroidManifest dan skema tautan layar alarm. Opsi
    // `useExactAlarm`: lihat catatan Google Play di modules/alarm/app.plugin.js.
    ['./modules/alarm/app.plugin.js', { useExactAlarm: true }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    // Nomor WhatsApp Sekretaris AI (62812..., tanpa +): cadangan bila server tidak menyebutnya di `belum_terdaftar`.
    waNumber: process.env.EXPO_PUBLIC_WA_NUMBER ?? '',
    // Proyek EAS milik founder (build di cloud, `npx eas-cli build`).
    eas: { projectId: '41c28acf-87f2-452b-81ec-c6af2caab19e' },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
