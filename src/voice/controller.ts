import { ERROR_TEXT } from '@/api/errors';
import type { Card, VoiceEvent } from '@/api/contract';
import { VOICE_MAX_UTTERANCE_SEC } from '@/api/contract';
import type { Transport, VoiceCloseReason, VoiceSession } from '@/api/transport';
import { checkMic as realCheckMic, removeSpeechFile, requestMic as realRequestMic, writeSpeechFile } from './audio';
import { reportError } from '@/crash';
import { VOICE_SOON_TEXT } from './texts';
import type { MicPermission, Speaker, SpeechSource } from './audio';
import { level, pcmBytes, pcmMs, toBase64, toVoiceFormat } from './pcm';

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
  /** Satu kalimat di bawah Inti (petunjuk, kendala, tidak tersambung). */
  note: string | null;
}

export const HINT_HOLD = 'Tahan Inti sambil bicara';
export const OFFLINE_TEXT = 'Belum tersambung. Coba lagi sebentar ya.';
export const SIGNED_OUT_TEXT = 'Sesi Anda berakhir. Masuk lagi ya.';
export const MIC_FAILED_TEXT = 'Mikrofon belum bisa dipakai. Coba lagi sebentar ya.';
export const CARD_UNREADABLE_TEXT = 'Permintaan konfirmasi belum bisa ditampilkan di sini. Lanjutkan di chat ya.';
export const MIC_ALLOWED_TEXT = 'Mikrofon sudah boleh dipakai. Tahan Inti sambil bicara.';
export const NOT_HEARD_TEXT = 'Belum terdengar, coba lagi ya.';
export const TURN_TIMEOUT_TEXT = 'Lama sekali, coba lagi ya.';

/** Ucapan lebih pendek dari ini dianggap ketukan biasa, bukan bicara. */
export const MIN_UTTERANCE_MS = 400;
/** Balasan sudah tampil tapi suaranya tidak kunjung datang: kembali siap. */
export const SPEECH_WAIT_MS = 6000;
/** Potongan balasan tanpa tanda terakhir: putar setelah sepi sekian lama. */
export const SPEECH_GATHER_MS = 1200;
/** Setelah ucapan terkirim, balasan (atau kendala) harus datang secepat ini. */
export const TURN_TIMEOUT_MS = 25_000;

const FORMAT = { codec: 'pcm16', sampleRate: 16000, channels: 1 } as const;

