import {
  apiErrorSchema,
  authStartReqSchema,
  authStartResSchema,
  authVerifyReqSchema,
  authVerifyResSchema,
  cardSchema,
  deviceControlReqSchema,
  deviceControlResSchema,
  draftActionReqSchema,
  draftSchema,
  meSchema,
  messageSchema,
  messagesPageSchema,
  messagesQuerySchema,
  messagesChangedPageSchema,
  MESSAGES_LIMIT,
  okResSchema,
  partSchema,
  pinSetReqSchema,
  pinVerifyReqSchema,
  pushTokenReqSchema,
  securityResSchema,
  securityUpdateReqSchema,
  sendMessageReqSchema,
  sendMessageResSchema,
  streamEventSchema,
  TEXT_MAX,
  type Card,
  type Draft,
  type Message,
  type Part,
} from '@/api/contract';

const me = {
  id: 'u1',
  name: 'Rina',
  assistantName: 'Nadia',
  plan: { name: 'Bisnis', activeUntil: null },
  phone: '6281220457781',
};
const draft: Draft = {
  id: 'd1',
  to: 'Pak Budi',
  channel: 'whatsapp',
  what: 'balasan',
  text: 'Selamat siang, Pak Budi.',
  status: 'draft',
};
const cards: Card[] = [
  { kind: 'draft', draft },
  { kind: 'draft', draft: { ...draft, status: 'held', heldUntil: '2026-10-20T03:47:00.000Z' } },
  { kind: 'device', deviceId: 'ac-kamar', name: 'AC kamar', on: true, temp: 24, mode: 'Dingin', note: 'Suhu 27°' },
  { kind: 'device', deviceId: 'lampu', name: 'Lampu', on: false },
  { kind: 'notes', title: 'Rapat', when: 'Senin, 20 Okt · 09.00–09.40', decisions: ['Harga tetap.'], meetingId: 'r1' },
  {
    kind: 'payment',
    title: 'Token listrik PLN',
    amountRp: 100000,
    lines: [{ label: 'No. meter', value: '5321' }],
    ask: 'Sudah benar?',
  },
  { kind: 'qris', amountRp: 100000, until: '2026-10-20T03:57:00.000Z', status: 'menunggu', mediaId: 'q1' },
  { kind: 'qris', amountRp: 100000, until: '2026-10-20T10:15:00+07:00', status: 'lunas', mediaId: 'q1' },
];
const parts: Part[] = [
  { type: 'text', text: 'Halo' },
  { type: 'choices', prompt: 'Pilih satu', choices: [{ id: 'ya', title: 'Ya', description: 'Lanjut' }] },
  { type: 'image', mediaId: 'm1', mime: 'image/png', caption: 'Foto', alt: 'Foto kedai' },
  { type: 'document', mediaId: 'm2', name: 'Laporan.xlsx', mime: 'application/vnd.ms-excel', sizeBytes: 49152 },
  { type: 'audio', mediaId: 'm3', mime: 'audio/ogg', transcript: 'Halo' },
  ...cards.map((card): Part => ({ type: 'card', card })),
];
const message: Message = {
  id: 'm1',
  seq: 1,
  rev: 1,
  clientId: 'c1',
  at: '2026-10-20T03:42:00.000Z',
  from: 'user',
  via: 'app',
  parts: [{ type: 'text', text: 'Halo' }],
};

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(true);
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false);

describe('masuk', () => {
  test('nomor E.164 tanpa + dan kode 6 angka', () => {
    ok(authStartReqSchema, { phone: '6281220457781' });
    ok(authStartReqSchema, { phone: '628122045' });
    ok(authStartResSchema, { resendInSec: 60 });
    ok(authVerifyReqSchema, { phone: '6281220457781', code: '123456' });
    ok(authVerifyResSchema, { token: 't', user: me });
    ok(okResSchema, { ok: true });
  });

  test.each([['+6281220457781'], ['081220457781'], ['62812204'], ['62812abc45778'], ['6281220457781234'], ['']])(
    'nomor %p ditolak',
    (phone) => bad(authStartReqSchema, { phone }),
  );

  test.each([['12345'], ['1234567'], ['12a456'], [123456]])('kode %p ditolak', (code) =>
    bad(authVerifyReqSchema, { phone: '6281220457781', code }),
  );

  test('jawaban yang tidak lengkap ditolak', () => {
    bad(authStartResSchema, { resendInSec: -1 });
    bad(authStartResSchema, { resendInSec: 1.5 });
    bad(authVerifyResSchema, { token: '', user: me });
    bad(okResSchema, { ok: false });
  });
});

