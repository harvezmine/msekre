import Constants from 'expo-constants';
import { waNumberSchema } from './contract';

/**
 * Nomor WhatsApp Sekretaris AI dari `app.config.ts` `extra.waNumber` (dari `EXPO_PUBLIC_WA_NUMBER`), dipakai bila server
 * tidak menyebut nomornya di jawaban `belum_terdaftar`. Hanya angka (E.164 tanpa "+"); `null` kalau kosong atau salah.
 */
export function readWaNumber(extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra): string | null {
  const raw = extra?.waNumber;
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  return waNumberSchema.safeParse(digits).success ? digits : null;
}

/** Tautan WhatsApp untuk memulai percakapan pertama dengan Sekretaris AI. */
export function waStartUrl(waNumber: string): string {
  return `https://wa.me/${waNumber}?text=Halo%2C%20saya%20mau%20coba%20Sekretaris%20AI.`;
}
