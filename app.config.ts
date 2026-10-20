/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExpoConfig } from 'expo/config';

// Sama dengan app.json sebelumnya, ditambah notifikasi. FCM butuh `google-services.json` dari Firebase; berkasnya
// dipakai hanya kalau ada, jadi build tetap jalan tanpa itu (notifikasi lokal tetap bisa dites).
const googleServices = './google-services.json';
const hasGoogleServices = existsSync(join(__dirname, googleServices));

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
    ...(hasGoogleServices ? { googleServicesFile: googleServices } : {}),
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
    [
      'expo-notifications',
      {
        icon: './assets/brand/icon-monochrome.png',
        color: '#1D7550',
        defaultChannel: 'pesan',
      },
    ],
  ],
  extra: {
    apiUrl: '',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
