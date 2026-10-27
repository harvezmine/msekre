import { ERROR_TEXT } from '@/api/errors';
import type { Card, VoiceEvent } from '@/api/contract';
import { VOICE_MAX_UTTERANCE_SEC } from '@/api/contract';
import type { Transport, VoiceCloseReason, VoiceSession } from '@/api/transport';
import { checkMic as realCheckMic, removeSpeechFile, requestMic as realRequestMic, writeSpeechFile } from './audio';
import { reportError } from '@/crash';
import { IN_CHAT_TEXT, LATE_TEXT, NOT_HEARD_TEXT, SHORT_HOLD_TEXT, STT_FAILED_TEXT, VOICE_SOON_TEXT } from './texts';
import type { MicPermission, Speaker, SpeechSource } from './audio';
import { level } from './pcm';
import { concatPcm, encodeChunks, firstChannel, prepareUtterance, resample, resampleTo16k, VOICE_RATE } from './prep';

export { IN_CHAT_TEXT, LATE_TEXT, NOT_HEARD_TEXT, SHORT_HOLD_TEXT, STT_FAILED_TEXT } from './texts';

/**
 * Keadaan Mode Suara: `idle → listening → sending → thinking → speaking → idle`. `off` = tidak tersambung atau sesi
 * ditolak; `error` = kendala di tengah jalan (tahan Inti lagi untuk mencoba).
 */
export type VoicePhase = 'idle' | 'listening' | 'sending' | 'thinking' | 'speaking' | 'off' | 'error';

export interface VoiceState {
  phase: VoicePhase;
  /** Teks ucapan pengguna (sementara selama `transcriptFinal` salah). */
  transcript: string;
  transcriptFinal: boolean;
  /** Teks balasan; tetap tampil walau suaranya dibisukan. */
  reply: string | null;
  /** Kartu yang perlu ketukan pengguna (pembayaran, pesan ke orang lain, aksi keamanan). */
  confirm: { card: Card; messageId?: string } | null;
  muted: boolean;
  /** Mode ketik di dalam Mode Suara. */
  typing: boolean;
  /**
   * Lembar izin mikrofon: penjelasan sebelum menanyakan, arahan ke pengaturan HP, atau `waiting` = pengaturan HP sedang
   * dibuka (lembar tetap ada; saat pengguna kembali izinnya dicek lagi).
   */
  permission: 'explain' | 'blocked' | 'waiting' | null;
  /** Satu kalimat (petunjuk, kendala, tidak tersambung). */
  note: string | null;
  /** Menunggu jawaban lebih dari {@link SLOW_TURN_MS}: "Masih saya kerjakan…". */
  slow: boolean;
}

export const HINT_HOLD = 'Tahan Inti sambil bicara';
export const OFFLINE_TEXT = 'Belum tersambung. Coba lagi sebentar ya.';
export const SIGNED_OUT_TEXT = 'Sesi Anda berakhir. Masuk lagi ya.';
export const MIC_FAILED_TEXT = 'Mikrofon belum bisa dipakai. Coba lagi sebentar ya.';
export const CARD_UNREADABLE_TEXT = 'Permintaan konfirmasi belum bisa ditampilkan di sini. Lanjutkan di chat ya.';
export const MIC_ALLOWED_TEXT = 'Mikrofon sudah boleh dipakai. Tahan Inti sambil bicara.';

/** Ucapan lebih pendek dari ini dianggap ketukan biasa, bukan bicara: tidak ada yang dikirim. */
export const MIN_UTTERANCE_MS = 400;
/** Mikrofon tetap menyala sebentar setelah jari diangkat, supaya suku kata terakhir tidak terpotong. */
export const RELEASE_TAIL_MS = 300;
/** Balasan sudah tampil tapi suaranya tidak kunjung datang: kembali siap. */
export const SPEECH_WAIT_MS = 6000;
/** Potongan balasan tanpa tanda terakhir: putar setelah sepi sekian lama. */
export const SPEECH_GATHER_MS = 1200;
/** Menunggu jawaban selama ini: "Masih saya kerjakan…". */
export const SLOW_TURN_MS = 8000;
/**
 * Menunggu jawaban tanpa kabar apa pun dari server selama ini (server sendiri menunggu agen sampai ±90 detik dan
 * mengulang `thinking on` selama bekerja; tiap kabar memperpanjang tunggu ini): berhenti menunggu dengan tenang.
 * Balasan yang datang sesudahnya tetap ditampilkan, dan tetap masuk chat.
 */
