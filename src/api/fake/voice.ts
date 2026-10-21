import type { Card, VoiceClientMessage } from '../contract';
import { silentWav, toBase64 } from '@/voice/pcm';
import { VOICE_SAMPLE_REPLY_MS } from '@/sample/voice';
import type { VoiceChannel } from '../voiceSession';

/** Hasil satu giliran bicara di server tiruan. */
export interface FakeVoiceTurn {
  replyText: string;
  messageId: string;
  /** Kartu yang perlu ketukan (pembayaran, draf pesan), dengan pesan di utas yang memuatnya. */
  confirm?: { card: Card; messageId: string };
}

/** Yang dibutuhkan skenario suara dari server tiruan. */
export interface FakeVoiceHost {
  later(ms: number, run: () => void): ReturnType<typeof setTimeout>;
  cancel(timer: ReturnType<typeof setTimeout> | null): void;
  thinkMs: number;
  /** Kalimat yang "didengar" untuk ucapan berikutnya (daftar contoh, berputar per server tiruan). */
  nextSentence(): string;
  /** Boleh dibuka? Jaringan putus atau sesi dicabut menutup soket suara. */
  availability(): Promise<'ok' | 'network' | 'unauthorized'>;
  /** Simpan ucapan dan balasannya di utas chat (bertanda suara) dan jalankan perintahnya. */
  turn(spoken: string): FakeVoiceTurn;
}

/**
 * Skrip Mode Suara server tiruan: potongan audio menampilkan teks ucapan sedikit demi sedikit, `stop` memberi teks akhir,
 * berpikir, balasan (juga masuk chat), suara balasan (hening), dan kartu konfirmasi untuk "bayar", "token", "kirim ke".
 */
export function attachFakeVoice(channel: VoiceChannel, host: FakeVoiceHost) {
  let sentence = '';
  let chunks = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let shown = '';

  const cancel = () => {
    host.cancel(timer);
    timer = null;
  };

  const answer = (spoken: string) => {
    cancel();
    channel.receive({ type: 'transcript', text: spoken, final: true });
    channel.receive({ type: 'thinking', on: true });
    timer = host.later(host.thinkMs, () => {
      timer = null;
      const turn = host.turn(spoken);
      channel.receive({ type: 'thinking', on: false });
      channel.receive({ type: 'reply', text: turn.replyText, messageId: turn.messageId });
      if (turn.confirm) channel.receive({ type: 'confirm', ...turn.confirm });
      channel.receive({
        type: 'audio',
        seq: 0,
        data: toBase64(silentWav(VOICE_SAMPLE_REPLY_MS)),
        mime: 'audio/wav',
        final: true,
      });
    });
  };

  channel.transmit = (message: VoiceClientMessage) => {
    switch (message.type) {
      case 'start':
        cancel();
        sentence = host.nextSentence();
        chunks = 0;
        shown = '';
        return;
      case 'audio': {
        chunks += 1;
        const words = sentence.split(' ');
        const count = Math.min(words.length - 1, Math.floor(chunks / 3) + 1);
        const partial = words.slice(0, Math.max(1, count)).join(' ');
        if (words.length > 1 && partial !== shown) {
          shown = partial;
          channel.receive({ type: 'transcript', text: partial, final: false });
        }
        return;
      }
      case 'stop':
        if (chunks === 0) return;
        answer(sentence);
        return;
      case 'text':
        answer(message.text);
        return;
      case 'cancel':
        cancel();
        return;
    }
  };
  channel.onLocalClose = cancel;

  void host.availability().then((state) => {
    if (channel.closed) return;
    if (state === 'ok') channel.opened();
    else channel.finish(state);
  });
}
