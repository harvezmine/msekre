import Constants from 'expo-constants';

/** Versi aplikasi dari app.json (`expo.version`), untuk header `X-App-Version`. */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