export const TURN_TIMEOUT_MS = 95_000;

const FORMAT = { codec: 'pcm16', sampleRate: VOICE_RATE, channels: 1 } as const;

export interface VoiceMic {
  start(): Promise<void>;
  stop(): void;
}

/** Satu catatan giliran untuk log pengembangan (tanpa isi ucapan). */
export interface VoiceTurnLog {
  turn: string;
  /** `reply`, `confirm`, kode `error`, `short`, `silent`, `cancelled`, `late`, `in_chat`, `offline`, ... */
  outcome: string;
  /** Suara yang terekam sebelum dipangkas, ms. */
  heardMs?: number;
  speechMs?: number;
  leadMs?: number;
  trailMs?: number;
  gain?: number;
  /** Laju mikrofon yang diterima, Hz. */
  rate?: number;
  /** Dari dikirim sampai kabar pertama server dan sampai selesai, ms. */
  firstEventMs?: number;
  totalMs?: number;
  retried?: boolean;
}

export interface VoiceDeps {
  transport: Pick<Transport, 'openVoice' | 'mediaUrl'>;
  mic: VoiceMic;
  speaker: Speaker;
  /** Getar ringan saat mulai dan selesai bicara. */
  haptic(): void;
  /** Keras-pelannya suara 0..1 selama mendengarkan, lalu 0. */
  onLevel?(value: number): void;
  checkMic?: () => Promise<MicPermission>;
  requestMic?: () => Promise<MicPermission>;
  /** Lama mikrofon tetap menyala setelah dilepas (bawaan {@link RELEASE_TAIL_MS}; 0 = langsung). */
  tailMs?: number;
  /** Catatan per giliran (hanya pengembangan). */
  log?(entry: VoiceTurnLog): void;
  /** Jam, ms (untuk tes). */
  now?(): number;
}

const INITIAL: VoiceState = {
  phase: 'idle',
  transcript: '',
  transcriptFinal: false,
  reply: null,
  confirm: null,
  muted: false,
  typing: false,
  permission: null,
  note: null,
  slow: false,
};

const isWaiting = (p: VoicePhase) => p === 'sending' || p === 'thinking';

/** Masukan giliran yang dikirim, disimpan supaya bisa dikirim ulang sekali bila soket putus. */
type TurnInput = { kind: 'audio'; chunks: string[] } | { kind: 'text'; text: string };

/**
 * Kalimat ramah untuk kode `error` server. `phase: 'idle'` untuk yang bisa langsung dicoba lagi (Inti tetap tenang),
 * `'error'` hanya bila sebabnya tidak diketahui.
 */
export function errorNote(code: string): { phase: VoicePhase; note: string } {
  switch (code) {
    case 'tidak_terdengar':
      return { phase: 'idle', note: NOT_HEARD_TEXT };
    case 'stt_gagal':
    case 'tidak_valid':
      return { phase: 'idle', note: STT_FAILED_TEXT };
    case 'lama':
    case 'tanpa_jawaban':
      return { phase: 'idle', note: LATE_TEXT };
    case 'sudah_ada':
      return { phase: 'idle', note: IN_CHAT_TEXT };
    default:
      return { phase: 'error', note: ERROR_TEXT };
  }
}

export class VoiceController {
  private state: VoiceState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private session: VoiceSession | null = null;
  private disposed = false;
  /** Naik setiap giliran dibatalkan atau dimulai: pekerjaan async dari giliran lama dibuang. */
  private epoch = 0;
  /** `clientId` giliran yang sedang berjalan; event server dengan `turn` lain dibuang. */
  private turnId: string | null = null;
  private pressed = false;
  private starting: Promise<void> | null = null;
  private micOn = false;
  private micPending = false;
  private micStopWanted = false;
  /** Potongan mikrofon (mono, laju HP) selama menahan; dikirim sekaligus setelah dilepas. */
  private raw: Int16Array[] = [];
  private rawSamples = 0;
  private rawRate = 0;
  /** Mikrofon masih menyala sesaat setelah dilepas ({@link RELEASE_TAIL_MS}). */
  private tailing = false;
  private tailTimer: ReturnType<typeof setTimeout> | null = null;
  private turnInput: TurnInput | null = null;
  /** Server sudah menerima ucapan giliran ini (teks final atau berpikir): jangan dikirim ulang. */
  private acked = false;
  /** Balasan atau kartu giliran ini sudah datang. */
  private replied = false;
  private retried = false;
  /** Server mengirim `thinking on` dan belum `thinking off`: agennya masih bekerja (mis. setelah kalimat pengisi). */
  private serverThinking = false;
  private turnLog: Omit<VoiceTurnLog, 'outcome'> & { sentAt?: number; firstAt?: number } = { turn: '' };
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private gatherTimer: ReturnType<typeof setTimeout> | null = null;
  private speech: { chunks: string[]; mime: string } | null = null;
  /** Klip yang sudah diantre di pemutar dan belum selesai; unduhan `speech` yang belum sampai. */
  private playing = 0;
  private fetching = 0;
  private files = 0;
  private fileUris = new Set<string>();

