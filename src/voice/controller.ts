import { ERROR_TEXT } from '@/api/errors';
import type { Card, VoiceEvent } from '@/api/contract';
import { VOICE_MAX_UTTERANCE_SEC } from '@/api/contract';
import type { Transport, VoiceCloseReason, VoiceSession } from '@/api/transport';
import { checkMic as realCheckMic, requestMic as realRequestMic, writeSpeechFile } from './audio';
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
  /** Lembar izin mikrofon: penjelasan sebelum menanyakan, atau arahan ke pengaturan HP. */
  permission: 'explain' | 'blocked' | null;
  /** Satu kalimat di bawah Inti (petunjuk, kendala, tidak tersambung). */
  note: string | null;
}

export const HINT_HOLD = 'Tahan Inti sambil bicara';
export const OFFLINE_TEXT = 'Belum tersambung. Coba lagi sebentar ya.';
export const SIGNED_OUT_TEXT = 'Sesi Anda berakhir. Masuk lagi ya.';
export const MIC_FAILED_TEXT = 'Mikrofon belum bisa dipakai. Coba lagi sebentar ya.';
export const CARD_UNREADABLE_TEXT = 'Permintaan konfirmasi belum bisa ditampilkan di sini. Lanjutkan di chat ya.';
export const MIC_ALLOWED_TEXT = 'Mikrofon sudah boleh dipakai. Tahan Inti sambil bicara.';

