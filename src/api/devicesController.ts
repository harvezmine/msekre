import { deviceError, WRONG_PIN_TEXT } from './errors';
import type { Box, Device, DeviceControlReq, DevicesRes, DeviceState, StreamEvent } from './contract';
import { deviceStateOf, guessStatus, isGuardedAction } from './devices';
import { isApiFailure, type Transport, type Unsubscribe } from './transport';

export type DevicesStatus = 'loading' | 'ready' | 'error';

/** Perangkat satu tempat: jawaban terakhir `GET /devices?place=` yang diperbarui event stream dan perintah. */
export interface DevicesEntry {
  data: DevicesRes | null;
  /** `loading`: belum ada data; `error`: belum ada data dan gagal memuat (`error` berisi teks ramah). */
  status: DevicesStatus;
  error: string | null;
}

export interface DevicesState {
  /** Menurut nama tempat yang diminta (`Semua`, `Rumah`, ...). */
  entries: Record<string, DevicesEntry>;
}

const INITIAL: DevicesState = { entries: {} };

/**
 * Hasil perintah ke perangkat.
 * - `ok`: berhasil; `device` keadaan dari server.
 * - `pin`: aksi ini butuh PIN dan belum ada (atau server memintanya). Tidak ada yang berubah; layar membuka lembar PIN.
 * - `confirm`: membuka kunci saat PIN mati. Tidak ada yang berubah; layar bertanya "Buka kunci {nama}?" lebih dulu dan
 *   mengulang perintahnya dengan `{ confirmed: true }`.
 * - `pin_wrong`: PIN yang dikirim salah. Perangkat dikembalikan.
 * - `error`: gagal; perangkat dikembalikan, `message` teks ramah untuk toast.
 */
export type ControlResult =
  | { ok: true; device: Device }
  | { ok: false; reason: 'pin' }
  | { ok: false; reason: 'confirm' }
  | { ok: false; reason: 'pin_wrong'; message: string }
  | { ok: false; reason: 'error'; message: string };

export type RoutineResult = { ok: true; summary: string } | { ok: false; message: string };