  constructor(private readonly deps: VoiceDeps) {}

  getState = (): VoiceState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /**
   * Satu-satunya tempat keadaan berubah. Meninggalkan `listening` (oleh sebab apa pun) mematikan mikrofon, mereset
   * cincin, dan membatalkan batas 30 detik, kecuali sisa rekaman setelah dilepas (`tailing`); masuk ke
   * `sending`/`thinking` memulai batas tunggu balasan.
   */
  private set(patch: Partial<VoiceState>) {
    if (this.disposed) return;
    const prev = this.state.phase;
    const next = patch.phase ?? prev;
    if (prev === 'listening' && next !== 'listening' && !(next === 'sending' && this.tailing)) this.releaseMic();
    const leaving = isWaiting(prev) && !isWaiting(next);
    this.state = { ...this.state, ...patch, ...(leaving ? { slow: false } : null) };
    if (isWaiting(next) && !isWaiting(prev)) this.startTurnTimers();
    else if (!isWaiting(next)) this.clearTurnTimers();
    for (const l of [...this.listeners]) l();
  }

  /** Buka sesi lebih dulu, supaya tidak tersambung terlihat sejak layar terbuka. */
  start() {
    // Efek yang dijalankan ulang (mode ketat) menghidupkan pengendali yang tadi dilepas.
    this.disposed = false;
    this.ensureSession();
  }

  private ensureSession(): VoiceSession {
    if (this.session) return this.session;
    const session = this.deps.transport.openVoice();
    this.session = session;
    session.onEvent((event) => this.onEvent(session, event));
    session.onClose((reason) => this.onClose(session, reason));
    return session;
  }

  // ---- Tahan untuk bicara ----

  /**
   * Inti ditekan. Menyela balasan yang sedang berjalan (barge-in). Mikrofon hanya dinyalakan setelah izinnya pasti
   * `granted`; belum ditanya atau ditolak = lembar izin, tanpa merekam. Tidak pernah melempar: kendala tak terduga
   * menjadi kabar "mikrofon belum bisa dipakai" (dipanggil dari sentuhan dan dari layar yang baru terbuka).
   */
  holdStart = async (): Promise<void> => {
    try {
      await this.beginHold();
    } catch (e) {
      this.failHold('mulai bicara', e);
    }
  };

  private async beginHold(): Promise<void> {
    if (this.disposed || this.pressed || this.state.permission) return;
    this.pressed = true;
    const check = this.deps.checkMic ?? realCheckMic;
    let permission: MicPermission;
    try {
      permission = await check();
    } catch {
      permission = 'blocked';
    }
    if (this.disposed) return;
    if (permission !== 'granted') {
      this.pressed = false;
      this.set({ permission: permission === 'ask' ? 'explain' : 'blocked' });
      return;
    }
    if (!this.pressed) {
      // Dilepas sebelum izin selesai diperiksa: ketukan biasa.
      this.set({ note: SHORT_HOLD_TEXT });
      return;
    }
    this.interrupt();
    const epoch = this.epoch;
    const clientId = `suara-${this.now().toString(36)}-${epoch}`;
    this.turnId = clientId;
    this.resetTurn(clientId);
    // Soket dibuka (atau dipakai ulang) selagi bicara; ucapannya dikirim sekaligus setelah dilepas.
    this.ensureSession();
    this.set({
      phase: 'listening',
      transcript: '',
      transcriptFinal: false,
      reply: null,
      confirm: null,
      note: null,
    });
    this.buzz();
    this.limitTimer = setTimeout(() => void this.holdEnd(), VOICE_MAX_UTTERANCE_SEC * 1000);
    this.micOn = true;
    this.micPending = true;
    this.micStopWanted = false;
    // Modul native boleh melempar langsung (bukan janji yang ditolak): diperlakukan sama, kendala mikrofon.
    let started: Promise<void>;
    try {
      started = this.deps.mic.start();
    } catch (e) {
      started = Promise.reject(e);
    }
    this.starting = Promise.resolve(started).then(
      () => {
        this.micPending = false;
        if (this.micStopWanted) this.stopMic();
      },
      (e: unknown) => {
        this.micPending = false;
        this.micOn = false;
        reportError('Mode Suara: mikrofon gagal menyala', e);
        if (this.disposed || epoch !== this.epoch) return;
        this.finishLog('mic_failed');
        this.turnId = null;
        this.set({ phase: 'error', note: MIC_FAILED_TEXT });
      },
    );
  }