describe('Me', () => {
  test('nama boleh kosong, paket boleh tanpa batas', () => {
    ok(meSchema, me);
    ok(meSchema, { ...me, name: null, plan: { name: 'Coba', activeUntil: '2026-10-27T10:42:00+07:00' } });
  });

  test('nama asisten wajib, waktu wajib dengan zona', () => {
    bad(meSchema, { ...me, assistantName: '' });
    bad(meSchema, { ...me, name: undefined });
    bad(meSchema, { ...me, plan: { name: 'Coba', activeUntil: '2026-10-27T10:42:00' } });
  });
});

describe('pesan', () => {
  test('setiap jenis bagian dan kartu diterima', () => {
    for (const part of parts) ok(partSchema, part);
    for (const card of cards) ok(cardSchema, card);
    ok(messageSchema, { ...message, from: 'assistant', via: 'whatsapp', parts, clientId: undefined });
    ok(messageSchema, { ...message, at: '2026-10-20T10:42:00+07:00' });
  });

  test.each<[string, unknown]>([
    ['bagian kosong', { ...message, parts: [] }],
    ['jenis bagian tidak dikenal', { ...message, parts: [{ type: 'video', mediaId: 'v' }] }],
    ['teks kosong', { ...message, parts: [{ type: 'text', text: '' }] }],
    ['pilihan kosong', { ...message, parts: [{ type: 'choices', choices: [] }] }],
    ['gambar bukan image/*', { ...message, parts: [{ type: 'image', mediaId: 'm', mime: 'application/pdf' }] }],
    ['suara bukan audio/*', { ...message, parts: [{ type: 'audio', mediaId: 'm', mime: 'image/png' }] }],
    ['waktu tanpa zona', { ...message, at: '2026-10-20T10:42:00' }],
    ['tanpa seq', { ...message, seq: undefined }],
    ['seq nol', { ...message, seq: 0 }],
    ['seq pecahan', { ...message, seq: 1.5 }],
    ['tanpa rev', { ...message, rev: undefined }],
    ['rev nol', { ...message, rev: 0 }],
    ['pengirim lain', { ...message, from: 'system' }],
    ['kanal lain', { ...message, via: 'sms' }],
  ])('%s ditolak', (_, value) => bad(messageSchema, value));

  test.each<[string, unknown]>([
    ['jenis kartu tidak dikenal', { kind: 'cuaca' }],
    ['kartu perangkat tanpa nama', { kind: 'device', deviceId: 'a', on: true }],
    ['pembayaran dengan rupiah pecahan', { ...cards[5], amountRp: 100.5 }],
    ['QRIS nol rupiah', { ...cards[7], amountRp: 0 }],
    ['QRIS dengan jam saja', { kind: 'qris', amountRp: 1000, until: '10.15', status: 'menunggu', mediaId: 'q' }],
    [
      'QRIS tanpa zona',
      { kind: 'qris', amountRp: 1000, until: '2026-10-20T10:15:00', status: 'menunggu', mediaId: 'q' },
    ],
    ['QRIS tanpa status', { kind: 'qris', amountRp: 1000, until: '2026-10-20T10:15:00Z', mediaId: 'q' }],
    ['QRIS status lain', { ...cards[7], status: 'batal' }],
  ])('%s ditolak', (_, value) => bad(cardSchema, value));

  test('halaman riwayat dan halaman resync', () => {
    ok(messagesPageSchema, { items: [message], before: 1 });
    ok(messagesPageSchema, { items: [], before: null });
    bad(messagesPageSchema, { items: [message] });
    bad(messagesPageSchema, { items: [message], before: 'm1' });
    ok(messagesChangedPageSchema, { items: [message], more: true });
    bad(messagesChangedPageSchema, { items: [message] });
  });

  test('query: limit bawaan 30, dibaca dari teks, paling banyak 100; before dan changedAfter tidak bersamaan', () => {
    expect(messagesQuerySchema.parse({})).toEqual({ limit: MESSAGES_LIMIT });
    expect(messagesQuerySchema.parse({ before: '9', limit: '50' })).toEqual({ before: 9, limit: 50 });
    expect(messagesQuerySchema.parse({ changedAfter: '0' })).toEqual({ changedAfter: 0, limit: MESSAGES_LIMIT });
    bad(messagesQuerySchema, { limit: '101' });
    bad(messagesQuerySchema, { limit: '0' });
    bad(messagesQuerySchema, { before: 'm9' });
    bad(messagesQuerySchema, { before: '5', changedAfter: '3' });
  });

  test('kirim teks atau pilihan; campuran dan kolom lebih ditolak', () => {
    ok(sendMessageReqSchema, { kind: 'text', clientId: 'c1', text: 'Halo' });
    ok(sendMessageReqSchema, { kind: 'choice', clientId: 'c1', messageId: 'm1', choiceId: 'ya' });
    ok(sendMessageResSchema, { message });
    bad(sendMessageReqSchema, { kind: 'text', clientId: 'c1', text: '   ' });
    bad(sendMessageReqSchema, { kind: 'text', clientId: 'c1', text: 'a'.repeat(TEXT_MAX + 1) });
    bad(sendMessageReqSchema, { kind: 'text', clientId: '', text: 'Halo' });
    bad(sendMessageReqSchema, { kind: 'text', clientId: 'c'.repeat(65), text: 'Halo' });
    bad(sendMessageReqSchema, { kind: 'choice', clientId: 'c1', choiceId: 'ya' });
    bad(sendMessageReqSchema, { kind: 'choice', clientId: 'c1', messageId: 'm1' });
    bad(sendMessageReqSchema, { clientId: 'c1', text: 'Halo' });
    bad(sendMessageReqSchema, { kind: 'text', clientId: 'c1', text: 'Halo', choiceId: 'ya' });
    bad(sendMessageReqSchema, { kind: 'choice', clientId: 'c1', messageId: 'm1', choiceId: 'ya', text: 'Halo' });
    // Judul pilihan dari klien tidak dipercaya.
    bad(sendMessageReqSchema, { kind: 'choice', clientId: 'c1', messageId: 'm1', choiceId: 'ya', choiceTitle: 'Ya' });
    bad(sendMessageReqSchema, { kind: 'text', text: 'Halo' });
  });

  test('pilihan yang sudah diambil membawa chosenId', () => {
    ok(partSchema, { type: 'choices', choices: [{ id: 'ya', title: 'Ya' }], chosenId: 'ya' });
  });

  test('bagian unknown sah (dibuat aplikasi)', () => {
    ok(partSchema, { type: 'unknown', note: 'Pesan ini butuh aplikasi versi terbaru.' });
    bad(partSchema, { type: 'unknown' });
  });
});

