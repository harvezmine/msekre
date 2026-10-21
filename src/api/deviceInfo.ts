import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { deviceInfoSchema, type DeviceInfo } from './contract';

/** Nama dan jenis HP ini untuk `auth/verify`, supaya muncul di daftar HP di Akun. `undefined` bila namanya tidak diketahui. */
export function deviceInfo(): DeviceInfo | undefined {
  const parsed = deviceInfoSchema.safeParse({
    name: (Device.modelName ?? '').trim().slice(0, 80),
    platform: Platform.OS,
  });
  return parsed.success ? parsed.data : undefined;
}