  private resetTurn(id: string) {
    this.raw = [];
    this.rawSamples = 0;
    this.rawRate = 0;
    this.turnInput = null;
    this.acked = false;
    this.replied = false;
    this.retried = false;
    this.serverThinking = false;
    this.turnLog = { turn: id };
  }

  /** Kendala tak terduga saat menahan atau melepas Inti: mikrofon mati, giliran batal, kabar ramah. */
  private failHold(step: string, e: unknown) {
    reportError(`Mode Suara: ${step}`, e);
    this.pressed = false;
    try {
      this.clearLimit();
      this.clearTail();
      this.stopMic();
      this.turnId = null;
      this.epoch += 1;
      if (!this.disposed) this.set({ phase: 'error', note: MIC_FAILED_TEXT });
    } catch (again) {
      reportError(`Mode Suara: ${step} (memulihkan)`, again);
    }
  }

  /** Getar ringan; hanya hiasan, jadi kegagalannya diabaikan. */
  private buzz() {
    try {
      this.deps.haptic();
    } catch {
      // Tanpa getar.
    }
  }

  /** Inti dilepas: kirim, atau tidak sama sekali kalau terlalu singkat. Tidak pernah melempar. */
  holdEnd = async (): Promise<void> => {
    try {
      await this.endHold();
    } catch (e) {
      this.failHold('lepas Inti', e);
    }
  };

  private async endHold(): Promise<void> {
    this.pressed = false;
    if (this.disposed || this.state.phase !== 'listening') return;
    const epoch = this.epoch;
    this.clearLimit();
    // Mikrofon yang sedang menyala dimatikan setelah selesai menyala.
    await this.starting;
    if (this.disposed || this.state.phase !== 'listening' || epoch !== this.epoch) return;
    this.buzz();
    const heard = this.rawMs();
    this.turnLog.heardMs = heard;
    this.turnLog.rate = this.rawRate || undefined;
    if (heard < MIN_UTTERANCE_MS) {
      // Ketukan atau tahanan singkat: tidak ada yang dikirim ke server.
      this.finishLog('short');
      this.turnId = null;
      this.set({ phase: 'idle', transcript: '', note: SHORT_HOLD_TEXT });
      return;
    }
    // Mikrofon tetap menyala sesaat (`tailing`), lalu ucapan disiapkan dan dikirim.
    const tail = this.deps.tailMs ?? RELEASE_TAIL_MS;
    this.tailing = tail > 0;
    this.deps.onLevel?.(0);
    this.set({ phase: 'sending' });
    if (tail > 0) this.tailTimer = setTimeout(() => this.finishCapture(epoch), tail);
    else this.finishCapture(epoch);
  }

  /** Geser menjauh lalu dilepas: buang ucapan ini, tanpa mengirim apa pun. */
  cancelHold = (): void => {
    this.pressed = false;
    if (this.disposed || this.state.phase !== 'listening') return;
    this.clearLimit();
    this.finishLog('cancelled');
    this.turnId = null;
    this.epoch += 1;
    this.set({ phase: 'idle', transcript: '', note: null });
  };

  /** Rekaman selesai: siapkan (cuplik, pangkas, samakan keras) lalu kirim `start`, `audio`…, `stop`. */
  private finishCapture(epoch: number) {
    this.tailTimer = null;
    this.tailing = false;
    this.stopMic();
    if (this.disposed || epoch !== this.epoch || this.state.phase !== 'sending') return;
    let prepared: ReturnType<typeof prepareUtterance>;
    try {
      prepared = prepareUtterance(resampleTo16k(concatPcm(this.raw), this.rawRate));
    } catch (e) {
      reportError('Mode Suara: menyiapkan ucapan', e);
      prepared = null;
    }
    this.raw = [];
    if (!prepared) {
      this.finishLog('silent');
      this.turnId = null;
      this.set({ phase: 'idle', note: NOT_HEARD_TEXT });
      return;
    }
    Object.assign(this.turnLog, {
      speechMs: prepared.speechMs,
      leadMs: prepared.leadMs,
      trailMs: prepared.trailMs,
      gain: Math.round(prepared.gain * 100) / 100,
    });
    this.turnInput = { kind: 'audio', chunks: encodeChunks(prepared.pcm) };
    this.transmit();
  }

