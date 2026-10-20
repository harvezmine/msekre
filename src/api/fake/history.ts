import { initialChat } from '@/sample/chat';
import { initialDevices, MAIN_AC_ID } from '@/sample/devices';
import { initialOutgoing } from '@/sample/outgoing';
import type { ChatEntry, Outgoing } from '@/sample/types';
import type { Card, Choice, Draft, Message, Part } from '../contract';
import { wibIso } from './clock';

type QrisStatus = Extract<Card, { kind: 'qris' }>['status'];

/**
 * Media server tiruan. Gambar QRIS tiruan tidak punya berkas: `mediaUrl` memberi `{ kind: 'sampleQr' }`, dan layar
 * menggambar pola QR contoh (`qrPattern`) dengan SVG.
 */
export const SAMPLE_QR_MEDIA_ID = 'contoh-qris';
export const SAMPLE_FILE_MEDIA_ID = 'contoh-laporan';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const mainAc = initialDevices.find((d) => d.id === MAIN_AC_ID)!;
const tokenEntry = initialChat.find((e) => e.kind === 'token')!;

/** Rupiah dari tulisan contoh, "Rp100.000" → 100000. */
const rupiah = (text: string) => Number(text.replace(/\D/g, ''));

export const PAYMENT_CHOICES: Choice[] = [
  { id: 'ya', title: 'Ya, benar' },
  { id: 'batal', title: 'Batal' },
];

/** Kartu AC kamar dengan keadaan `on` dan suhu `temp`. */
export function acCard(on: boolean, temp: number): Card {
  return {
    kind: 'device',
    deviceId: mainAc.id,
    name: mainAc.name,
    on,
    temp,
    mode: mainAc.ac?.mode,
    note: mainAc.roomTemp ? `Suhu ruangan ${mainAc.roomTemp}°` : undefined,
  };
}

/** Kartu pembelian token listrik untuk meter contoh, dengan pilihan "Ya, benar" dan "Batal". */
export function paymentParts(amountRp: number): Part[] {
  const meter = tokenEntry.kind === 'token' ? tokenEntry.meter : '';
  const owner = tokenEntry.kind === 'token' ? tokenEntry.owner : '';
  return [
    {
      type: 'card',
      card: {
        kind: 'payment',
        title: 'Token listrik PLN',
        amountRp,
        lines: [
          { label: 'No. meter', value: meter },
          { label: 'Atas nama', value: owner },
        ],
        ask: 'Sudah benar?',
      },
    },
    { type: 'choices', choices: PAYMENT_CHOICES },
  ];
}

export function qrisCard(amountRp: number, until: string, status: QrisStatus = 'menunggu'): Card {
  return { kind: 'qris', amountRp, until, status, mediaId: SAMPLE_QR_MEDIA_ID };
}

export function draftFromOutgoing(o: Outgoing): Draft {
  return {
    id: o.id,
    to: o.to,
    channel: 'whatsapp',
    what: o.what,
    text: o.text,
    status: o.status,
    ...(o.status === 'draft' ? {} : { heldUntil: wibIso(10, 20, o.heldUntil) }),
  };
}

function entryParts(entry: Exclude<ChatEntry, { kind: 'thinking' }>): Part[] {
  switch (entry.kind) {
    case 'user':
    case 'assistant':
      return [{ type: 'text', text: entry.text }];
    case 'device':
      return [{ type: 'card', card: acCard(mainAc.on, mainAc.ac?.temp ?? 24) }];
    case 'confirm':
      return [{ type: 'card', card: { kind: 'draft', draft: draftFromOutgoing(initialOutgoing[entry.outgoingId]!) } }];
    case 'notes':
      return [
        {
          type: 'card',
          card: {
            kind: 'notes',
            title: entry.title,
            when: entry.when,
            decisions: entry.decisions,
            meetingId: 'rapat-supplier-susu',
          },
        },
      ];
    case 'file':
      return [
        {
          type: 'document',
          mediaId: SAMPLE_FILE_MEDIA_ID,
          name: entry.name,
          mime: XLSX_MIME,
          sizeBytes: Number(/(\d+)\s*KB/.exec(entry.meta)?.[1] ?? 0) * 1024,
        },
      ];
    case 'token':
      return paymentParts(rupiah(entry.amount));
    case 'qris':
      return [{ type: 'card', card: qrisCard(rupiah(entry.amount), wibIso(10, 20, entry.until)) }];
  }
}

/** Jam WIB tiap baris utas contoh 0b yang memulai pesan, Senin 20 Okt. */
const TIMES: Record<string, string> = {
  t1: '09.45',
  t2: '09.45',
  t4: '09.47',
  t5: '09.47',
  t7: '09.48',
  t9: '09.50',
  t11: '09.58',
  t12: '09.58',
  t13: '10.00',
  t14: '10.00',
  t15: '10.40',
};

/**
 * Riwayat server tiruan, dari yang terlama: dua pesan kemarin malam lewat WhatsApp (untuk tanda "lewat WhatsApp"),
 * lalu utas contoh 0b (`initialChat`) sebagai `Message`. Teks asisten memulai pesan baru; kartu menempel ke pesan
 * asisten sebelumnya. `seq` dan `rev` berurutan dari 1. QRIS contoh tetap `menunggu` (bukan kedaluwarsa) supaya kartu 0b terlihat. Baris `thinking` dilewati karena itu keadaan stream, bukan pesan.
 */
export function sampleHistory(): Message[] {
  const out: Message[] = [
    {
      id: 'h-wa1',
      seq: 0,
      rev: 0,
      at: wibIso(10, 19, '20.15'),
      from: 'user',
      via: 'whatsapp',
      parts: [{ type: 'text', text: 'Besok ingatkan saya rapat dengan supplier susu jam 9 ya' }],
    },
    {
      id: 'h-wa2',
      seq: 0,
      rev: 0,
      at: wibIso(10, 19, '20.15'),
      from: 'assistant',
      via: 'whatsapp',
      parts: [{ type: 'text', text: 'Siap, besok jam 08.45 saya ingatkan rapat dengan supplier susu.' }],
    },
  ];
  let current: Message | null = null;
  let time = '09.45';
  for (const entry of initialChat) {
    if (entry.kind === 'thinking') continue;
    time = TIMES[entry.id] ?? time;
    const at = wibIso(10, 20, time);
    if (entry.kind === 'user') {
      current = null;
      out.push({
        id: `h-${entry.id}`,
        seq: 0,
        rev: 0,
        at,
        from: 'user',
        via: 'app',
        parts: [{ type: 'text', text: entry.text }],
      });
      continue;
    }
    if (entry.kind === 'assistant' || !current) {
      current = { id: `h-${entry.id}`, seq: 0, rev: 0, at, from: 'assistant', via: 'app', parts: [] };
      out.push(current);
    }
    current.parts.push(...entryParts(entry));
  }
  out.forEach((m, i) => {
    m.seq = i + 1;
    m.rev = i + 1;
    // Pilihan yang dijawab pengguna di pesan berikutnya ("Ya, benar") sudah terambil.
    const answer = out[i + 1];
    const reply = answer?.from === 'user' ? answer.parts[0] : undefined;
    for (const part of m.parts) {
      if (part.type !== 'choices' || reply?.type !== 'text') continue;
      const taken = part.choices.find((c) => c.title === reply.text);
      if (taken) part.chosenId = taken.id;
    }
  });
  return out;
}
