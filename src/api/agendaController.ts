import { friendlyError } from './errors';
import type { AgendaItem, AgendaNew, AgendaRes, StreamEvent } from './contract';
import type { Transport, Unsubscribe } from './transport';

export type AgendaStatus = 'loading' | 'ready' | 'error';

export interface AgendaState {
  /** Item yang dikenal (gabungan semua rentang yang sudah dimuat), urut tanggal lalu jam. */
  items: AgendaItem[];
  /** Sisa tugas kemarin, atau `null`. */
  leftover: AgendaItem | null;
  /** "Hari ini" (YYYY-MM-DD) dan jam sekarang (HH.MM) menurut server, atau `null` sebelum jawaban pertama. */
  today: string | null;
  now: string | null;
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
  ranges: [],
  status: 'loading',
  error: null,
  rev: 0,
};

const byTime = (a: AgendaItem, b: AgendaItem) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

/** Hasil pratinjau: item yang akan disimpan, atau teks ramah kalau gagal. */
export type PreviewResult = { ok: true; item: AgendaNew; guessedTime: boolean } | { ok: false; error: string };

/**
 * Pemilik data Agenda: muat dari `GET /agenda` (rentang bawaan dulu, rentang lain sesuai layar), perbarui lewat event
 * stream `agenda` (upsert; `rev` yang lebih lama dibuang), muat ulang tiap koneksi stream terbuka dan saat aplikasi
 * kembali ke depan. Aksinya (tambah, selesai, tunda, sisa kemarin) bertanya ke server dan memakai jawabannya.
 */
export class AgendaController {
  private state: AgendaState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private loading: Promise<void> | null = null;
  private alive = true;
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
    void this.load();
  }

  stop() {
    this.alive = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /**
   * Muat ulang semua rentang yang sudah dimuat (atau rentang bawaan kalau belum ada). Yang terakhir diambil dianggap
   * benar, juga bila `rev`-nya lebih kecil (misalnya server diganti).
   */
  load = (): Promise<void> => {
    if (this.loading) return this.loading;
    if (this.state.status === 'error') this.set({ ...this.state, status: 'loading', error: null });
    const ranges = this.state.ranges;
    this.loading = (async () => {
      try {
        if (ranges.length === 0) {
          this.applyRange(await this.transport.agenda(), true);
        } else {
          const results = await Promise.all(ranges.map((r) => this.transport.agenda(r)));
          results.forEach((res, i) => this.applyRange(res, i === 0));
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

  /** Pastikan rentang tanggal ini sudah dimuat (kalender bulan lain). Teks ramah kalau gagal, selain itu `null`. */
  ensureRange = async (from: string, to: string): Promise<string | null> => {
    const covered = this.state.ranges.some((r) => r.from <= from && r.to >= to);
    if (covered) return null;
    try {
      this.applyRange(await this.transport.agenda({ from, to }), false);
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
      return { ok: false, error: friendlyError(e) };
    }
  };

  /** Simpan item dari pratinjau. `null` kalau berhasil, selain itu teks ramah. */
  add = async (item: AgendaNew): Promise<string | null> => {
    try {
      const saved = await this.transport.agendaAdd(item);
      this.upsert([saved], [], undefined, this.state.rev);
      return null;
    } catch (e) {
      return friendlyError(e);
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

  private onEvent(event: StreamEvent) {
    if (event.type !== 'agenda' || !this.alive) return;
    if (event.rev < this.state.rev) return;
    this.upsert(event.items ?? [], event.removed ?? [], event.leftover, event.rev);
  }

  /** Gabungkan jawaban rentang: item dalam rentang diganti seluruhnya (yang hilang berarti terhapus). */
  private applyRange(res: AgendaRes, force: boolean) {
    if (!this.alive) return;
    const { from, to } = res;
    const outside = this.state.items.filter((i) => i.date < from || i.date > to);
    const items = [...outside, ...res.items].sort(byTime);
    const ranges = mergeRanges([...this.state.ranges, { from, to }]);
    this.set({
      items,
      leftover: res.leftover,
      today: res.today,
      now: res.now,
      ranges,
      status: 'ready',
      error: null,
      rev: force ? res.rev : Math.max(this.state.rev, res.rev),
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
