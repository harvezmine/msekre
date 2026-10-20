// Config plugin untuk modul alarm lokal (modules/alarm): izin AndroidManifest dan skema tautan untuk layar alarm.
// Penerima (receiver) alarm dan pemasang ulang jadwal ada di AndroidManifest modul sendiri (android/src/main), yang
// digabung otomatis ke aplikasi saat build.
//
// Opsi:
// - `useExactAlarm` (bawaan true): ikut menyatakan USE_EXACT_ALARM. Di Android 13+ izin ini langsung diberikan tanpa
//   pengguna perlu menyalakan apa pun, TETAPI Google Play hanya mengizinkannya untuk aplikasi yang fungsi utamanya alarm
//   atau kalender, dan meminta pernyataan di Play Console. Kalau pernyataan itu tidak dipakai, setel `false`: pengguna
//   lalu menyalakan "Alarm dan pengingat" sendiri (SCHEDULE_EXACT_ALARM), dipandu layar izin-alarm.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SCHEME_META = 'expo.modules.alarm.DEEP_LINK_SCHEME';

function ensurePermission(manifest, name, attributes = {}) {
  manifest['uses-permission'] = manifest['uses-permission'] ?? [];
  if (manifest['uses-permission'].some((p) => p.$['android:name'] === name)) return;
  manifest['uses-permission'].push({ $: { 'android:name': name, ...attributes } });
}

function withAlarm(config, props = {}) {
  const useExactAlarm = props.useExactAlarm !== false;
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    ensurePermission(
      manifest,
      'android.permission.SCHEDULE_EXACT_ALARM',
      // Dengan USE_EXACT_ALARM, SCHEDULE_EXACT_ALARM cukup untuk Android 12 sampai 12L.
      useExactAlarm ? { 'android:maxSdkVersion': '32' } : {},
    );
    if (useExactAlarm) ensurePermission(manifest, 'android.permission.USE_EXACT_ALARM');
    for (const name of [
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WAKE_LOCK',
      'android.permission.VIBRATE',
    ]) {
      ensurePermission(manifest, name);
    }

    // Skema tautan layar alarm (`<skema>://alarm?id=`) dibaca modul native dari meta-data ini.
    const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
    if (scheme) {
      const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, SCHEME_META, scheme);
    }
    return mod;
  });
}

module.exports = withAlarm;
module.exports.SCHEME_META = SCHEME_META;