describe('draf', () => {
  test('held wajib membawa heldUntil', () => {
    ok(draftSchema, draft);
    const heldUntil = '2026-10-20T10:47:00+07:00';
    ok(draftSchema, { ...draft, status: 'held', heldUntil });
    ok(draftSchema, { ...draft, status: 'sent', heldUntil });
    ok(draftSchema, { ...draft, status: 'cancelled', heldUntil });
    ok(draftSchema, { ...draft, status: 'failed', heldUntil });
    bad(draftSchema, { ...draft, status: 'held', heldUntil: '10.47' });
    bad(draftSchema, { ...draft, status: 'held', heldUntil: '2026-10-20T10:47:00' });
    bad(draftSchema, { ...draft, status: 'held' });
    bad(draftSchema, { ...draft, status: 'terkirim' });
    bad(draftSchema, { ...draft, channel: 'sms' });
    bad(draftSchema, { ...draft, to: '' });
  });

  test('aksi draf', () => {
    ok(draftActionReqSchema, { action: 'send' });
    ok(draftActionReqSchema, { action: 'cancel' });
    ok(draftActionReqSchema, { action: 'discard' });
    ok(draftActionReqSchema, { action: 'edit', text: 'Teks baru' });
    bad(draftActionReqSchema, { action: 'edit' });
    bad(draftActionReqSchema, { action: 'edit', text: '' });
    bad(draftActionReqSchema, { action: 'hapus' });
  });
});

test('token notifikasi', () => {
  ok(pushTokenReqSchema, { pushToken: 'ExponentPushToken[x]', platform: 'android' });
  ok(pushTokenReqSchema, { pushToken: 'abc', platform: 'ios' });
  bad(pushTokenReqSchema, { pushToken: '', platform: 'android' });
  bad(pushTokenReqSchema, { pushToken: 'abc', platform: 'web' });
});

