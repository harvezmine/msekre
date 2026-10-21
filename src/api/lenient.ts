import { z } from 'zod';
import {
  agendaItemSchema,
  agendaResSchema,
  boxSchema,
  businessBranchSchema,
  businessMoneyInSchema,
  businessOrderSchema,
  businessReportSchema,
  businessSchema,
  businessSourceSchema,
  businessStockSchema,
  businessPointSchema,
  businessSummarySchema,
  HOME_AGENDA_MAX,
  isoDateTimeSchema,
  messageSchema,
  messagesPageSchema,
  messagesChangedPageSchema,
  draftActionResSchema,
  deviceSchema,
  devicesResSchema,
  draftSchema,
  homeSchema,
  partSchema,
  roomSchema,
  routineSchema,
  streamEventSchema,
  UNKNOWN_PART_NOTE,
  type AgendaItem,
  type AgendaRes,
  type Business,
  type Device,
  type DevicesRes,
  type DraftActionRes,
  type Home,
  type Message,
  type MessagesPage,
  type MessagesChangedPage,
  type Part,
  type StreamEvent,
} from './contract';

/**
 * Pembacaan longgar untuk pesan dari server. Kontrak bisa lebih baru dari aplikasi (jenis bagian, jenis kartu, atau
 * nilai enum baru): satu pesan seperti itu tidak boleh menggagalkan seluruh halaman atau menghilang dari utas. Bagian
 * yang tidak lolos skema menjadi `{ type: 'unknown', note }`; hanya pesan yang amplopnya rusak (tanpa `id` atau `seq`)
 * dibuang. `rev` yang hilang atau rusak diganti `seq` (server lama), supaya pesan tetap tampil.
 */

const envelopeSchema = z.object({ id: z.string().min(1), seq: z.number().int().positive() });

const positiveInt = z.number().int().positive();

function revOf(raw: unknown, fallback: number): number {
  const rev = positiveInt.safeParse(raw);
  return rev.success ? rev.data : fallback;
}

export function unknownPart(): Part {
  return { type: 'unknown', note: UNKNOWN_PART_NOTE };
}

/** Pesan sah apa adanya, atau versi yang bagian-bagiannya diganti `unknown`; `null` kalau amplopnya rusak. */
export function parseMessageLenient(raw: unknown): Message | null {
  const strict = messageSchema.safeParse(raw);
  if (strict.success) return strict.data;
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return null;
  const r = raw as Record<string, unknown>;
  const at = isoDateTimeSchema.safeParse(r.at);
  const from = r.from === 'user' || r.from === 'assistant' ? r.from : null;
  const via = r.via === 'app' || r.via === 'whatsapp' ? r.via : null;
  // Pengirim, kanal, atau waktu yang tidak dikenal: seluruh isi pesan tidak bisa dipercaya.
  const trusted = at.success && from !== null && via !== null;
  const parts =
    trusted && Array.isArray(r.parts) && r.parts.length > 0
      ? r.parts.map((p): Part => {
          const part = partSchema.safeParse(p);
          return part.success ? part.data : unknownPart();
        })
      : [unknownPart()];
  const coerced = messageSchema.safeParse({
    id: envelope.data.id,
    seq: envelope.data.seq,
    rev: revOf(r.rev, envelope.data.seq),
    ...(typeof r.clientId === 'string' ? { clientId: r.clientId } : {}),
    at: at.success ? at.data : new Date(0).toISOString(),
    from: from ?? 'assistant',
    via: via ?? 'app',
    parts,
  });
  return coerced.success ? coerced.data : null;
}

function parseItems(raw: unknown): Message[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    const message = parseMessageLenient(item);
    return message ? [message] : [];
  });
}

/** Halaman riwayat, pesan demi pesan. `null` kalau bentuk halamannya sendiri salah. */
export function parsePageLenient(raw: unknown): MessagesPage | null {
  const items = parseItems((raw as { items?: unknown } | null)?.items);
  const rest = messagesPageSchema.omit({ items: true }).safeParse(raw);
  return items && rest.success ? { items, before: rest.data.before } : null;
}

