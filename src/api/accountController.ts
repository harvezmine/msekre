import { isAssistantName } from './account';
import type {
  Account,
  AccountNotifications,
  AssistantUpdateReq,
  GreetingUpdateReq,
  NotificationsUpdateReq,
  StreamEvent,
} from './contract';
import { friendlyError, INVALID_NAME_TEXT } from './errors';
import type { Transport, Unsubscribe } from './transport';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface AccountState {
  data: Account | null;
  status: LoadStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Pekerjaan yang sedang berjalan: `assistant`, `greeting`, `notifications`, dan `phone:<id>`. */
  busy: ReadonlySet<string>;
}

export type AccountResult = { ok: true } | { ok: false; message: string };

type Section = 'assistant' | 'greeting' | 'notifications';

const INITIAL: AccountState = { data: null, status: 'loading', error: null, busy: new Set() };

/**
 * Pemilik data Akun: `GET /account`, ubah nama dan gaya, sapaan, jenis notifikasi (tampil dulu, dikembalikan kalau
 * server menolak), dan keluarkan HP. Event stream `account` menggantikan Akun (upsert menurut `rev`; yang lebih lama
 * dibuang). Bagian yang sedang diubah tidak ditimpa jawaban lain sampai selesai. Hidup selama aplikasi terbuka (lihat
 * `AccountProvider`).
 */
export class AccountController {
  private state: AccountState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: Unsubscribe | null = null;
  private loadingJob: Promise<void> | null = null;
  /** Berapa perubahan tiap bagian yang masih menunggu jawaban server. */
  private readonly inflight: Record<Section, number> = { assistant: 0, greeting: 0, notifications: 0 };
  private alive = true;
  private requested = false;

  constructor(private readonly transport: Transport) {}

  getState = (): AccountState => this.state;

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

  // ---- Memuat ----

  /** Muat Akun. Yang sudah ada tetap tampil selagi dimuat ulang. */
  load = (): Promise<void> => {
    this.requested = true;
    if (this.loadingJob) return this.loadingJob;
    if (!this.state.data && this.state.status !== 'loading')
      this.set({ ...this.state, status: 'loading', error: null });
    const job = (async () => {
      try {
        const account = await this.transport.account();
        this.apply(account);
      } catch (e) {
        if (!this.state.data && this.alive) this.set({ ...this.state, status: 'error', error: friendlyError(e) });
      } finally {
        this.loadingJob = null;
      }
    })();
    this.loadingJob = job;
    return job;
  };

  /** Muat ulang bila ada layar yang pernah memintanya (aplikasi kembali ke depan, stream tersambung lagi). */
  reloadAll = async (): Promise<void> => {
    if (this.requested) await this.load();
  };

  // ---- Mengubah ----

  /** Nama dan/atau gaya asisten. Nama yang bukan 2 sampai 20 huruf ditolak di HP, tanpa permintaan. */
  setAssistant = (req: AssistantUpdateReq): Promise<AccountResult> => {
    const name = req.name?.trim();
    if (name !== undefined && !isAssistantName(name)) return Promise.resolve({ ok: false, message: INVALID_NAME_TEXT });
    const body: AssistantUpdateReq = {
      ...(name !== undefined ? { name } : {}),
      ...(req.style ? { style: req.style } : {}),
    };
    return this.mutate(
      'assistant',
      (a) => ({ ...a, assistant: { ...a.assistant, ...body } }),
      // Hanya yang diubah permintaan ini yang dikembalikan.
      (a, was) => ({
        ...a,
        assistant: {
          name: body.name === undefined ? a.assistant.name : was.assistant.name,
          style: body.style === undefined ? a.assistant.style : was.assistant.style,
        },
      }),
      () => this.transport.setAssistant(body),
    );
  };