export interface VoiceMic {
  start(): Promise<void>;
  stop(): void;
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
};

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
  private seq = 0;
  private chunks = 0;
  private samples = 0;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
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

  /**
   * Satu-satunya tempat keadaan berubah. Meninggalkan `listening` (oleh sebab apa pun) mematikan mikrofon, mereset
   * cincin, dan membatalkan batas 30 detik; masuk ke `sending`/`thinking` memulai batas tunggu balasan.
   */
  private set(patch: Partial<VoiceState>) {
    if (this.disposed) return;
    const prev = this.state.phase;
    const next = patch.phase ?? prev;
    if (prev === 'listening' && next !== 'listening') this.releaseMic();
    this.state = { ...this.state, ...patch };
    const waiting = (p: VoicePhase) => p === 'sending' || p === 'thinking';
    if (waiting(next) && !waiting(prev)) this.startTurnTimer();
    else if (!waiting(next)) this.clearTurnTimer();
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
      this.set({ note: HINT_HOLD });
      return;
    }
    this.interrupt();
    const epoch = this.epoch;
    const clientId = `suara-${Date.now().toString(36)}-${epoch}`;
    this.turnId = clientId;
    this.seq = 0;
    this.chunks = 0;
    this.samples = 0;
    const session = this.ensureSession();
    session.send({ type: 'start', lang: 'id', clientId, format: FORMAT });
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
        this.session?.send({ type: 'cancel' });
        this.turnId = null;
        this.set({ phase: 'error', note: MIC_FAILED_TEXT });
      },
    );
  }

  /** Kendala tak terduga saat menahan atau melepas Inti: mikrofon mati, giliran batal, kabar ramah. */
  private failHold(step: string, e: unknown) {
    reportError(`Mode Suara: ${step}`, e);
    this.pressed = false;
    try {
      this.clearLimit();
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

  /** Inti dilepas: kirim, atau batal kalau terlalu singkat. Tidak pernah melempar. */
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
    if (this.chunks === 0 || pcmMs(this.samples) < MIN_UTTERANCE_MS) {
      this.turnId = null;
      this.set({ phase: 'idle', transcript: '', note: HINT_HOLD });
      this.session?.send({ type: 'cancel' });
      return;
    }
    // Keadaan lebih dulu (ini yang mematikan mikrofon), baru `stop` ke server.
    this.set({ phase: 'sending' });
    this.session?.send({ type: 'stop' });
  }

  /** Potongan PCM dari mikrofon. */
  pushBuffer = (buffer: { data: ArrayBuffer; sampleRate: number; channels: number }) => {
    if (this.disposed || this.state.phase !== 'listening') return;
    const pcm = toVoiceFormat(buffer.data, buffer.sampleRate, buffer.channels);
    if (pcm.length === 0) return;
    this.chunks += 1;
    this.samples += pcm.length;
    this.deps.onLevel?.(level(pcm));
    this.session?.send({ type: 'audio', seq: this.seq++, data: toBase64(pcmBytes(pcm)) });
    if (pcmMs(this.samples) >= VOICE_MAX_UTTERANCE_SEC * 1000) void this.holdEnd();
  };

  // ---- Ketik, bisukan, izin ----

  sendText = (text: string) => {
    const clean = text.trim();
    if (this.disposed || !clean) return;
    this.interrupt();
    const clientId = `suara-${Date.now().toString(36)}-${this.epoch}`;
    this.turnId = clientId;
    this.ensureSession().send({ type: 'text', text: clean, clientId });
    this.set({ phase: 'thinking', transcript: clean, transcriptFinal: true, reply: null, confirm: null, note: null });
  };

  setTyping = (typing: boolean) => this.set({ typing });

  setMuted = (muted: boolean) => {
    this.set({ muted });
    if (!muted) return;
    this.deps.speaker.stop();
    this.clearSpeech();
    if (this.state.phase === 'speaking') this.set({ phase: 'idle' });
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
   * Hentikan rekaman dan suara balasan yang sedang berjalan; server diminta berhenti kalau sedang mendengar atau menjawab.
   * Mikrofon dimatikan di fase apa pun.
   */
  private interrupt() {
    const phase = this.state.phase;
    this.clearLimit();
    this.clearTurnTimer();
    this.clearSpeech();
    this.deps.speaker.stop();
    this.stopMic();
    if (['listening', 'sending', 'thinking', 'speaking'].includes(phase)) this.session?.send({ type: 'cancel' });
    this.turnId = null;
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
    this.stopMic();
    this.deps.onLevel?.(0);
  }

  private clearLimit() {
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.limitTimer = null;
  }

  private clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  /** Ucapan terkirim tapi balasan tidak kunjung datang: kendala yang jelas, bukan berpikir selamanya. */
  private startTurnTimer() {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      const phase = this.state.phase;
      if (phase !== 'sending' && phase !== 'thinking') return;
      this.session?.send({ type: 'cancel' });
      this.turnId = null;
      this.epoch += 1;
      this.set({ phase: 'error', note: TURN_TIMEOUT_TEXT });
    }, TURN_TIMEOUT_MS);
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
    this.clearLimit();
    this.turnId = null;
    const graceful = reason === 'ended' || reason === 'idle';
    if (graceful) {
      // Selesai: yang sedang diucapkan dibiarkan sampai habis; yang terkumpul tapi belum diputar diputar sekarang.
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = null;
      if (this.speech) this.playGathered();
      this.stopMic();
      this.deps.onLevel?.(0);
      const speaking = this.state.phase === 'speaking' && (this.playing > 0 || this.fetching > 0);
      if (!speaking) this.set({ phase: 'idle', note: null });
      return;
    }
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
    // Sedang menahan Inti: hanya teks sementara dari giliran ini yang berarti; sisanya milik giliran lama.
    if (phase === 'listening') {
      if (event.type === 'transcript' && event.final) return;
      if (['reply', 'audio', 'speech', 'confirm'].includes(event.type)) return;
    }
    switch (event.type) {
      case 'transcript':
        this.set({ transcript: event.text, transcriptFinal: event.final });
        return;
      case 'thinking':
        if (event.on) {
          // Server menentukan sendiri ucapan selesai (deteksi hening): mikrofon dimatikan lewat `set`.
          this.set({ phase: 'thinking' });
        } else if (phase === 'thinking') {
          this.set({ phase: 'idle' });
        }
        return;
      case 'reply':
        this.onReply(event.text);
        return;
      case 'audio':
        this.onAudio(event);
        return;
      case 'speech':
        void this.onSpeech(event.mediaId);
        return;
      case 'confirm':
        this.set({ confirm: { card: event.card, messageId: event.messageId } });
        return;
      case 'error':
        this.clearSpeech();
        this.deps.speaker.stop();
        this.turnId = null;
        if (event.code === 'kartu_tidak_dikenal') this.set({ phase: 'idle', note: CARD_UNREADABLE_TEXT });
        else if (event.code === 'tidak_terdengar') this.set({ phase: 'idle', note: NOT_HEARD_TEXT });
        else this.set({ phase: 'error', note: ERROR_TEXT });
        return;
      case 'end':
        // Penutupan sesi ditangani `onClose`; "cancelled" hanya pengakuan atas `cancel`.
        return;
    }
  }

  private onReply(text: string) {
    // Suara yang terkumpul milik balasan sebelumnya (kalimat pengisi): putar dulu, berurutan.
    if (this.speech) this.playGathered();
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    if (this.state.muted) {
      this.set({ reply: text, phase: 'idle' });
      return;
    }
    this.set({ reply: text, phase: 'speaking' });
    this.speechTimer = setTimeout(() => {
      this.speechTimer = null;
      if (this.state.phase === 'speaking' && this.playing === 0 && this.fetching === 0 && !this.speech) {
        this.set({ phase: 'idle' });
      }
    }, SPEECH_WAIT_MS);
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
      if (this.state.phase === 'speaking' && this.playing === 0) this.set({ phase: 'idle' });
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
          this.set({ phase: 'idle' });
        }
        return;
      }
      this.playSource({ uri: source.uri, headers: source.headers });
    } catch {
      if (epoch === this.epoch && this.fetching > 0) this.fetching -= 1;
      if (epoch === this.epoch && this.state.phase === 'speaking' && this.playing === 0 && !this.speech) {
        this.set({ phase: 'idle' });
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
        this.set({ phase: 'idle' });
      }
    });
  }
}
