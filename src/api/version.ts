import Constants from 'expo-constants';
import * as Application from 'expo-application';

/** Versi aplikasi dari app.config.ts (`version`), untuk header `X-App-Version`. */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * "Versi 1.0.0 (12)" di Akun: versi dan nomor build aplikasi yang benar-benar terpasang (expo-application). Tanpa nilai
 * dari HP (mis. di web), versi dari app.config.ts tanpa nomor build.
 */
export function versionText(
  version: string | null = Application.nativeApplicationVersion,
  build: string | null = Application.nativeBuildVersion,
): string {
  const v = version || appVersion();
  return build ? `Versi ${v} (${build})` : `Versi ${v}`;
}