/** Halaman resync (`?after=`), pesan demi pesan. */
export function parseChangedPageLenient(raw: unknown): MessagesChangedPage | null {
  const items = parseItems((raw as { items?: unknown } | null)?.items);
  const rest = messagesChangedPageSchema.omit({ items: true }).safeParse(raw);
  return items && rest.success ? { items, more: rest.data.more } : null;
}

/**
 * Event stream. Pesan memakai pembacaan longgar; event lain harus sah. `null` untuk event yang rusak atau jenisnya
 * belum dikenal (dilewati).
 */
export function parseEventLenient(raw: unknown): StreamEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if ((raw as { type?: unknown }).type === 'message') {
    const message = parseMessageLenient((raw as { message?: unknown }).message);
    return message ? { type: 'message', message } : null;
  }
  const parsed = streamEventSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if ((raw as { type?: unknown }).type === 'home') {
    const home = parseHomeLenient((raw as { home?: unknown }).home);
    return home ? { type: 'home', home } : null;
  }
  if ((raw as { type?: unknown }).type === 'agenda') {
    const rev = positiveInt.safeParse((raw as { rev?: unknown }).rev);
    if (!rev.success) return null;
    const r = raw as { items?: unknown; removed?: unknown; leftover?: unknown };
    const leftover = r.leftover === null ? null : parseAgendaItemLenient(r.leftover);
    return {
      type: 'agenda',
      ...(Array.isArray(r.items) ? { items: parseAgendaItems(r.items) } : {}),
      ...(Array.isArray(r.removed) ? { removed: r.removed.filter(nonEmpty) } : {}),
      ...(r.leftover !== undefined && (r.leftover === null || leftover) ? { leftover } : {}),
      rev: rev.data,
    };
  }
  if ((raw as { type?: unknown }).type === 'device') {
    const rev = positiveInt.safeParse((raw as { rev?: unknown }).rev);
    if (!rev.success) return null;
    const r = raw as { devices?: unknown; box?: unknown };
    const box = boxSchema.safeParse(r.box);
    return {
      type: 'device',
      ...(Array.isArray(r.devices) ? { devices: parseDevices(r.devices) } : {}),
      ...(box.success ? { box: box.data } : {}),
      rev: rev.data,
    };
  }
  if ((raw as { type?: unknown }).type === 'business') {
    const business = parseBusinessLenient((raw as { business?: unknown }).business);
    return business ? { type: 'business', business } : null;
  }
  if ((raw as { type?: unknown }).type === 'draft') {
    // `rev` hilang atau rusak (server lama): drafnya tetap berlaku, `rev` 0 = tidak diketahui.
    const draft = draftSchema.safeParse((raw as { draft?: unknown }).draft);
    return draft.success ? { type: 'draft', draft: draft.data, rev: 0 } : null;
  }
  return null;
}

/** Jawaban aksi draf. `rev` yang hilang atau rusak dibaca 0 (tidak diketahui). `null` kalau drafnya sendiri rusak. */
export function parseDraftResLenient(raw: unknown): DraftActionRes | null {
  const strict = draftActionResSchema.safeParse(raw);
  if (strict.success) return strict.data;
  const draft = draftSchema.safeParse((raw as { draft?: unknown } | null)?.draft);
  return draft.success ? { draft: draft.data, rev: 0 } : null;
}

/** Selisih zona WIB dari UTC dalam menit, dipakai bila server tidak menyebut zona pengguna. */
export const DEFAULT_TZ_MINUTES = 420;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Beranda dari server. Yang sah dibaca apa adanya; kalau ada isi yang rusak (kontrak lebih baru, atau satu baris
 * salah), baris itu dibuang atau diberi nilai bawaan, bukan menggagalkan seluruh Beranda. `null` hanya kalau `place`
 * atau `rev` tidak ada. Nama ikon yang tidak dikenal lolos; layar menggantinya dengan ikon bawaan.
 */