/** Ucapan lebih pendek dari ini dianggap ketukan biasa, bukan bicara. */
export const MIN_UTTERANCE_MS = 400;
/** Balasan sudah tampil tapi suaranya tidak kunjung datang: kembali siap. */
export const SPEECH_WAIT_MS = 6000;
/** Potongan balasan tanpa tanda terakhir: putar setelah sepi sekian lama. */
export const SPEECH_GATHER_MS = 1200;

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
  private turn = 0;
  private pressed = false;
  private starting: Promise<void> | null = null;
  private seq = 0;
  private chunks = 0;
  private samples = 0;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  private gatherTimer: ReturnType<typeof setTimeout> | null = null;
  private speech: { chunks: string[]; mime: string } | null = null;
  private files = 0;

  constructor(private readonly deps: VoiceDeps) {}

  getState = (): VoiceState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<VoiceState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
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

  /** Inti ditekan. Menyela balasan yang sedang berjalan (barge-in). */
  holdStart = async (): Promise<void> => {
    if (this.disposed || this.pressed || this.state.permission) return;
    this.pressed = true;
    const check = this.deps.checkMic ?? realCheckMic;
    const permission = await check();
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
    const turn = ++this.turn;
    this.seq = 0;
    this.chunks = 0;
    this.samples = 0;
    const session = this.ensureSession();
    session.send({ type: 'start', lang: 'id', clientId: `suara-${Date.now().toString(36)}-${turn}`, format: FORMAT });
    this.set({
      phase: 'listening',
      transcript: '',
      transcriptFinal: false,
      reply: null,
      confirm: null,
      note: null,
    });
    this.deps.haptic();
    this.limitTimer = setTimeout(() => void this.holdEnd(), VOICE_MAX_UTTERANCE_SEC * 1000);
    this.starting = this.deps.mic.start().then(
      () => undefined,
      () => {
        if (this.disposed || turn !== this.turn) return;
        this.clearLimit();
        this.session?.send({ type: 'cancel' });
        this.deps.onLevel?.(0);
        this.set({ phase: 'error', note: MIC_FAILED_TEXT });
      },
    );
  };

  /** Inti dilepas: kirim, atau batal kalau terlalu singkat. */
  holdEnd = async (): Promise<void> => {
    this.pressed = false;
    if (this.disposed || this.state.phase !== 'listening') return;
    this.clearLimit();
    // Mikrofon yang sedang menyala dimatikan setelah selesai menyala.
    await this.starting;
    if (this.disposed || this.state.phase !== 'listening') return;
    this.deps.mic.stop();
    this.deps.onLevel?.(0);
    this.deps.haptic();
    if (this.chunks === 0 || pcmMs(this.samples) < MIN_UTTERANCE_MS) {
      this.session?.send({ type: 'cancel' });
      this.set({ phase: 'idle', transcript: '', note: HINT_HOLD });
      return;
    }
    this.session?.send({ type: 'stop' });
    this.set({ phase: 'sending' });
  };

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
    this.ensureSession().send({ type: 'text', text: clean });
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

  /** Pengguna kembali dari pengaturan HP dan izin sudah diberikan. */
  async recheckPermission(): Promise<void> {
    if (this.state.permission !== 'blocked') return;
    if ((await (this.deps.checkMic ?? realCheckMic)()) === 'granted' && !this.disposed) {
      this.set({ permission: null, note: MIC_ALLOWED_TEXT });
    }
  }

  /** Aplikasi ke latar: berhenti merekam dan memutar. Sesi dibiarkan, dibuka lagi bila perlu. */
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

  /** Hentikan rekaman dan suara balasan yang sedang berjalan; server diminta berhenti kalau sedang menjawab. */
  private interrupt() {
    this.clearLimit();
    this.clearSpeech();
    this.deps.speaker.stop();
    if (this.state.phase === 'listening') {
      this.deps.mic.stop();
      this.session?.send({ type: 'cancel' });
    } else if (['sending', 'thinking', 'speaking'].includes(this.state.phase)) {
      this.session?.send({ type: 'cancel' });
    }
    this.turn += 1;
  }

  private clearLimit() {
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.limitTimer = null;
  }

  private clearSpeech() {
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
    this.speechTimer = null;
    this.gatherTimer = null;
    this.speech = null;
  }

  private onClose(session: VoiceSession, reason: VoiceCloseReason) {
    if (this.disposed || session !== this.session) return;
    this.session = null;
    this.clearSpeech();
    this.clearLimit();
    this.deps.speaker.stop();
    if (this.state.phase === 'listening') this.deps.mic.stop();
    this.deps.onLevel?.(0);
    this.turn += 1;
    if (reason === 'unauthorized') this.set({ phase: 'off', note: SIGNED_OUT_TEXT });
    else if (reason === 'network') this.set({ phase: 'off', note: OFFLINE_TEXT });
    // Selesai atau diam terlalu lama: siap bicara lagi, sesi dibuka saat Inti ditahan.
    else this.set({ phase: 'idle', note: null });
  }

  private onEvent(session: VoiceSession, event: VoiceEvent) {
    if (this.disposed || session !== this.session) return;
    switch (event.type) {
      case 'transcript':
        this.set({ transcript: event.text, transcriptFinal: event.final });
        return;
      case 'thinking':
        if (event.on) {
          // Server menentukan sendiri ucapan selesai (deteksi hening): mikrofon dimatikan.
          if (this.state.phase === 'listening') {
            this.clearLimit();
            this.deps.mic.stop();
            this.deps.onLevel?.(0);
          }
          this.set({ phase: 'thinking' });
        } else if (this.state.phase === 'thinking') {
          this.set({ phase: 'idle' });
        }
        return;
      case 'reply':
        if (this.state.muted) {
          this.set({ reply: event.text, phase: 'idle' });
          return;
        }
        this.set({ reply: event.text, phase: 'speaking' });
        this.speechTimer = setTimeout(() => {
          this.speechTimer = null;
          if (this.state.phase === 'speaking') this.set({ phase: 'idle' });
        }, SPEECH_WAIT_MS);
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
        if (event.code === 'kartu_tidak_dikenal') this.set({ phase: 'idle', note: CARD_UNREADABLE_TEXT });
        else this.set({ phase: 'error', note: ERROR_TEXT });
        return;
      case 'end':
      case 'ping':
        return;
    }
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
    if (!speech || speech.chunks.length === 0 || this.state.muted) return;
    try {
      const uri = writeSpeechFile(speech.chunks, speech.mime, `balasan-${++this.files}`);
      this.playSource({ uri });
    } catch {
      // Suaranya gagal disiapkan; tulisannya sudah tampil.
      if (this.state.phase === 'speaking') this.set({ phase: 'idle' });
    }
  }

  private async onSpeech(mediaId: string) {
    if (this.state.muted) return;
    const turn = this.turn;
    try {
      const source = await this.deps.transport.mediaUrl(mediaId);
      if (this.disposed || turn !== this.turn || this.state.muted || source.kind !== 'uri') return;
      this.playSource({ uri: source.uri, headers: source.headers });
    } catch {
      if (this.state.phase === 'speaking') this.set({ phase: 'idle' });
    }
  }

  private playSource(source: SpeechSource) {
    if (this.disposed) return;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    this.set({ phase: 'speaking' });
    this.deps.speaker.play(source, () => {
      if (!this.disposed && this.state.phase === 'speaking') this.set({ phase: 'idle' });
    });
  }
}