  /** Sapaan harian hidup atau mati, dan jamnya. */
  setGreeting = (req: GreetingUpdateReq): Promise<AccountResult> =>
    this.mutate(
      'greeting',
      (a) => {
        const time = req.time ?? a.greeting.time;
        return { ...a, greeting: { daily: req.daily, ...(time ? { time } : {}) } };
      },
      (a, was) => ({ ...a, greeting: was.greeting }),
      () => this.transport.setGreeting(req),
    );

  /** Satu atau beberapa jenis notifikasi. */
  setNotifications = (req: NotificationsUpdateReq): Promise<AccountResult> =>
    this.mutate(
      'notifications',
      (a) => ({ ...a, notifications: { ...a.notifications, ...req } }),
      (a, was) => {
        const keys = Object.keys(req) as (keyof AccountNotifications)[];
        return {
          ...a,
          notifications: { ...a.notifications, ...Object.fromEntries(keys.map((k) => [k, was.notifications[k]])) },
        };
      },
      () => this.transport.setNotifications(req),
    );

  /** Keluarkan satu HP. HP ini sendiri tidak bisa (pakai Keluar). */
  removePhone = async (id: string): Promise<AccountResult> => {
    const key = `phone:${id}`;
    const phone = this.state.data?.phones.find((p) => p.id === id);
    if (!phone || phone.current || this.state.busy.has(key)) return { ok: false, message: '' };
    this.setBusy(key, true);
    try {
      this.apply(await this.transport.removePhone(id));
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e) };
    } finally {
      this.setBusy(key, false);
    }
  };

  // ---- Dalaman ----

  /**
   * Tampilkan `optimistic` dulu, lalu kirim `call`. Gagal: `revert` mengembalikan hanya yang diubah permintaan ini ke
   * keadaan sebelum `optimistic` (`was`), tanpa menyentuh bagian lain yang sudah diperbarui stream.
   */
  private async mutate(
    section: Section,
    optimistic: (a: Account) => Account,
    revert: (a: Account, was: Account) => Account,
    call: () => Promise<Account>,
  ): Promise<AccountResult> {
    const was = this.state.data;
    if (!was) return { ok: false, message: friendlyError(null) };
    this.inflight[section] += 1;
    this.set({ ...this.state, data: optimistic(was), busy: withBusy(this.state.busy, section, true) });
    try {
      const account = await call();
      this.inflight[section] -= 1;
      this.apply(account);
      return { ok: true };
    } catch (e) {
      this.inflight[section] -= 1;
      const now = this.state.data;
      if (now) this.set({ ...this.state, data: revert(now, was) });
      return { ok: false, message: friendlyError(e) };
    } finally {
      if (this.inflight[section] === 0) this.set({ ...this.state, busy: withBusy(this.state.busy, section, false) });
    }
  }

  /** Pasang Akun dari server. Yang lebih lama dibuang; bagian yang sedang diubah tetap milik layar. */
  private apply(account: Account) {
    if (!this.alive) return;
    const have = this.state.data;
    if (have && account.rev < have.rev) {
      if (this.state.status !== 'ready') this.set({ ...this.state, status: 'ready', error: null });
      return;
    }
    const keep = (section: Section): Partial<Account> =>
      have && this.inflight[section] > 0 ? ({ [section]: have[section] } as Partial<Account>) : {};
    this.set({
      ...this.state,
      data: { ...account, ...keep('assistant'), ...keep('greeting'), ...keep('notifications') },
      status: 'ready',
      error: null,
    });
  }

  private onEvent(event: StreamEvent) {
    if (event.type === 'account') this.apply(event.account);
  }

  private setBusy(key: string, on: boolean) {
    if (!this.alive || this.state.busy.has(key) === on) return;
    this.set({ ...this.state, busy: withBusy(this.state.busy, key, on) });
  }

  private set(next: AccountState) {
    if (!this.alive) return;
    this.state = next;
    for (const l of [...this.listeners]) l();
  }
}

function withBusy(busy: ReadonlySet<string>, key: string, on: boolean): ReadonlySet<string> {
  if (busy.has(key) === on) return busy;
  const next = new Set(busy);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}