/** Perangkat dengan `id` di cache tempat mana pun. */
export function findDevice(state: DevicesState, id: string): Device | undefined {
  for (const entry of Object.values(state.entries)) {
    const found = entry.data?.devices.find((d) => d.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Lama menunggu setelah perubahan nilai terakhir sebelum nilai akhirnya dikirim ke server. */
export const DEBOUNCE_MS = 400;

/** Perintah diterapkan lebih dulu di layar (optimistis); server yang memutuskan. Tombol navigasi remote tidak ditebak. */
function optimistic(d: Device, req: DeviceControlReq): Device {
  const next: Device = { ...d };
  const patch: DeviceState = {};
  const base = deviceStateOf(d);
  let status = false;
  if (req.on !== undefined) {
    next.on = req.on;
    patch.on = req.on;
    status = true;
  }
  if (req.locked !== undefined) {
    next.on = req.locked;
    patch.locked = req.locked;
    status = true;
  }
  if (req.privacy !== undefined) {
    next.on = !req.privacy;
    patch.privacy = req.privacy;
    status = true;
  }
  const level = req.brightness ?? req.level;
  if (level !== undefined) {
    next.level = level;
    patch.brightness = level;
    status = true;
  }
  if (d.ac && (req.temp !== undefined || req.mode !== undefined || req.fan !== undefined)) {
    next.ac = { temp: req.temp ?? d.ac.temp, mode: req.mode ?? d.ac.mode, fan: req.fan ?? d.ac.fan };
    status = true;
  }
  if (req.temp !== undefined) patch.temp = req.temp;
  if (req.mode !== undefined) patch.mode = req.mode;
  if (req.fan !== undefined) patch.fan = req.fan;
  if (req.swing !== undefined) patch.swing = req.swing;
  if (req.timerMinutes !== undefined) patch.timerMinutes = req.timerMinutes;
  if (req.colorTemp !== undefined) patch.colorTemp = req.colorTemp;
  if (req.color !== undefined) patch.color = req.color;
  if (req.volume !== undefined) patch.volume = req.volume;
  if (req.muted !== undefined) patch.muted = req.muted;
  if (req.source !== undefined) patch.source = req.source;
  if (req.channel !== undefined) patch.channel = req.channel;
  if (req.position !== undefined) patch.position = req.position;
  if (req.playback === 'play') patch.playing = true;
  if (req.playback === 'pause') patch.playing = false;
  if ((req.key === 'vol_up' || req.key === 'vol_down') && base.volume !== undefined) {
    const cap = d.capabilities.find((c) => c.type === 'volume');
    const [min, max] = cap?.type === 'volume' ? [cap.min, cap.max] : [0, 100];
    patch.volume = Math.min(max, Math.max(min, base.volume + (req.key === 'vol_up' ? 1 : -1)));
    patch.muted = false;
  }
  if (Object.keys(patch).length > 0) next.state = { ...d.state, ...patch };
  if (status) next.status = guessStatus(next);
  return next;
}

/**
 * Pemilik data Perangkat: cache per tempat dari `GET /devices?place=`, diperbarui lewat event stream `device` (upsert
 * menurut `rev`; yang lebih lama dibuang) dan muat ulang setiap koneksi stream terbuka. Perintah ke perangkat
 * diterapkan lebih dulu di layar dan dikembalikan bila gagal. Hidup selama aplikasi terbuka (lihat `DevicesProvider`).
 */
export class DevicesController {
  private state: DevicesState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  /** Perintah terakhir per perangkat: hanya yang terakhir yang boleh menimpa layar saat menjawab atau gagal. */
  private readonly latest = new Map<string, number>();
  /** `rev` jawaban perintah terakhir per perangkat: event `device` yang lebih lama darinya dibuang untuk perangkat itu. */
  private readonly repliedRev = new Map<string, number>();
  /** Nilai kontinu yang menunggu dikirim, per perangkat. */
  private readonly pending = new Map<
    string,
    {
      req: DeviceControlReq;
      baseline: Device | undefined;
      timer: ReturnType<typeof setTimeout> | null;
      resolve: ((r: ControlResult) => void) | null;
    }
  >();
  private counter = 0;
  private alive = true;

  constructor(private readonly transport: Transport) {}

  getState = (): DevicesState => this.state;

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
      () => void this.reloadAll(),
    );
  }

  stop() {
    this.alive = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Muat perangkat satu tempat. Yang sudah ada tetap tampil selagi dimuat ulang. */
  load = (place: string): Promise<void> => {
    const running = this.loading.get(place);
    if (running) return running;
    const entry = this.state.entries[place];
    if (!entry?.data && entry?.status !== 'loading')
      this.setEntry(place, { data: null, status: 'loading', error: null });
    const job = (async () => {
      try {
        // `rev` tidak pernah turun: jawaban yang lebih lama dari keadaan sekarang (event masuk selagi memuat) dibuang
        // dan dimuat sekali lagi.
        for (let attempt = 0; attempt < 2; attempt++) {
          const data = await this.transport.devices(place);
          const have = this.state.entries[place]?.data;
          if (have && data.rev < have.rev) continue;
          this.setEntry(place, { data, status: 'ready', error: null });
          break;
        }
      } catch (e) {
        const current = this.state.entries[place];
        if (!current?.data && this.alive) this.setEntry(place, { data: null, status: 'error', error: deviceError(e) });
      } finally {
        this.loading.delete(place);
      }
    })();
    this.loading.set(place, job);
    return job;
  };

  reloadAll = async (): Promise<void> => {
    await Promise.all(Object.keys(this.state.entries).map((place) => this.load(place)));
  };

  find = (id: string): Device | undefined => findDevice(this.state, id);

  /**
   * Atur satu perangkat. Aksi yang dijaga (mematikan kamera, membuka kunci) tanpa `pin` lebih dulu bertanya apakah PIN
   * dihidupkan (gagal bertanya dianggap ya) dan hasilnya `pin`, tanpa mengubah apa pun.
   */
  controlDevice = async (
    id: string,
    req: DeviceControlReq,
    options: { confirmed?: boolean } = {},
  ): Promise<ControlResult> => {
    // Nilai yang masih menunggu dikirim lebih dulu, supaya urutannya tetap.
    if (this.pending.has(id)) await this.flush(id);
    const before = this.find(id);
    const guarded = !!before && (before.sensitive || before.kind === 'lock' || before.kind === 'camera');
    if (guarded && isGuardedAction(req) && req.pin === undefined) {
      if (await this.pinRequired()) return { ok: false, reason: 'pin' };
      // PIN mati: membuka kunci tetap bertanya dulu (bukan PIN), supaya ketukan tidak sengaja tidak membuka pintu.
      if (before?.kind === 'lock' && !options.confirmed) return { ok: false, reason: 'confirm' };
    }
    const current = this.find(id);
    if (current) this.replace(optimistic(current, req));
    return this.send(id, req, current);
  };

  /**
   * Untuk nilai yang berubah terus selama jari menggeser (suhu, terang, volume, posisi, suhu warna): layar berubah
   * seketika, lalu hanya nilai akhir yang dikirim, {@link DEBOUNCE_MS} setelah perubahan terakhir. Panggilan yang
   * digabung ke panggilan berikutnya langsung dijawab `ok` dengan keadaan layar; yang terakhir membawa jawaban server.
   * Gagal: perangkat dikembalikan ke keadaan sebelum perubahan pertama.
   */
  controlDeviceDebounced = (id: string, req: DeviceControlReq, delayMs = DEBOUNCE_MS): Promise<ControlResult> => {
    const current = this.find(id);
    let entry = this.pending.get(id);
    if (!entry) {
      entry = { req: {}, baseline: current, timer: null, resolve: null };
      this.pending.set(id, entry);
    }
    const previous = entry.resolve;
    entry.req = { ...entry.req, ...req };
    if (current) this.replace(optimistic(current, req));
    if (entry.timer) clearTimeout(entry.timer);
    const shown = this.find(id) ?? current;
    if (previous && shown) previous({ ok: true, device: shown });
    return new Promise<ControlResult>((resolve) => {
      entry.resolve = resolve;
      entry.timer = setTimeout(() => void this.flush(id), delayMs);
    });
  };

  /** Kirim sekarang nilai yang menunggu (satu perangkat, atau semuanya). Dipakai saat layar ditutup. */
  flush = async (id?: string): Promise<void> => {
    const ids = id === undefined ? [...this.pending.keys()] : [id];
    await Promise.all(
      ids.map(async (key) => {
        const entry = this.pending.get(key);
        if (!entry) return;
        this.pending.delete(key);
        if (entry.timer) clearTimeout(entry.timer);
        const result = await this.send(key, entry.req, entry.baseline);
        entry.resolve?.(result);
      }),
    );
  };

  /** Kirim ke server; `revertTo` dipasang kembali bila gagal dan tidak ada perintah yang lebih baru. */
  private async send(id: string, req: DeviceControlReq, revertTo: Device | undefined): Promise<ControlResult> {
    const mine = ++this.counter;
    this.latest.set(id, mine);
    try {
      const { device, rev } = await this.transport.controlDevice(id, req);
      if (this.latest.get(id) === mine) {
        this.replace(device);
        this.repliedRev.set(id, Math.max(rev, this.repliedRev.get(id) ?? 0));
      }
      return { ok: true, device };
    } catch (e) {
      if (this.latest.get(id) === mine && revertTo) this.replace(revertTo);
      if (isApiFailure(e) && e.code === 'pin_required') return { ok: false, reason: 'pin' };
      if (isApiFailure(e) && e.code === 'pin_wrong') return { ok: false, reason: 'pin_wrong', message: WRONG_PIN_TEXT };
      return { ok: false, reason: 'error', message: deviceError(e) };
    }
  }

  runRoutine = async (routineId: string, place: string): Promise<RoutineResult> => {
    try {
      const res = await this.transport.runRoutine(routineId, place);
      for (const device of res.devices) {
        this.replace(device);
        this.repliedRev.set(device.id, Math.max(res.rev, this.repliedRev.get(device.id) ?? 0));
      }
      return { ok: true, summary: res.summary };
    } catch (e) {
      return { ok: false, message: deviceError(e) };
    }
  };

  /** Nyalakan atau matikan mikrofon Kotak. `null` kalau berhasil, selain itu teks ramah. */
  setBoxMic = async (micOn: boolean): Promise<string | null> => {
    const before = this.boxOf();
    if (before) this.replaceBox({ ...before, micOn });
    try {
      this.replaceBox((await this.transport.setBoxMic(micOn)).box);
      return null;
    } catch (e) {
      if (before) this.replaceBox(before);
      return deviceError(e);
    }
  };

  // ---- Dalaman ----

  private async pinRequired(): Promise<boolean> {
    try {
      return (await this.transport.security()).pinEnabled;
    } catch {
      return true;
    }
  }

  private boxOf(): Box | null {
    for (const entry of Object.values(this.state.entries)) if (entry.data?.box) return entry.data.box;
    return null;
  }

  private onEvent(event: StreamEvent) {
    if (event.type !== 'device' || !this.alive) return;
    const entries = { ...this.state.entries };
    for (const [place, entry] of Object.entries(entries)) {
      if (!entry.data || event.rev < entry.data.rev) continue;
      let data: DevicesRes = { ...entry.data, rev: event.rev };
      for (const device of event.devices ?? []) {
        // Keadaan yang lebih lama dari jawaban perintah untuk perangkat ini tidak boleh menimpanya.
        if (event.rev < (this.repliedRev.get(device.id) ?? 0)) continue;
        data = upsert(data, device);
      }
      if (event.box && data.box) data = { ...data, box: event.box };
      entries[place] = { ...entry, data };
    }
    this.set({ entries });
  }

  /** Ganti satu perangkat di semua cache yang memuatnya (tanpa mengubah `rev`). */
  private replace(device: Device) {
    this.mapData((data) => upsert(data, device));
  }

  private replaceBox(box: Box) {
    this.mapData((data) => (data.box ? { ...data, box } : data));
  }

  private mapData(change: (data: DevicesRes) => DevicesRes) {
    if (!this.alive) return;
    const entries = { ...this.state.entries };
    let changed = false;
    for (const [place, entry] of Object.entries(entries)) {
      if (!entry.data) continue;
      const data = change(entry.data);
      if (data === entry.data) continue;
      entries[place] = { ...entry, data };
      changed = true;
    }
    if (changed) this.set({ entries });
  }

  private setEntry(place: string, entry: DevicesEntry) {
    if (!this.alive) return;
    this.set({ entries: { ...this.state.entries, [place]: entry } });
  }

  private set(next: DevicesState) {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}

/** Ganti perangkat dengan `id` yang sama; perangkat baru ikut bila tempatnya termasuk di data ini. */
function upsert(data: DevicesRes, device: Device): DevicesRes {
  const at = data.devices.findIndex((d) => d.id === device.id);
  if (at >= 0) {
    const devices = data.devices.slice();
    devices[at] = device;
    return { ...data, devices };
  }
  if (data.place !== 'Semua' && data.place !== device.place) return data;
  return { ...data, devices: [...data.devices, device] };
}
