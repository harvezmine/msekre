import { initialSampleState, type SampleState } from './reducer';

/**
 * Pengguna baru di data contoh: belum ada perangkat (juga tanpa Kotak), kiriman, agenda, layanan, riwayat, atau usaha.
 * Beranda hanya menyapa dan memberi satu contoh kalimat; bilah tab hanya Beranda dan Agenda.
 */
export const newUserSampleState: SampleState = {
  ...initialSampleState,
  devices: [],
  hasBox: false,
  outgoing: {},
  agenda: [],
  leftover: null,
  services: [],
  formerly: [],
  history: [],
  business: null,
};
