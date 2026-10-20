import { Platform } from 'react-native';
import { AlarmNative } from '../../modules/alarm';
import { MemoryAlarmScheduler } from './MemoryAlarmScheduler';
import { NativeAlarmScheduler } from './NativeAlarmScheduler';
import type { AlarmScheduler } from './types';

export * from './types';
export { MemoryAlarmScheduler } from './MemoryAlarmScheduler';
export { NativeAlarmScheduler } from './NativeAlarmScheduler';

let current: AlarmScheduler | null = null;

/** Pilih isi: modul native kalau ada (Android dengan modul), selain itu tiruan di memori. */
export function createAlarmScheduler(native = Platform.OS === 'android' ? AlarmNative : null): AlarmScheduler {
  return native ? new NativeAlarmScheduler(native) : new MemoryAlarmScheduler();
}

/** Penjadwal alarm bersama untuk seluruh aplikasi. */
export function getAlarmScheduler(): AlarmScheduler {
  current ??= createAlarmScheduler();
  return current;
}

/** Ganti penjadwal bersama (tes). `null` = kembali ke pilihan otomatis. */
export function setAlarmScheduler(scheduler: AlarmScheduler | null) {
  current = scheduler;
}
