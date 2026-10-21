import type { ComponentType } from 'react';
import { ROUTES } from './harness';
import { newUserSampleState } from '@/sample/fresh';
import type { SampleAction, SampleState } from '@/sample/store';

export interface LayarKasus {
  nama: string;
  Layar: ComponentType;
  params?: Record<string, string>;
  actions?: SampleAction[];
  /** Keadaan awal data contoh (bawaan: pengguna contoh yang sudah terbiasa). */
  state?: SampleState;
  /** Layar yang selalu berlatar forest, di dua mode. */
  selaluForest?: boolean;
}

/** Setiap layar di `app/` (variasi parameter dihitung terpisah), untuk tes mode gelap dan lebar 360. */
export const LAYAR: LayarKasus[] = [
  { nama: 'Beranda', Layar: ROUTES['/']! },
  { nama: 'Beranda (pengguna baru)', Layar: ROUTES['/']!, state: newUserSampleState },
  { nama: 'Agenda', Layar: ROUTES['/agenda']! },
  { nama: 'Perangkat', Layar: ROUTES['/perangkat']! },
  { nama: 'Usaha', Layar: ROUTES['/usaha']! },
  { nama: 'Chat (percakapan)', Layar: ROUTES['/chat']! },
  { nama: 'Chat (kosong)', Layar: ROUTES['/chat']!, params: { kosong: '1' } },
  { nama: 'Suara', Layar: ROUTES['/suara']!, selaluForest: true },
  { nama: 'Alarm', Layar: ROUTES['/alarm']!, selaluForest: true },
  { nama: 'Remote AC', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'ac-kamar' } },
  { nama: 'Remote TV', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'tv-ruang-tamu' } },
  { nama: 'Remote speaker', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'speaker-dapur' } },
  { nama: 'Remote lampu', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'lampu-utama' } },
  { nama: 'Remote lampu berwarna', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'lampu-kamar' } },
  { nama: 'Remote kipas', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'kipas-kamar-anak' } },
  { nama: 'Remote colokan', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'colokan-mesin-cuci' } },
  { nama: 'Remote tirai', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'tirai-ruang-tamu' } },
  { nama: 'Remote kunci', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'pintu-depan' } },
  { nama: 'Remote kamera', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'kamera-tamu' } },
  { nama: 'Remote sensor', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'sensor-dapur' } },
  { nama: 'Remote Kotak', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'kotak-ruang-tamu' } },
  { nama: 'Remote tidak terjangkau', Layar: ROUTES['/perangkat/[id]']!, params: { id: 'lampu-sudut' } },
  { nama: 'Perangkat (Rumah)', Layar: ROUTES['/perangkat']!, actions: [{ type: 'setPlace', place: 'Rumah' }] },
  { nama: 'Tambah perangkat', Layar: ROUTES['/perangkat/tambah']! },
  { nama: 'PIN', Layar: ROUTES['/pin']!, params: { id: 'kamera-tamu' } },
  { nama: 'Buka kunci', Layar: ROUTES['/buka-kunci']!, params: { id: 'pintu-depan' } },
  { nama: 'Tempat', Layar: ROUTES['/tempat']! },
  { nama: 'Tambah agenda', Layar: ROUTES['/agenda/tambah']! },
  { nama: 'Terhubung (daftar)', Layar: ROUTES['/terhubung']! },
  { nama: 'Terhubung (detail Moka)', Layar: ROUTES['/terhubung/[id]']!, params: { id: 'moka' } },
  { nama: 'Terhubung (masuk TikTok)', Layar: ROUTES['/terhubung/masuk']!, params: { id: 'tiktok' } },
  {
    nama: 'Terhubung (tersambung)',
    Layar: ROUTES['/terhubung/tersambung']!,
    params: { id: 'tiktok' },
    actions: [{ type: 'connect', id: 'tiktok' }],
  },
  {
    nama: 'Terhubung (konfirmasi)',
    Layar: ROUTES['/terhubung/konfirmasi']!,
    params: { id: 'moka', aksi: 'lupa' },
  },
  { nama: 'Riwayat', Layar: ROUTES['/riwayat']! },
  { nama: 'Akun', Layar: ROUTES['/akun']! },
  { nama: 'Keamanan', Layar: ROUTES['/akun/keamanan']! },
  { nama: 'Asisten', Layar: ROUTES['/akun/asisten']! },
  { nama: 'Pemberitahuan', Layar: ROUTES['/akun/notifikasi']! },
  { nama: 'Keluarkan HP (konfirmasi)', Layar: ROUTES['/akun/konfirmasi']!, params: { aksi: 'hp', id: 'hp-lama' } },
  { nama: 'Mulai (awal)', Layar: ROUTES['/mulai']! },
  { nama: 'Mulai (masuk)', Layar: ROUTES['/mulai/masuk']! },
  { nama: 'Mulai (pilih)', Layar: ROUTES['/mulai/pilih']! },
  { nama: 'Izin alarm', Layar: ROUTES['/izin-alarm']! },
  { nama: 'Pemeriksa Inti', Layar: ROUTES['/inti']!, selaluForest: true },
];
