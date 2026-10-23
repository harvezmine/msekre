import { addDays, weekdayIndex } from '@/api/dates';
import { friendlyError } from './errors';
import type { AgendaItem, AgendaNew, AgendaRes, StreamEvent } from './contract';
import { isApiFailure, type Transport, type Unsubscribe } from './transport';

export type AgendaStatus = 'loading' | 'ready' | 'error';

export interface AgendaState {
  /** Item yang dikenal (gabungan semua rentang yang sudah dimuat), urut tanggal lalu jam. */
  items: AgendaItem[];
  /** Sisa tugas kemarin, atau `null`. */
  leftover: AgendaItem | null;
  /**
   * "Hari ini" (YYYY-MM-DD) dan jam sekarang (HH.MM) menurut zona pengguna, atau `null` sebelum jawaban pertama. Dari jawaban
   * server, lalu dimajukan sendiri tiap menit (garis "sekarang" dan "kemarin" berganti walau aplikasi tidak ditutup).
   */
  today: string | null;
  now: string | null;
  /** Selisih zona waktu pengguna dari UTC dalam menit (dari server), atau `null` sebelum jawaban pertama. */
  tzOffsetMinutes: number | null;
  /** Rentang tanggal yang sudah dimuat (kedua ujung termasuk). */
  ranges: { from: string; to: string }[];
  /** `loading`: belum ada jawaban; `error`: belum ada jawaban dan gagal memuat. */
  status: AgendaStatus;
  error: string | null;
  rev: number;
}

const INITIAL: AgendaState = {
  items: [],
  leftover: null,
  today: null,
  now: null,
  tzOffsetMinutes: null,
  ranges: [],
  status: 'loading',
  error: null,
  rev: 0,
};

/** Jeda memeriksa apakah menit atau hari sudah berganti. */
const TICK_MS = 15_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Rentang bawaan `GET /agenda`: Senin pekan ini sampai Minggu pekan depan. */
function defaultRangeFor(today: string): { from: string; to: string } {
  const monday = addDays(today, -weekdayIndex(today));
  return { from: monday, to: addDays(monday, 13) };
}

const byTime = (a: AgendaItem, b: AgendaItem) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

/**
 * Hasil pratinjau: item yang akan disimpan, atau teks ramah kalau gagal. `unavailable`: server belum bisa membaca kalimat
 * agenda (501); lembar Tambah lalu menitipkan kalimatnya ke asisten lewat chat.
 */
export type PreviewResult =
  { ok: true; item: AgendaNew; guessedTime: boolean } | { ok: false; error: string; unavailable?: true };

/** Gagal menyimpan: teks ramah, dan `unavailable` bila server belum menyediakan jalurnya (501). */
export interface AgendaFailure {
  error: string;
  unavailable?: true;
}

const unavailableOf = (e: unknown): { unavailable?: true } =>
  isApiFailure(e) && e.code === 'unavailable' ? { unavailable: true } : {};

/** Kegagalan yang tidak akan berhasil walau diulang: itemnya sudah tidak ada di server (404). */
export function isGone(e: unknown): boolean {
  return isApiFailure(e) && (e.status === 404 || e.error === 'tidak_ditemukan');
}

/**
 * Pemilik data Agenda: muat dari `GET /agenda` (rentang bawaan, ditambah rentang lain sesuai layar), perbarui lewat event
 * stream `agenda` (upsert; `rev` yang lebih lama dibuang), muat ulang tiap koneksi stream terbuka dan saat aplikasi
 * kembali ke depan. `rev` tidak pernah turun: jawaban muat yang `rev`-nya lebih lama dari keadaan sekarang (event datang
 * selagi memuat) dibuang dan dimuat sekali lagi. Aksinya (tambah, selesai, tunda, sisa kemarin) bertanya ke server dan
 * memakai jawabannya.
 */
export class AgendaController {
  private state: AgendaState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private loading: Promise<void> | null = null;
  private alive = true;
  /** Jam server pada jawaban terakhir dan kapan HP menerimanya, untuk memajukan `today` dan `now` sendiri. */
  private clock: { today: string; minutes: number; at: number } | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Pembacaan item tunggal yang sedang jalan, per id. */
  private readonly fetching = new Map<string, Promise<AgendaItem | null>>();

  constructor(private readonly transport: Transport) {}

  getState = (): AgendaState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start() {
    this.alive = true;
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe(
      (event) => this.onEvent(event),
      () => {},
      () => void this.load(),
    );
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    void this.load();
  }