  /** Kirim masukan giliran yang sedang berjalan (lagi, bila soket tadi putus). */
  private transmit() {
    const input = this.turnInput;
    const id = this.turnId;
    if (!input || !id) return;
    const session = this.ensureSession();
    this.turnLog.sentAt = this.now();
    if (input.kind === 'text') {
      session.send({ type: 'text', text: input.text, clientId: id });
      return;
    }
    session.send({ type: 'start', lang: 'id', clientId: id, format: FORMAT });
    input.chunks.forEach((data, seq) => session.send({ type: 'audio', seq, data }));
    session.send({ type: 'stop' });
  }

  /** Lama suara yang terekam (laju HP), ms. */
  private rawMs(): number {
    return this.rawRate > 0 ? Math.round((this.rawSamples / this.rawRate) * 1000) : 0;
  }

  /** Potongan PCM dari mikrofon: disimpan (mono, laju HP) sampai dilepas; levelnya ke gelombang. */
  pushBuffer = (buffer: { data: ArrayBuffer; sampleRate: number; channels: number }) => {
    if (this.disposed || !(this.state.phase === 'listening' || this.tailing)) return;
    let mono = firstChannel(buffer.data, buffer.channels);
    if (mono.length === 0) return;
    const rate = buffer.sampleRate > 0 ? buffer.sampleRate : VOICE_RATE;
    if (this.rawRate === 0) this.rawRate = rate;
    // Laju berganti di tengah ucapan (jarang): potongan ini disamakan dengan yang pertama.
    else if (rate !== this.rawRate) mono = resample(mono, rate, this.rawRate);
    this.raw.push(mono);
    this.rawSamples += mono.length;
    if (this.state.phase === 'listening') {
      this.deps.onLevel?.(level(mono));
      if (this.rawMs() >= VOICE_MAX_UTTERANCE_SEC * 1000) void this.holdEnd();
    }
  };

  // ---- Ketik, bisukan, izin ----

  sendText = (text: string) => {
    const clean = text.trim();
    if (this.disposed || !clean) return;
    this.interrupt();
    const clientId = `suara-${this.now().toString(36)}-${this.epoch}`;
    this.turnId = clientId;
    this.resetTurn(clientId);
    this.turnInput = { kind: 'text', text: clean };
    this.transmit();
    this.set({ phase: 'thinking', transcript: clean, transcriptFinal: true, reply: null, confirm: null, note: null });
  };

  setTyping = (typing: boolean) => this.set({ typing });

  setMuted = (muted: boolean) => {
    this.set({ muted });
    if (!muted) return;
    this.deps.speaker.stop();
    this.clearSpeech();
    if (this.state.phase === 'speaking') this.afterSpeech();
  };

  dismissConfirm = () => this.set({ confirm: null });

  closePermission = () => this.set({ permission: null });

  /** "Izinkan" di lembar penjelasan: munculkan jendela izin sistem. */
  requestPermission = async (): Promise<void> => {
    const result = await (this.deps.requestMic ?? realRequestMic)();
    if (this.disposed) return;
    if (result === 'granted') this.set({ permission: null, note: MIC_ALLOWED_TEXT });
    else this.set({ permission: 'blocked' });
  };

  /** Pengaturan HP dibuka: lembar tetap ada, menunggu pengguna kembali. */
  waitForSettings = () => {
    if (this.state.permission === 'blocked') this.set({ permission: 'waiting' });
  };

  /** Pengguna kembali dari pengaturan HP: kalau izin sudah diberikan lembar ditutup, kalau belum lembar kembali ke arahan. */
  async recheckPermission(): Promise<void> {
    const was = this.state.permission;
    if (was !== 'blocked' && was !== 'waiting') return;
    const granted = (await (this.deps.checkMic ?? realCheckMic)()) === 'granted';
    if (this.disposed) return;
    if (granted) this.set({ permission: null, note: MIC_ALLOWED_TEXT });
    else if (this.state.permission === 'waiting') this.set({ permission: 'blocked' });
  }

  /** Aplikasi ke latar atau layar tertutup sebagian: berhenti merekam dan memutar. Sesi dibiarkan, dibuka lagi bila perlu. */
  suspend() {
    if (this.disposed) return;
    this.pressed = false;
    const busy = this.state.phase !== 'idle' && this.state.phase !== 'off';
    if (busy) this.finishLog('suspended');
    this.interrupt();
    if (busy) this.session?.send({ type: 'cancel' });
    this.deps.onLevel?.(0);
    if (busy) this.set({ phase: 'idle', note: null });
  }

