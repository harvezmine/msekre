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
// - Alamat server: variabel `EXPO_PUBLIC_API_URL` (contoh `https://app.sekertaris.com`) saat build/`expo start`;
//   kosong berarti mode server tidak bisa dipilih (hanya mode contoh).
// - Nomor WhatsApp Sekretaris AI: `EXPO_PUBLIC_WA_NUMBER` (contoh `6281100002222`), cadangan untuk tombol "Mulai lewat
//   WhatsApp" bila server tidak menyebut nomornya.
const localGoogleServices = './google-services.json';
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync(join(__dirname, localGoogleServices)) ? localGoogleServices : undefined);

const config: ExpoConfig = {
  name: 'Sekretaris AI',
  slug: 'sekretaris-ai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/brand/icon.png',
  scheme: 'sekretarisai',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F6F6F0',
  android: {
    package: 'id.my.secretary.dev',
    adaptiveIcon: {
      backgroundColor: '#F6F6F0',
      foregroundImage: './assets/brand/icon-foreground.png',
      monochromeImage: './assets/brand/icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
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
        backgroundColor: '#F6F6F0',
        dark: {
          image: './assets/brand/s-mark-light.png',
          backgroundColor: '#0A1F18',
        },
      },
    ],
    'expo-font',
    'expo-status-bar',
    'expo-secure-store',
    'expo-sharing',
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
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