  stop() {
    this.alive = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /**
   * Muat ulang rentang bawaan (pekan ini dan pekan depan) dan semua rentang lain yang sudah dimuat. Jawaban yang `rev`-nya
   * lebih lama dari keadaan sekarang (ada event yang masuk selagi memuat) dibuang dan dimuat sekali lagi, supaya
   * perubahan yang lebih baru tidak tertimpa.
   */
  load = (): Promise<void> => {
    if (this.loading) return this.loading;
    if (this.state.status === 'error') this.set({ ...this.state, status: 'loading', error: null });
    this.loading = (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const results = await Promise.all(this.rangesToLoad().map((r) => this.transport.agenda(r)));
          let stale = false;
          for (const res of results) {
            if (res.rev < this.state.rev) stale = true;
            else this.applyRange(res);
          }
          if (!stale) break;
        }
      } catch (e) {
        // Agenda yang sudah tampil tetap tampil; hanya layar kosong yang menampilkan kegagalan.
        if (this.state.today === null && this.alive) this.set({ ...INITIAL, status: 'error', error: friendlyError(e) });
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  };

  /** Rentang yang dimuat: bawaan dan yang sudah dimuat (digabung); sebelum jawaban pertama, bawaan server (`undefined`). */
  private rangesToLoad(): ({ from: string; to: string } | undefined)[] {
    const today = this.state.today;
    if (today === null || this.state.ranges.length === 0) return [undefined];
    return mergeRanges([...this.state.ranges, defaultRangeFor(today)]);
  }

  /** Pastikan rentang tanggal ini sudah dimuat (kalender bulan lain). Teks ramah kalau gagal, selain itu `null`. */
  ensureRange = async (from: string, to: string): Promise<string | null> => {
    const covered = this.state.ranges.some((r) => r.from <= from && r.to >= to);
    if (covered) return null;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await this.transport.agenda({ from, to });
        // Jawaban lebih lama dari keadaan sekarang: dibuang dan diminta sekali lagi; rentangnya belum dianggap termuat.
        if (res.rev >= this.state.rev) {
          this.applyRange(res);
          break;
        }
      }
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  /** Item menurut id: dari yang sudah dikenal, selain itu dari server (layar alarm dari tautan). `null` kalau tidak ada. */
  item = (id: string): Promise<AgendaItem | null> => {
    const known =
      this.state.items.find((i) => i.id === id) ?? (this.state.leftover?.id === id ? this.state.leftover : null);
    if (known) return Promise.resolve(known);
    const running = this.fetching.get(id);
    if (running) return running;
    const p = this.transport.agendaItem(id).then(
      (item) => {
        this.fetching.delete(id);
        this.upsert([item], [], undefined, this.state.rev);
        return item;
      },
      () => {
        this.fetching.delete(id);
        return null;
      },
    );
    this.fetching.set(id, p);
    return p;
  };

  /** Pratinjau dari kalimat bebas, diurai server. */
  preview = async (text: string): Promise<PreviewResult> => {
    try {
      const res = await this.transport.agendaParse(text);
      return { ok: true, item: res.preview.item, guessedTime: res.preview.guessedTime };
    } catch (e) {
      return { ok: false, error: friendlyError(e), ...unavailableOf(e) };
    }
  };

  /** Simpan item dari pratinjau. `null` kalau berhasil, selain itu teks ramah (dan `unavailable` untuk 501). */
  add = async (item: AgendaNew): Promise<AgendaFailure | null> => {
    try {
      const saved = await this.transport.agendaAdd(item);
      this.upsert([saved], [], undefined, this.state.rev);
      return null;
    } catch (e) {
      return { error: friendlyError(e), ...unavailableOf(e) };
    }
  };

  /** Tandai selesai atau belum. Layar langsung berubah; kalau gagal kembali dan hasilnya teks ramah. */
  setDone = async (id: string, done: boolean): Promise<string | null> => {
    const before = this.state.items.find((i) => i.id === id);
    if (!before) return null;
    this.upsert([{ ...before, done }], [], undefined, this.state.rev);
    try {
      const saved = await this.transport.agendaPatch(id, { done });
      this.upsert([saved], [], undefined, this.state.rev);
      return null;
    } catch (e) {
      this.upsert([before], [], undefined, this.state.rev);
      return friendlyError(e);
    }
  };

  /**
   * Tandai selesai dari luar layar Agenda (tombol "Selesai" di notifikasi pengingat): juga untuk item yang belum dimuat
   * (aplikasi baru dibuka dari notifikasi). Yang sudah dikenal langsung berubah di layar; kalau gagal kembali. Melempar
   * kegagalan aslinya (bukan teks), supaya pemanggil bisa membedakan tanpa internet (diulang nanti) dari item yang sudah
   * tidak ada (dibuang).
   */
  markDone = async (id: string): Promise<void> => {
    const before = this.state.items.find((i) => i.id === id);
    if (before) this.upsert([{ ...before, done: true }], [], undefined, this.state.rev);
    try {
      const saved = await this.transport.agendaPatch(id, { done: true });
      this.upsert([saved], [], undefined, this.state.rev);
    } catch (e) {
      if (before && !isGone(e)) this.upsert([before], [], undefined, this.state.rev);
      if (isGone(e)) this.upsert([], [id], undefined, this.state.rev);
      throw e;
    }
  };

  /** Seperti {@link snooze}, tapi melempar kegagalan aslinya (lihat {@link markDone}). */
  snoozeStrict = async (id: string, untilIso: string): Promise<void> => {
    const saved = await this.transport.agendaPatch(id, { snoozeUntil: untilIso });
    this.upsert([saved], [], undefined, this.state.rev);
  };

  /** Balik status selesai sebuah tugas. */
  toggle = (id: string): Promise<string | null> => {
    const item = this.state.items.find((i) => i.id === id);
    return item ? this.setDone(id, !item.done) : Promise.resolve(null);
  };

  /** Tunda sampai saat itu (ISO 8601). `null` kalau berhasil, selain itu teks ramah. */
  snooze = async (id: string, untilIso: string): Promise<string | null> => {
    try {
      const saved = await this.transport.agendaPatch(id, { snoozeUntil: untilIso });
      this.upsert([saved], [], undefined, this.state.rev);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  /** Pilih nasib tugas kemarin. `null` kalau berhasil, selain itu teks ramah. */
  resolveLeftover = async (choice: 'today' | 'drop'): Promise<string | null> => {
    try {
      const created = await this.transport.agendaLeftover(choice);
      this.upsert(created ? [created] : [], [], null, this.state.rev);
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  };

  /** Kabari server bahwa alarm lokal sudah terjadwal. Gagal: `false` (dicoba lagi pada sinkron berikutnya). */
  ackAlarm = async (id: string, scheduledFor: string): Promise<boolean> => {
    try {
      await this.transport.agendaAlarmAck(id, scheduledFor);
      return true;
    } catch {
      return false;
    }
  };

  /** Majukan `today` dan `now` sesuai waktu yang berlalu sejak jawaban server; hari berganti: muat ulang rentangnya. */
  private tick() {
    if (!this.alive || !this.clock) return;
    const { today, now } = this.localClock(this.clock);
    if (today === this.state.today && now === this.state.now) return;
    const newDay = today !== this.state.today;
    this.set({ ...this.state, today, now });
    if (newDay) void this.load();
  }

  private localClock({ today, minutes, at }: { today: string; minutes: number; at: number }) {
    const total = minutes + Math.floor((Date.now() - at) / 60_000);
    const days = Math.floor(total / 1440);
    const m = total - days * 1440;
    return { today: days === 0 ? today : addDays(today, days), now: `${pad(Math.floor(m / 60))}.${pad(m % 60)}` };
  }

  private onEvent(event: StreamEvent) {
    if (event.type !== 'agenda' || !this.alive) return;
    if (event.rev < this.state.rev) return;
    this.upsert(event.items ?? [], event.removed ?? [], event.leftover, event.rev);
  }

  /** Gabungkan jawaban rentang: item dalam rentang diganti seluruhnya (yang hilang berarti terhapus). `rev` tidak turun. */
  private applyRange(res: AgendaRes) {
    if (!this.alive) return;
    const [h = 0, m = 0] = res.now.split('.').map(Number);
    this.clock = { today: res.today, minutes: h * 60 + m, at: Date.now() };
    const { from, to } = res;
    const outside = this.state.items.filter((i) => i.date < from || i.date > to);
    const items = [...outside, ...res.items].sort(byTime);
    const ranges = mergeRanges([...this.state.ranges, { from, to }]);
    this.set({
      items,
      leftover: res.leftover,
      today: res.today,
      now: res.now,
      tzOffsetMinutes: res.tzOffsetMinutes,
      ranges,
      status: 'ready',
      error: null,
      rev: Math.max(this.state.rev, res.rev),
    });
  }

  /** `leftover` `undefined` = tidak berubah. */
  private upsert(items: AgendaItem[], removed: string[], leftover: AgendaItem | null | undefined, rev: number) {
    if (!this.alive) return;
    const map = new Map(this.state.items.map((i) => [i.id, i]));
    for (const id of removed) map.delete(id);
    for (const item of items) map.set(item.id, item);
    this.set({
      ...this.state,
      items: [...map.values()].sort(byTime),
      leftover: leftover === undefined ? this.state.leftover : leftover,
      rev: Math.max(this.state.rev, rev),
    });
  }

  private set(next: AgendaState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}

/** Gabungkan rentang yang bersinggungan atau berimpit supaya daftar tetap pendek. */
function mergeRanges(ranges: { from: string; to: string }[]): { from: string; to: string }[] {
  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  const out: { from: string; to: string }[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r.from <= nextDay(last.to)) last.to = r.to > last.to ? r.to : last.to;
    else out.push({ ...r });
  }
  return out;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
