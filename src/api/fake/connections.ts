import type { SampleState } from '@/sample/reducer';
import { initialServices, serviceCatalog, serviceDef, serviceInfo } from '@/sample/services';
import type { Service as SampleService } from '@/sample/types';
import type { ConnectionCapability, ConnectionDetail, Connections, Service, ServiceCategory } from '../contract';

/** Keterangan layanan di server tiruan: kelompok, akun contoh, kemampuan, dan berapa hal yang Nadia ingat darinya. */
interface Meta {
  category: ServiceCategory;
  account?: string;
  /** Menit sejak terakhir dipakai, dihitung dari saat server tiruan dibuat. */
  lastUsedMin?: number;
  /** Hari sejak disambungkan, untuk layanan awal. */
  sinceDays?: number;
  capabilities: [key: string, label: string][];
  memory: number;
}

const META: Record<string, Meta> = {
  gcal: {
    category: 'kerja',
    account: 'rina@kopirindang.id',
    lastUsedMin: 5,
    sinceDays: 40,
    capabilities: [
      ['baca_jadwal', 'Membaca jadwal'],
      ['ingatkan', 'Mengingatkan sebelum rapat'],
      ['ubah_jadwal', 'Menambah dan memindah jadwal'],
    ],
    memory: 34,
  },
  gmail: {
    category: 'kerja',
    account: 'rina@kopirindang.id',
    lastUsedMin: 2,
    sinceDays: 40,
    capabilities: [
      ['baca_email', 'Membaca email masuk'],
      ['ringkas', 'Meringkas email panjang'],
      ['balas', 'Menyiapkan balasan'],
    ],
    memory: 120,
  },
  wa: {
    category: 'kerja',
    lastUsedMin: 1,
    sinceDays: 60,
    capabilities: [
      ['baca_pesan', 'Membaca pesan masuk'],
      ['siapkan_balasan', 'Menyiapkan balasan'],
      ['kirim_pesan', 'Mengirim pesan atas permintaan'],
    ],
    memory: 210,
  },
  moka: {
    category: 'usaha',
    account: 'Kopi Rindang',
    lastUsedMin: 1,
    sinceDays: 30,
    capabilities: [
      ['penjualan', 'Melihat penjualan'],
      ['stok', 'Memberi tahu stok menipis'],
      ['laporan', 'Membuat laporan'],
    ],
    memory: 48,
  },
  bca: {
    category: 'usaha',
    account: 'BCA 4471',
    lastUsedMin: 10,
    sinceDays: 30,
    capabilities: [
      ['mutasi', 'Membaca uang masuk dan keluar'],
      ['pemberitahuan', 'Memberi tahu pembayaran besar'],
      ['cocokkan', 'Mencocokkan dengan pesanan'],
    ],
    memory: 62,
  },
  kotak: {
    category: 'rumah',
    account: 'Ruang tamu',
    sinceDays: 20,
    capabilities: [
      ['dengar', 'Mendengar perintah suara'],
      ['inframerah', 'Mengatur AC dan perangkat'],
      ['suara', 'Menyuarakan pengingat'],
    ],
    memory: 5,
  },
  imou: {
    category: 'rumah',
    account: 'Kamera depan',
    sinceDays: 25,
    capabilities: [
      ['keadaan', 'Memberi tahu kamera tidak terjangkau'],
      ['gerakan', 'Memberi tahu gerakan tidak biasa'],
      ['tampil', 'Menampilkan keadaan kamera'],
    ],
    memory: 3,
  },
  m365: {
    category: 'kerja',
    capabilities: [
      ['baca_email', 'Membaca email dan jadwal Outlook'],
      ['penting', 'Memberi tahu yang penting'],
      ['balas', 'Menyiapkan balasan'],
    ],
    memory: 0,
  },
  gdrive: {
    category: 'kerja',
    capabilities: [
      ['cari', 'Mencari berkas'],
      ['ringkas', 'Meringkas dokumen'],
      ['simpan', 'Menyimpan notulen dan laporan'],
    ],
    memory: 0,
  },
  rapat: {
    category: 'kerja',
    capabilities: [
      ['ikut', 'Ikut rapat dan mencatat'],
      ['notulen', 'Membuat notulen dan tugas'],
      ['kirim', 'Mengirim ringkasan rapat'],
    ],
    memory: 0,
  },
  notion: {
    category: 'catatan',
    capabilities: [
      ['baca', 'Membaca halaman yang dibagikan'],
      ['cari', 'Menemukan catatan lama'],
      ['simpan', 'Menyimpan notulen'],
    ],
    memory: 0,
  },
  plaud: {
    category: 'catatan',
    capabilities: [
      ['terima', 'Menerima rekaman'],
      ['notulen', 'Mengubah rekaman jadi notulen'],
      ['cari', 'Menemukan isi rekaman lama'],
    ],
    memory: 0,
  },
  github: {
    category: 'lainnya',
    capabilities: [
      ['baca', 'Membaca kemajuan repositori'],
      ['tinjau', 'Memberi tahu yang perlu ditinjau'],
      ['ringkas', 'Meringkas perubahan'],
    ],
    memory: 0,
  },
  tiktok: {
    category: 'usaha',
    capabilities: [
      ['pesanan', 'Memberi tahu pesanan baru'],
      ['kirim', 'Mengingatkan yang perlu dikirim'],
      ['ringkasan', 'Membuat ringkasan harian'],
    ],
    memory: 0,
  },
  accurate: {
    category: 'usaha',
    capabilities: [
      ['faktur', 'Membaca faktur dan pembayaran'],
      ['tagihan', 'Memberi tahu tagihan jatuh tempo'],
      ['ringkasan', 'Membuat ringkasan bulanan'],
    ],
    memory: 0,
  },
  smartthings: {
    category: 'rumah',
    capabilities: [
      ['keadaan', 'Melihat keadaan perangkat Samsung'],
      ['selesai', 'Memberi tahu cucian selesai'],
      ['atur', 'Mengatur perangkat'],
    ],
    memory: 0,
  },
  homeassistant: {
    category: 'rumah',
    capabilities: [
      ['keadaan', 'Melihat perangkat rumah'],
      ['terjangkau', 'Memberi tahu yang tidak terjangkau'],
      ['atur', 'Mengatur lampu dan colokan'],
    ],
    memory: 0,
  },
};