export function parseHomeLenient(raw: unknown): Home | null {
  const strict = homeSchema.safeParse(raw);
  if (strict.success) return strict.data;
  if (!isRecord(raw) || !nonEmpty(raw.place)) return null;
  const rev = positiveInt.safeParse(raw.rev);
  if (!rev.success) return null;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const approvals = list(raw.approvals).flatMap((d) => {
    const draft = draftSchema.safeParse(d);
    return draft.success ? [draft.data] : [];
  });
  const agendaToday = list(raw.agendaToday)
    .flatMap((a) => {
      const r = isRecord(a) ? a : {};
      return nonEmpty(r.id) && nonEmpty(r.time) && nonEmpty(r.title)
        ? [{ id: r.id, time: r.time, title: r.title, kind: nonEmpty(r.kind) ? r.kind : 'reminder' }]
        : [];
    })
    .slice(0, HOME_AGENDA_MAX);
  const lines = list(isRecord(raw.house) ? raw.house.lines : undefined).flatMap((l) => {
    const r = isRecord(l) ? l : {};
    return nonEmpty(r.deviceId) && nonEmpty(r.text)
      ? [
          {
            deviceId: r.deviceId,
            icon: nonEmpty(r.icon) ? r.icon : 'bulb',
            text: r.text,
            ...(nonEmpty(r.label) ? { label: r.label } : {}),
            ...(typeof r.on === 'boolean' ? { on: r.on } : {}),
            switchable: r.switchable === true,
          },
        ]
      : [];
  });
  const business = businessSummarySchema.safeParse(raw.business);
  const nodes = list(isRecord(raw.ring) ? raw.ring.nodes : undefined).flatMap((n) => {
    const r = isRecord(n) ? n : {};
    return nonEmpty(r.key) && nonEmpty(r.label)
      ? [{ key: r.key, icon: nonEmpty(r.icon) ? r.icon : 'link', label: r.label, reachable: r.reachable !== false }]
      : [];
  });
  const coerced = homeSchema.safeParse({
    place: raw.place,
    places: list(raw.places).filter(nonEmpty),
    greetingName: nonEmpty(raw.greetingName) ? raw.greetingName : null,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    approvals,
    agendaToday,
    house: { lines },
    business: business.success ? business.data : null,
    ring: { nodes },
    rev: rev.data,
  });
  return coerced.success ? coerced.data : null;
}

/** Bidang item agenda yang boleh dibuang kalau rusak (kontrak lebih baru), tanpa membuang itemnya. */
const AGENDA_EXTRAS = [
  'way',
  'repeat',
  'note',
  'snoozedUntil',
  'seriesId',
  'notesMessageId',
  'done',
  'allDay',
] as const;

/**
 * Satu item agenda. Bidang tambahan yang rusak atau bernilai baru (cara pengingat yang belum dikenal, misalnya) dibuang dan
 * itemnya tetap dipakai; `null` kalau bidang intinya (id, tanggal, jam, judul, jenis) tidak sah (kontrak lebih baru atau
 * rusak). Item yang rusak dibuang satu per satu dari daftar, bukan menggagalkan daftar.
 */
export function parseAgendaItemLenient(raw: unknown): AgendaItem | null {
  const item = agendaItemSchema.safeParse(raw);
  if (item.success) return item.data;
  if (!isRecord(raw)) return null;
  const kept: Record<string, unknown> = { ...raw };
  for (const key of AGENDA_EXTRAS) {
    if (key in kept && !agendaItemSchema.shape[key].safeParse(kept[key]).success) delete kept[key];
  }
  const coerced = agendaItemSchema.safeParse(kept);
  return coerced.success ? coerced.data : null;
}

/** Jawaban yang membungkus satu item (`GET /agenda/:id`, `POST /agenda`, `PATCH /agenda/:id`): `{ item }`, dibaca longgar. */
export function parseAgendaItemResLenient(raw: unknown): { item: AgendaItem } | null {
  const item = parseAgendaItemLenient(isRecord(raw) ? raw.item : undefined);
  return item ? { item } : null;
}

