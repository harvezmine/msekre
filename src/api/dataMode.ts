import { use } from 'react';
import { ApiContext } from './ApiProvider';
import { needsSignIn, type DataMode } from './mode';

export interface DataModeInfo {
  mode: DataMode;
  /** Akun asli yang masuk dengan nomor WhatsApp (`akun`, `server`). */
  signIn: boolean;
  /**
   * Mode `akun`: chat dan Mode Suara dari server asli, layar lain (Agenda, Perangkat, Usaha, Terhubung, Riwayat, sebagian
   * Akun) masih data contoh. Layar memakai ini untuk berterus terang: Beranda tidak menampilkan blok yang isinya contoh,
   * bilah tab hanya Beranda dan Agenda, dan layar contoh diberi penanda (`SampleBanner`).
   */
  hybrid: boolean;
}

/** Mode data untuk layar. Di luar `ApiProvider` (tes komponen): `contoh`. */
export function useDataMode(): DataModeInfo {
  const mode = use(ApiContext)?.mode ?? 'contoh';
  return { mode, signIn: needsSignIn(mode), hybrid: mode === 'akun' };
}
