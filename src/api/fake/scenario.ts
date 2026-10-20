import { DEFAULT_ASSISTANT } from '@/brand';
import { draftIntro } from '@/sample/chat';
import { initialDevices, MAIN_AC_ID } from '@/sample/devices';
import { user } from '@/sample/profile';
import type { Draft, Me, Part } from '../contract';
import type { FakeClock } from './clock';
import { acCard, paymentParts, qrisCard } from './history';

/** Batas bayar QRIS contoh, dalam menit dari sekarang (seperti 10.00 → 10.15 di utas contoh). */
export const QRIS_MINUTES = 15;
/** Jawaban untuk pesan yang tidak memicu kartu apa pun. */
export const SAMPLE_REPLY = 'Ini jawaban contoh. Begitu tersambung ke server, saya menjawab sungguhan.';
export const ASK_REPLY_TO = 'Mau dibalas ke siapa, dan isinya apa?';
export const PAYMENT_CANCELLED = 'Baik, tidak jadi saya beli.';
const DEFAULT_TOKEN_RP = 100_000;

/** Pengguna server tiruan: pengguna contoh 0b dengan asisten bawaan. */
export function sampleMe(clock: FakeClock): Me {
  return {
    id: 'contoh',
    name: user.name,
    assistantName: DEFAULT_ASSISTANT,
    plan: { name: 'Bisnis', activeUntil: clock.iso(30 * 24 * 60) },
    phone: '6281220457781',
  };
}

/** Balasan asisten: tiap isi `messages` adalah satu pesan. Draf baru ikut dikembalikan supaya transport mencatatnya. */
export interface Reply {
  messages: Part[][];
  drafts: Draft[];
  /** Permintaan pengguna mengubah AC menjadi ini (tidak ada untuk jawaban yang hanya melaporkan keadaan). */
  acChange?: AcState;
}

/** Keadaan AC kamar yang dibaca skenario. */
export interface AcState {
  on: boolean;
  temp: number;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase());
const sentence = (s: string) => {
  const t = capitalize(s.trim());
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/** "Balas Pak Budi, harga sewa bisa Rp15 juta" → penerima dan isi. `null` kalau bukan permintaan membalas. */
export function parseReplyRequest(text: string): { to: string | null; content: string } | null {
  const m = /^\s*balas(?:kan)?(?:\s+(?:ke\s+)?(.*))?$/is.exec(text);
  if (!m) return null;
  const rest = (m[1] ?? '').trim();
  if (!rest) return { to: null, content: '' };
  const sep = rest.search(/[,:]/);
  const to = (sep < 0 ? rest : rest.slice(0, sep)).trim();
  return { to: to ? titleCase(to) : null, content: sep < 0 ? '' : rest.slice(sep + 1).trim() };
}

/** Rupiah dari tulisan seperti "100 ribu", "50rb", "Rp200.000", "1 juta". */
export function parseRupiah(text: string): number | null {
  const m = /(\d[\d.]*)\s*(?:(ribu|rb|k|juta|jt)\b)?/i.exec(text);
  if (!m) return null;
  const unit = m[2]?.toLowerCase();
  const n = Number(m[1]!.replace(/\./g, '')) * (unit === 'juta' || unit === 'jt' ? 1_000_000 : unit ? 1000 : 1);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Suhu AC yang masuk akal (16–30) dari tulisan seperti "24 derajat" atau "22°". */
function parseTemp(text: string): number | null {
  for (const m of text.matchAll(/\b(\d{2})\b/g)) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 30) return n;
  }
  return null;
}