function parseAgendaItems(raw: unknown[]): AgendaItem[] {
  return raw.flatMap((r) => {
    const item = parseAgendaItemLenient(r);
    return item ? [item] : [];
  });
}

/** Jawaban `GET /agenda`: item yang rusak dibuang satu per satu. `null` kalau bentuk jawabannya sendiri salah. */
export function parseAgendaLenient(raw: unknown): AgendaRes | null {
  const strict = agendaResSchema.safeParse(raw);
  if (strict.success) return strict.data;
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  const leftover = parseAgendaItemLenient(raw.leftover);
  // Server yang belum mengirim zona waktu: WIB (420), zona yang dipakai sebagian besar pengguna.
  const tz = z.number().int().safeParse(raw.tzOffsetMinutes);
  const coerced = agendaResSchema.safeParse({
    ...raw,
    items: parseAgendaItems(raw.items),
    leftover,
    tzOffsetMinutes: tz.success ? tz.data : DEFAULT_TZ_MINUTES,
  });
  return coerced.success ? coerced.data : null;
}

function parseDevices(raw: unknown[]): Device[] {
  return raw.flatMap((r) => {
    const device = deviceSchema.safeParse(r);
    return device.success ? [device.data] : [];
  });
}

/**
 * Jawaban `GET /devices`: perangkat, ruangan, dan rutinitas yang rusak dibuang satu per satu; kotak yang rusak menjadi
 * `null`. Jenis perangkat yang belum dikenal dibaca `other` oleh skemanya. `null` kalau `place` atau `rev` tidak ada.
 */
export function parseDevicesLenient(raw: unknown): DevicesRes | null {
  const strict = devicesResSchema.safeParse(raw);
  if (strict.success) return strict.data;
  if (!isRecord(raw) || !nonEmpty(raw.place)) return null;
  const rev = positiveInt.safeParse(raw.rev);
  if (!rev.success) return null;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const keep = <T>(schema: z.ZodType<T>, v: unknown): T[] =>
    list(v).flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  const box = boxSchema.safeParse(raw.box);
  const coerced = devicesResSchema.safeParse({
    place: raw.place,
    places: list(raw.places).filter(nonEmpty),
    rooms: keep(roomSchema, raw.rooms),
    devices: parseDevices(list(raw.devices)),
    box: box.success ? box.data : null,
    routines: keep(routineSchema, raw.routines),
    rev: rev.data,
  });
  return coerced.success ? coerced.data : null;
}

/**
 * Jawaban `GET /business`: baris yang rusak (uang masuk, stok, pesanan, cabang, titik grafik, sumber) dibuang satu per
 * satu; laporan yang rusak menjadi `null`. Kunci sumber dan saluran yang belum dikenal diterima apa adanya. `null`
 * kalau `place`, `period`, `rev`, atau `sales` tidak terbaca.
 */
export function parseBusinessLenient(raw: unknown): Business | null {
  const strict = businessSchema.safeParse(raw);
  if (strict.success) return strict.data;
  if (!isRecord(raw) || !nonEmpty(raw.place)) return null;
  const rev = positiveInt.safeParse(raw.rev);
  if (!rev.success) return null;
  const keep = <T>(schema: z.ZodType<T>, v: unknown): T[] =>
    (Array.isArray(v) ? v : []).flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  const report = businessReportSchema.safeParse(raw.report);
  const coerced = businessSchema.safeParse({
    place: raw.place,
    period: raw.period,
    sales: raw.sales,
    series: keep(businessPointSchema, raw.series),
    branches: keep(businessBranchSchema, raw.branches),
    moneyIn: keep(businessMoneyInSchema, raw.moneyIn),
    lowStock: keep(businessStockSchema, raw.lowStock),
    orders: keep(businessOrderSchema, raw.orders),
    report: report.success ? report.data : null,
    sources: keep(businessSourceSchema, raw.sources),
    rev: rev.data,
  });
  return coerced.success ? coerced.data : null;
}