  dispose() {
    if (this.disposed) return;
    this.interrupt();
    this.disposed = true;
    this.session?.close();
    this.session = null;
    this.deps.onLevel?.(0);
  }

  // ---- Dalaman ----

  /**
   * Hentikan rekaman dan suara balasan yang sedang berjalan; server diminta berhenti kalau sedang menjawab. Mikrofon
   * dimatikan di fase apa pun.
   */
  private interrupt() {
    const phase = this.state.phase;
    this.clearLimit();
    this.clearTail();
    this.clearTurnTimers();
    this.clearSpeech();
    this.deps.speaker.stop();
    this.stopMic();
    if (['listening', 'sending', 'thinking', 'speaking'].includes(phase)) this.session?.send({ type: 'cancel' });
    this.turnId = null;
    this.turnInput = null;
    this.raw = [];
    this.epoch += 1;
  }

  /** Matikan mikrofon sekali. Kalau masih menyala, dimatikan begitu selesai menyala. */
  private stopMic() {
    if (!this.micOn) return;
    if (this.micPending) {
      this.micStopWanted = true;
      return;
    }
    this.micOn = false;
    try {
      this.deps.mic.stop();
    } catch {
      // Mikrofon sudah berhenti.
    }
  }

  private releaseMic() {
    this.clearLimit();
    this.clearTail();
    this.stopMic();
    this.deps.onLevel?.(0);
  }

  private clearLimit() {
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.limitTimer = null;
  }

  private clearTail() {
    if (this.tailTimer) clearTimeout(this.tailTimer);
    this.tailTimer = null;
    this.tailing = false;
  }

  private clearTurnTimers() {
    if (this.slowTimer) clearTimeout(this.slowTimer);
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.slowTimer = null;
    this.turnTimer = null;
  }

  /** Mulai menunggu jawaban: "Masih saya kerjakan…" setelah 8 detik, berhenti menunggu setelah 95 detik tanpa kabar. */
  private startTurnTimers() {
    this.clearTurnTimers();
    this.slowTimer = setTimeout(() => {
      this.slowTimer = null;
      if (isWaiting(this.state.phase)) this.set({ slow: true });
    }, SLOW_TURN_MS);
    this.armGiveUp();
  }