function greeting(clock: FakeClock): string {
  const hour = Number(clock.hhmm().slice(0, 2));
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Balasan berjadwal server tiruan. Beberapa kata memicu kartu:
 * - "balas …" → draf balasan WhatsApp (menunggu persetujuan);
 * - "AC" → kartu perangkat AC kamar, menyalakan, mematikan, atau mengatur suhu;
 * - "token" → kartu pembayaran token listrik dengan pilihan "Ya, benar" dan "Batal"; "Ya, benar" memberi QRIS.
 * Selain itu {@link SAMPLE_REPLY}.
 */
export class FakeScenario {
  private readonly ac: AcState;
  private readAc: (() => AcState) | null = null;
  private pendingPaymentRp: number | null = null;
  private draftSeq = 0;

  constructor(private readonly clock: FakeClock) {
    const main = initialDevices.find((d) => d.id === MAIN_AC_ID);
    this.ac = { on: main?.on ?? true, temp: main?.ac?.temp ?? 24 };
  }

  /** Sumber keadaan AC yang sebenarnya (mode contoh: penyimpanan contoh). Tanpa itu, keadaan dalam skenario. */
  setAcReader(read: (() => AcState) | null) {
    this.readAc = read;
  }

  reply({ text, choiceId }: { text: string; choiceId?: string }): Reply {
    const one = (...parts: Part[]): Reply => ({ messages: [parts], drafts: [] });

    if (choiceId && this.pendingPaymentRp !== null) {
      const amount = this.pendingPaymentRp;
      if (choiceId === 'ya') {
        this.pendingPaymentRp = null;
        const untilIso = this.clock.iso(QRIS_MINUTES);
        const until = this.clock.hhmm(QRIS_MINUTES);
        return one(
          { type: 'text', text: `Silakan bayar lewat QRIS ini sebelum jam ${until}.` },
          { type: 'card', card: qrisCard(amount, untilIso) },
        );
      }
      if (choiceId === 'batal') {
        this.pendingPaymentRp = null;
        return one({ type: 'text', text: PAYMENT_CANCELLED });
      }
    }

    const replyTo = parseReplyRequest(text);
    if (replyTo) {
      if (!replyTo.to) return one({ type: 'text', text: ASK_REPLY_TO });
      const body = replyTo.content ? sentence(replyTo.content) : 'Pesannya sudah saya terima, nanti saya kabari lagi.';
      const draft: Draft = {
        id: `d-contoh-${++this.draftSeq}`,
        to: replyTo.to,
        channel: 'whatsapp',
        what: 'balasan',
        text: `${greeting(this.clock)}, ${replyTo.to}. ${body} Terima kasih.`,
        status: 'draft',
      };
      return {
        messages: [
          [
            { type: 'text', text: draftIntro('balasan') },
            { type: 'card', card: { kind: 'draft', draft } },
          ],
        ],
        drafts: [draft],
      };
    }

    if (/\btoken\b/i.test(text)) {
      const amount = parseRupiah(text) ?? DEFAULT_TOKEN_RP;
      this.pendingPaymentRp = amount;
      return one(...paymentParts(amount));
    }

    if (/\bac\b/i.test(text)) {
      const before = this.readAc?.() ?? this.ac;
      const temp = parseTemp(text);
      let next: AcState | null = null;
      let said: string;
      if (/\b(matikan|mati|off)\b/i.test(text)) {
        next = { on: false, temp: before.temp };
        said = 'Sudah. AC kamar saya matikan.';
      } else if (/\b(nyalakan|nyala|hidupkan|hidup|on|atur|set)\b/i.test(text) || temp !== null) {
        next = { on: true, temp: temp ?? before.temp };
        said = `Sudah. AC kamar nyala di ${next.temp}°.`;
      } else {
        said = before.on ? `AC kamar sedang nyala di ${before.temp}°.` : 'AC kamar sedang mati.';
      }
      const shown = next ?? before;
      const changed = next !== null && (next.on !== before.on || next.temp !== before.temp);
      if (next) Object.assign(this.ac, next);
      return {
        ...one({ type: 'text', text: said }, { type: 'card', card: acCard(shown.on, shown.temp) }),
        ...(changed && next ? { acChange: next } : {}),
      };
    }

    return one({ type: 'text', text: SAMPLE_REPLY });
  }
}