/** Layanan yang segera hadir: tampil di katalog, belum bisa disambungkan. */
const SOON: { id: string; name: string; icon: string; category: ServiceCategory }[] = [
  { id: 'shopee', name: 'Shopee', icon: 'bag', category: 'usaha' },
  { id: 'instagram', name: 'Instagram', icon: 'globe', category: 'lainnya' },
];

/** Kalimat bawaan "Yang bisa Nadia lakukan" untuk layanan yang tidak punya keterangan lengkap. */
const SOON_WHAT = ['Layanan ini segera hadir. Nanti saya bisa membantu di sini.'];

export interface FakeConnectionsContext {
  /** Waktu (ms) saat server tiruan dibuat; "terakhir dipakai" dan "sejak" dihitung mundur dari sini. */
  base: number;
  /** Kapan layanan yang baru disambungkan di sini tersambung (ISO). */
  connectedAt: ReadonlyMap<string, string>;
  /** Layanan tersambung yang perlu disambungkan ulang. */
  reconnect?: ReadonlySet<string>;
}

const ago = (base: number, minutes: number) => new Date(base - minutes * 60_000).toISOString();

function make(
  def: { id: string; name: string; icon: string },
  status: Service['status'],
  category: ServiceCategory,
  extra: Partial<Service> = {},
): Service {
  return { id: def.id, name: def.name, icon: def.icon, category, status, ring: false, ...extra };
}