  private armGiveUp() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (!isWaiting(this.state.phase)) return;
      // Tidak membatalkan di server: agennya tetap bekerja dan balasannya masuk chat. Giliran tetap didengar, jadi
      // balasan yang terlambat masih tampil di sini.
      this.finishLog('late', false);
      this.set({ phase: 'idle', note: LATE_TEXT });
    }, TURN_TIMEOUT_MS);
  }

  /** Kabar dari server untuk giliran yang ditunggu: batas tunggu dimulai lagi. */
  private touchTurn() {
    this.turnLog.firstAt ??= this.now();
    if (isWaiting(this.state.phase)) this.armGiveUp();
  }

  /** Catatan giliran (hanya pengembangan): sekali per giliran. */
  private finishLog(outcome: string, end = true) {
    const log = this.deps.log;
    const entry = this.turnLog;
    if (!entry.turn) return;
    if (end) this.turnLog = { turn: '' };
    if (!log) return;
    const { sentAt, firstAt, ...rest } = entry;
    const at = this.now();
    try {
      log({
        ...rest,
        outcome,
        ...(sentAt !== undefined && firstAt !== undefined ? { firstEventMs: firstAt - sentAt } : null),
        ...(sentAt !== undefined ? { totalMs: at - sentAt } : null),
        ...(this.retried ? { retried: true } : null),
      });
    } catch {
      // Log hanya bantuan pengembangan.
    }
  }

  /** Buang suara balasan: pengatur waktu, potongan yang terkumpul, klip yang diantre, dan berkasnya. */
  private clearSpeech() {
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
    this.speechTimer = null;
    this.gatherTimer = null;
    this.speech = null;
    this.playing = 0;
    this.fetching = 0;
    this.dropFiles();
  }

  private dropFiles() {
    for (const uri of this.fileUris) removeSpeechFile(uri);
    this.fileUris.clear();
  }

  private onClose(session: VoiceSession, reason: VoiceCloseReason) {
    if (this.disposed || session !== this.session) return;
    this.session = null;
    const phase = this.state.phase;
    // Masih menahan (atau sisa rekaman): belum ada yang dikirim; sesi baru dibuka saat dilepas.
    if (phase === 'listening' || this.tailing) return;
    const dropped = reason === 'network' || reason === 'idle' || reason === 'ended';
    // Menunggu jawaban giliran yang belum dibalas.
    const waiting = isWaiting(phase) && this.turnId !== null && !this.replied;
    if (waiting && dropped) {
      if (!this.retried && this.turnInput) {
        // Putus di tengah giliran: kirim ulang sekali di soket baru dengan id giliran yang sama. Server mengambil giliran
        // yang sudah berjalan (tidak menjalankannya dua kali) dan jawabannya tetap datang di sini, bukan di chat. Server
        // lama membalas `sudah_ada`: kabar "nanti saya kabari di chat".
        this.retried = true;
        this.transmit();
        return;
      }
      if (this.acked) {
        // Server sudah menerima ucapannya; agen tetap bekerja dan balasannya masuk chat.
        this.finishLog('in_chat');
        this.turnId = null;
        this.epoch += 1;
        this.set({ phase: 'idle', note: IN_CHAT_TEXT });
        return;
      }
    }
    this.clearLimit();
    // Selesai dengan tenang: sesi diakhiri atau lama diam, atau putus setelah balasan sampai. Yang sedang diucapkan
    // dibiarkan sampai habis; yang terkumpul tapi belum diputar diputar sekarang. Sesi baru dibuka saat Inti ditahan lagi.
    const calm =
      !waiting &&
      (reason === 'ended' ||
        reason === 'idle' ||
        (reason === 'network' && (phase === 'speaking' || this.state.reply !== null)));
    if (calm) {
      this.turnId = null;
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = null;
      if (this.speech) this.playGathered();
      this.stopMic();
      this.deps.onLevel?.(0);
      const speaking = this.state.phase === 'speaking' && (this.playing > 0 || this.fetching > 0);
      if (!speaking) this.set({ phase: 'idle' });
      return;
    }
    if (waiting) this.finishLog(reason === 'network' ? 'offline' : reason);
    this.turnId = null;
    this.epoch += 1;
    this.clearSpeech();
    this.deps.speaker.stop();
    this.stopMic();
    this.deps.onLevel?.(0);
    if (reason === 'unauthorized') this.set({ phase: 'off', note: SIGNED_OUT_TEXT });
    else if (reason === 'unavailable') this.set({ phase: 'off', note: VOICE_SOON_TEXT });
    else this.set({ phase: 'off', note: OFFLINE_TEXT });
  }

  private onEvent(session: VoiceSession, event: VoiceEvent) {
    if (this.disposed || session !== this.session) return;
    if (event.type === 'ping') return;
    // Giliran yang sudah dibatalkan: tidak ada yang boleh mengubah layar.
    if (event.turn !== undefined && event.turn !== this.turnId) return;
    const phase = this.state.phase;
    // Sedang menahan Inti (atau sisa rekaman): ucapan ini belum dikirim, jadi hanya teks sementara yang berarti; sisanya
    // (balasan, suara, kartu, berpikir, kendala) milik giliran lama dan tidak boleh memutus rekaman.
    if ((phase === 'listening' || this.tailing) && !(event.type === 'transcript' && !event.final)) return;
    if (event.type !== 'end') this.touchTurn();
    switch (event.type) {
      case 'transcript':
        if (event.final) this.acked = true;
        this.set({ transcript: event.text, transcriptFinal: event.final });
        return;
      case 'thinking':
        // Juga kabar tetap hidup (server mengulang `thinking on` selama agen bekerja).
        this.serverThinking = event.on && this.turnId !== null;
        if (event.on) {
          this.acked = true;
          if (phase !== 'speaking') this.set({ phase: 'thinking' });
        } else if (phase === 'thinking') {
          this.set({ phase: 'idle' });
        }
        return;
      case 'reply':
        this.replied = true;
        this.onReply(event.text, event.messageId);
        return;
      case 'audio':
        this.onAudio(event);
        return;
      case 'speech':
        void this.onSpeech(event.mediaId);
        return;
      case 'confirm':
        this.replied = true;
        this.set({ confirm: { card: event.card, messageId: event.messageId } });
        return;
      case 'error': {
        if (event.code === 'kartu_tidak_dikenal') {
          // Balasannya tetap diucapkan; kartunya saja yang tidak bisa tampil di sini.
          this.set({ note: CARD_UNREADABLE_TEXT, ...(isWaiting(phase) ? { phase: 'idle' as const } : null) });
          return;
        }
        this.finishLog(event.code);
        this.clearSpeech();
        this.deps.speaker.stop();
        this.turnId = null;
        this.set(errorNote(event.code));
        return;
      }
      case 'end':
        // Penutupan sesi ditangani `onClose`; "cancelled" hanya pengakuan atas `cancel`.
        return;
    }
  }

  /**
   * Balasan. Tanpa `messageId` = kalimat pengisi dari server ("Masih saya kerjakan, sebentar ya.") sementara agen masih
   * bekerja: setelah diucapkan, kembali berpikir (lihat {@link afterSpeech}).
   */
  private onReply(text: string, messageId?: string) {
    this.finishLog(messageId ? 'reply' : 'filler', !!messageId);
    // Suara yang terkumpul milik balasan sebelumnya (kalimat pengisi): putar dulu, berurutan.
    if (this.speech) this.playGathered();
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    if (this.state.muted) {
      this.set({ reply: text, note: null });
      this.afterSpeech();
      return;
    }
    this.set({ reply: text, phase: 'speaking', note: null });
    this.speechTimer = setTimeout(() => {
      this.speechTimer = null;
      if (this.state.phase === 'speaking' && this.playing === 0 && this.fetching === 0 && !this.speech) {
        this.afterSpeech();
      }
    }, SPEECH_WAIT_MS);
  }

  /** Balasan selesai diucapkan: siap lagi, atau kembali berpikir bila server masih bekerja untuk giliran ini. */
  private afterSpeech() {
    if (this.serverThinking && this.turnId !== null) this.set({ phase: 'thinking', slow: true });
    else this.set({ phase: 'idle' });
  }

  private onAudio(event: Extract<VoiceEvent, { type: 'audio' }>) {
    if (this.state.muted) return;
    const speech = (this.speech ??= { chunks: [], mime: event.mime });
    if (event.data) speech.chunks.push(event.data);
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
    this.gatherTimer = null;
    if (event.final) return this.playGathered();
    this.gatherTimer = setTimeout(() => {
      this.gatherTimer = null;
      this.playGathered();
    }, SPEECH_GATHER_MS);
  }

  private playGathered() {
    const speech = this.speech;
    this.speech = null;
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
    this.gatherTimer = null;
    if (!speech || speech.chunks.length === 0 || this.state.muted) return;
    try {
      const uri = writeSpeechFile(speech.chunks, speech.mime, `balasan-${++this.files}`);
      this.fileUris.add(uri);
      this.playSource({ uri }, uri);
    } catch {
      // Suaranya gagal disiapkan; tulisannya sudah tampil.
      if (this.state.phase === 'speaking' && this.playing === 0) this.afterSpeech();
    }
  }

  private async onSpeech(mediaId: string) {
    if (this.state.muted) return;
    const epoch = this.epoch;
    this.fetching += 1;
    try {
      const source = await this.deps.transport.mediaUrl(mediaId);
      // Selesai diambil, apa pun hasilnya: hitungan ambilan turun dulu supaya fase bicara tidak menggantung.
      if (epoch === this.epoch && this.fetching > 0) this.fetching -= 1;
      if (this.disposed || epoch !== this.epoch) return;
      if (this.state.muted || source.kind !== 'uri') {
        if (this.state.phase === 'speaking' && this.playing === 0 && this.fetching === 0 && !this.speech) {
          this.afterSpeech();
        }
        return;
      }
      this.playSource({ uri: source.uri, headers: source.headers });
    } catch {
      if (epoch === this.epoch && this.fetching > 0) this.fetching -= 1;
      if (epoch === this.epoch && this.state.phase === 'speaking' && this.playing === 0 && !this.speech) {
        this.afterSpeech();
      }
    }
  }

  /** Antre satu klip di pemutar (berurutan dengan klip sebelumnya); `file` = berkas sementara yang dihapus setelahnya. */
  private playSource(source: SpeechSource, file?: string) {
    if (this.disposed) return;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    this.playing += 1;
    const epoch = this.epoch;
    this.set({ phase: 'speaking' });
    this.deps.speaker.play(source, () => {
      if (file) {
        removeSpeechFile(file);
        this.fileUris.delete(file);
      }
      if (this.disposed || epoch !== this.epoch) return;
      if (this.playing > 0) this.playing -= 1;
      if (this.playing === 0 && this.fetching === 0 && !this.speech && this.state.phase === 'speaking') {
        this.afterSpeech();
      }
    });
  }
}