test('kendali perangkat rumah', () => {
  ok(deviceControlReqSchema, { on: false });
  ok(deviceControlReqSchema, { on: true, temp: 22, mode: 'Dingin' });
  bad(deviceControlReqSchema, {});
  bad(deviceControlReqSchema, { brightness: 3 });
  bad(deviceControlReqSchema, { mode: '' });
  ok(deviceControlReqSchema, { fan: 'Pelan' });
  ok(deviceControlReqSchema, { level: 40 });
  ok(deviceControlReqSchema, { on: false, pin: '123456' });
  bad(deviceControlReqSchema, { pin: '123456' });
  bad(deviceControlReqSchema, { on: false, pin: '12' });
  bad(deviceControlReqSchema, { level: 101 });
  const device = {
    id: 'ac-kamar',
    place: 'Rumah',
    room: 'Kamar',
    name: 'AC kamar',
    icon: 'snow',
    kind: 'ac',
    on: true,
    reachable: true,
    ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' },
    status: 'Nyala · 24°',
  };
  ok(deviceControlResSchema, { device, card: cards[2], rev: 5 });
  // rev wajib di kontrak (pembacaan longgar aplikasi membacanya 0)
  bad(deviceControlResSchema, { device, card: cards[2] });
  bad(deviceControlResSchema, { card: cards[2] });
  bad(deviceControlResSchema, { device, card: cards[0] });
});

test('event stream', () => {
  ok(streamEventSchema, { type: 'message', message });
  ok(streamEventSchema, { type: 'draft', draft, rev: 7 });
  bad(streamEventSchema, { type: 'draft', draft });
  bad(streamEventSchema, { type: 'draft', draft, rev: 0 });
  ok(streamEventSchema, { type: 'thinking', runId: 'r1', on: true });
  ok(streamEventSchema, { type: 'ping' });
  bad(streamEventSchema, { type: 'thinking', on: true });
  bad(streamEventSchema, { type: 'thinking', runId: 'r1' });
  bad(streamEventSchema, { type: 'message', message: { ...message, parts: [] } });
  bad(streamEventSchema, { type: 'mengetik' });
});

test('error', () => {
  for (const error of [
    'tidak_valid',
    'kode_salah',
    'tidak_masuk',
    'tidak_ditemukan',
    'status_draf',
    'sudah_dipilih',
    'diblokir',
    'pin_salah',
    'pin_diperlukan',
    'belum_terdaftar',
    'perlu_pembaruan',
    'terlalu_sering',
    'server',
    'belum_tersedia',
  ])
    ok(apiErrorSchema, { error });
  ok(apiErrorSchema, { error: 'terlalu_sering', retryInSec: 42 });
  bad(apiErrorSchema, { error: 'terlalu_sering', retryInSec: -1 });
  ok(apiErrorSchema, { error: 'belum_terdaftar', waNumber: '6281100002222' });
  bad(apiErrorSchema, { error: 'belum_terdaftar', waNumber: 'bukan nomor' });
  bad(apiErrorSchema, { error: 'lain' });
  bad(apiErrorSchema, {});
});

test('keamanan: PIN opsional, 6 angka', () => {
  ok(securityResSchema, { pinEnabled: false, hasPin: false });
  bad(securityResSchema, { pinEnabled: false });
  ok(securityUpdateReqSchema, { pinEnabled: true });
  // Mematikan membawa PIN yang sekarang; PIN harus 6 angka.
  ok(securityUpdateReqSchema, { pinEnabled: false, pin: '123456' });
  bad(securityUpdateReqSchema, { pinEnabled: false, pin: '12345' });
  bad(securityUpdateReqSchema, { pinEnabled: false, nama: 'x' });
  ok(pinSetReqSchema, { pin: '123456' });
  // Membuat PIN sekalian menghidupkan permintaan PIN (atomik).
  ok(pinSetReqSchema, { pin: '123456', enable: true });
  bad(pinSetReqSchema, { pin: '123456', enable: 'ya' });
  ok(pinSetReqSchema, { pin: '123456', currentPin: '654321' });
  for (const pin of ['12345', '1234567', 'abcdef', '12 456', 123456]) bad(pinSetReqSchema, { pin });
  bad(pinSetReqSchema, { pin: '123456', currentPin: '1' });
  ok(pinVerifyReqSchema, { pin: '000000' });
  bad(pinVerifyReqSchema, { pin: '00000' });
});