function connected(s: SampleService, ctx: FakeConnectionsContext): Service {
  const meta = META[s.id];
  const since = ctx.connectedAt.get(s.id) ?? (meta?.sinceDays ? ago(ctx.base, meta.sinceDays * 1440) : undefined);
  return make(s, 'connected', meta?.category ?? 'lainnya', {
    ...(meta?.account ? { account: meta.account } : {}),
    ...(since ? { since } : {}),
    ...(meta?.lastUsedMin !== undefined && s.reachable ? { lastUsed: ago(ctx.base, meta.lastUsedMin) } : {}),
    ring: s.ring !== undefined,
    ...(ctx.reconnect?.has(s.id)
      ? { attention: { text: 'Perlu disambungkan ulang', action: 'reconnect' as const } }
      : s.reachable
        ? {}
        : {
            attention: {
              text: s.unreachableSince ? `Tidak terjangkau sejak ${s.unreachableSince}` : 'Tidak terjangkau',
              action: 'none' as const,
            },
          }),
  });
}

function listed(id: string, status: 'available' | 'formerly'): Service | null {
  const def = serviceDef(id);
  if (!def) return null;
  return make(def, status, META[id]?.category ?? 'lainnya', META[id]?.account ? { account: META[id]!.account } : {});
}

/** `GET /connections` dari penyimpanan contoh. */
export function connectionsFrom(state: SampleState, ctx: FakeConnectionsContext): Omit<Connections, 'rev'> {
  const on = new Set(state.services.map((s) => s.id));
  const gone = new Set(state.formerly);
  const catalogIds = [...Object.keys(serviceCatalog), ...initialServices.map((s) => s.id)].filter(
    (id) => !on.has(id) && !gone.has(id) && id !== 'kotak',
  );
  return {
    connected: state.services.map((s) => connected(s, ctx)),
    catalog: [
      ...[...new Set(catalogIds)].flatMap((id) => listed(id, 'available') ?? []),
      ...SOON.map((d) => make(d, 'soon', d.category)),
    ],
    formerly: state.formerly.flatMap((id) => listed(id, 'formerly') ?? []),
  };
}

/** Satu layanan menurut keadaannya sekarang, atau `undefined` kalau tidak dikenal. */
export function serviceFrom(state: SampleState, id: string, ctx: FakeConnectionsContext): Service | undefined {
  const all = connectionsFrom(state, ctx);
  return [...all.connected, ...all.catalog, ...all.formerly].find((s) => s.id === id);
}

/**
 * `GET /connections/:id`. `overrides`: kemampuan yang dimatikan pengguna (`id:key` -> aktif). Izin dari penyimpanan
 * contoh (`read` -> `baca`).
 */
export function detailFrom(
  state: SampleState,
  id: string,
  ctx: FakeConnectionsContext,
  overrides: ReadonlyMap<string, boolean>,
): ConnectionDetail | undefined {
  const service = serviceFrom(state, id, ctx);
  if (!service) return undefined;
  const sample = state.services.find((s) => s.id === id);
  const capabilities: ConnectionCapability[] = (META[id]?.capabilities ?? []).map(([key, label]) => ({
    key,
    label,
    enabled: overrides.get(`${id}:${key}`) ?? true,
  }));
  const memory = META[id]?.memory ?? 0;
  return {
    service,
    capabilities,
    permission: sample?.permission === 'act' ? 'baca_tulis' : 'baca',
    what: serviceInfo[id]?.can ?? SOON_WHAT,
    ...(sample ? { memoryCount: state.forgotten.includes(id) ? 0 : memory } : {}),
  };
}

/** Alamat halaman masuk resmi tiruan: situs layanan, dengan `state` sekali pakai. */
export function startUrlOf(id: string, nonce: string): string {
  const host = serviceInfo[id]?.domain ?? 'masuk.contoh.id';
  return `https://${host}/masuk?state=${nonce}`;
}
