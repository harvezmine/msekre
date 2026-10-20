import { homeSchema, streamEventSchema, type Home, type StreamEvent } from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { parseEventLenient, parseHomeLenient } from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { THINK_MS } from '@/sample/chat';
import { BUDI_DRAFT_ID, supplierOrderDraft } from '@/sample/outgoing';
import { initialSampleState } from '@/sample/store';

function setup() {
  const transport = new FakeTransport(createMemorySession(null));
  const homes: Home[] = [];
  const others: StreamEvent[] = [];
  transport.subscribe(
    (e) => (e.type === 'home' ? homes.push(e.home) : others.push(e)),
    () => {},
  );
  return { transport, homes, others };
}

const settle = () => jest.advanceTimersByTimeAsync(0);

describe('GET /home di server tiruan', () => {
  test('sah menurut skema, dengan isi desain 1a', async () => {
    const { transport } = setup();
    const home = await transport.home();
    expect(homeSchema.safeParse(home).success).toBe(true);
    expect(home).toMatchObject({
      place: 'Semua',
      greetingName: 'Rina',
      business: { sales: 'Rp4.250.000', down: false, alert: 'Susu UHT tinggal 6 karton' },
    });
    expect(home.agendaToday.map((a) => a.title)).toEqual([
      'Rapat dengan supplier susu',
      'Bayar listrik Kedai Dago',
      'Jemput Kayla les',
    ]);
    expect(home.approvals).toHaveLength(1);
    expect(home.approvals[0]).toMatchObject({ id: BUDI_DRAFT_ID, status: 'draft', to: 'Pak Budi' });
    expect(home.approvals[0]!.ask).toBe('Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?');
    expect(home.house.lines.map((l) => l.deviceId)).toEqual(['ac-kamar', 'pintu-depan', 'kamera-tamu']);
    expect(home.house.lines[0]).toMatchObject({ on: true, switchable: true, label: 'AC kamar' });
    expect(home.house.lines[1]!.on).toBeUndefined();
    expect(home.ring.nodes.length).toBe(7);
    expect(home.ring.nodes.find((n) => !n.reachable)?.label).toBeTruthy();
  });

  test('rev tetap selama isinya sama, naik saat berubah', async () => {
    const { transport } = setup();
    const a = await transport.home();
    expect((await transport.home()).rev).toBe(a.rev);
    transport.sample.dispatch({ type: 'setAc', on: false });
    expect((await transport.home()).rev).toBe(a.rev + 1);
  });

  test('agenda hari ini: paling banyak tiga baris, tanpa tugas', async () => {
    const { transport } = setup();
    transport.sample.dispatch({ type: 'finishLeftover', choice: 'today' });
    const home = await transport.home();
    expect(home.agendaToday).toHaveLength(3);
    expect(home.agendaToday.every((a) => a.kind !== 'task')).toBe(true);
  });

  test('keadaan awal bisa dipasang lewat opsi sample', async () => {
    const transport = new FakeTransport(createMemorySession(null), {
      sample: { ...initialSampleState, place: 'Kedai Riau' },
    });
    expect(await transport.home()).toMatchObject({
      place: 'Kedai Riau',
      business: { sales: 'Rp1.640.000', down: true, alert: 'Susu UHT tinggal 2 karton' },
    });
  });
});

describe('PUT /places/current', () => {
  test('menjawab Beranda tempat itu dan mengubah data contoh bersama', async () => {
    const { transport } = setup();
    const home = await transport.setPlace('Kedai Dago');
    expect(home).toMatchObject({ place: 'Kedai Dago', business: { sales: 'Rp2.610.000' } });
    expect(transport.sample.getState().place).toBe('Kedai Dago');
  });

  test('juga disiarkan ke koneksi lain lewat event home', async () => {
    const { transport, homes } = setup();
    const home = await transport.setPlace('Kedai Dago');
    await settle();
    expect(homes).toEqual([home]);
  });

  test('Rumah memakai angka Semua cabang; tempat asing ditolak tidak_valid', async () => {
    const { transport } = setup();
    expect((await transport.setPlace('Rumah')).business?.sales).toBe('Rp4.250.000');
    await expect(transport.setPlace('Bulan')).rejects.toMatchObject({ status: 400, error: 'tidak_valid' });
    await expect(transport.setPlace('')).rejects.toMatchObject({ error: 'tidak_valid' });
    expect(transport.sample.getState().place).toBe('Rumah');
  });
});

describe('event stream home', () => {
  test('perubahan data contoh menyiarkan Beranda baru dengan rev naik', async () => {
    const { transport, homes } = setup();
    const before = await transport.home();
    transport.sample.dispatch({ type: 'setAc', on: false, source: 'aplikasi' });
    await settle();
    expect(homes).toHaveLength(1);
    expect(homes[0]!.rev).toBe(before.rev + 1);
    expect(homes[0]!.house.lines[0]).toMatchObject({ text: 'AC kamar mati', on: false });
    expect(streamEventSchema.safeParse({ type: 'home', home: homes[0] }).success).toBe(true);
  });

  test('beberapa perubahan dalam satu giliran digabung menjadi satu event', async () => {
    const { transport, homes } = setup();
    await transport.home();
    transport.sample.dispatch({ type: 'setAc', on: false });
    transport.sample.dispatch({ type: 'setPlace', place: 'Kedai Dago' });
    transport.sample.dispatch({
      type: 'addAgenda',
      item: { date: '2025-10-20', time: '08.00', title: 'Telepon', kind: 'reminder' },
    });
    await settle();
    expect(homes).toHaveLength(1);
    expect(homes[0]).toMatchObject({
      place: 'Kedai Dago',
      agendaToday: [{ title: 'Telepon' }, expect.anything(), expect.anything()],
    });
  });

  test('perubahan yang tidak menyentuh Beranda tidak menyiarkan apa-apa', async () => {
    const { transport, homes } = setup();
    await transport.home();
    transport.sample.dispatch({ type: 'showToast', text: 'Halo' });
    transport.sample.dispatch({ type: 'setBoxMic', on: false });
    await settle();
    expect(homes).toHaveLength(0);
  });

  test('persetujuan muncul dan hilang mengikuti status draf', async () => {
    const { transport, homes } = setup();
    expect((await transport.home()).approvals).toHaveLength(1);
    await transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    await settle();
    expect(homes.at(-1)!.approvals).toEqual([]);
    expect(transport.sample.getState().outgoing[BUDI_DRAFT_ID]!.status).toBe('held');

    // Draf baru dari layar lain ("Pesan lagi") muncul sebagai persetujuan dan sebagai kartu di chat.
    transport.sample.dispatch({ type: 'addDraft', draft: supplierOrderDraft });
    await settle();
    expect(homes.at(-1)!.approvals.map((d) => d.to)).toEqual(['PT Sumber Susu']);
    const chat = await transport.messages();
    const card = chat.items[0]!.parts.find((p) => p.type === 'card');
    expect(card).toMatchObject({ card: { kind: 'draft', draft: { to: 'PT Sumber Susu' } } });

    await transport.draftAction(homes.at(-1)!.approvals[0]!.id, { action: 'discard' });
    await settle();
    expect(homes.at(-1)!.approvals).toEqual([]);
  });

  test('permintaan di chat yang mengubah AC ikut mengubah Beranda', async () => {
    const { transport, homes } = setup();
    await transport.send({ kind: 'text', clientId: 'c1', text: 'Matikan AC kamar' });
    await jest.advanceTimersByTimeAsync(THINK_MS);
    expect(transport.sample.getState().devices.find((d) => d.id === 'ac-kamar')!.on).toBe(false);
    expect(homes.at(-1)!.house.lines[0]).toMatchObject({ on: false });
  });

  test('Batalkan di Riwayat (data bersama) membatalkan draf di chat dan sebaliknya', async () => {
    const { transport } = setup();
    await transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    transport.sample.dispatch({ type: 'cancelSend', id: BUDI_DRAFT_ID });
    await settle();
    const card = (await transport.messages()).items
      .flatMap((m) => m.parts)
      .find((p) => p.type === 'card' && p.card.kind === 'draft');
    expect(card).toMatchObject({ card: { draft: { id: BUDI_DRAFT_ID, status: 'cancelled' } } });
  });

  test('masa tahan habis menandai kiriman terkirim di data bersama', async () => {
    const { transport } = setup();
    await transport.draftAction(BUDI_DRAFT_ID, { action: 'send' });
    await jest.advanceTimersByTimeAsync(5 * 60_000);
    expect(transport.sample.getState().outgoing[BUDI_DRAFT_ID]!.status).toBe('sent');
  });

  test('tanpa pendengar, GET /home tetap membaca keadaan terbaru', async () => {
    const transport = new FakeTransport(createMemorySession(null));
    transport.sample.dispatch({ type: 'setPlace', place: 'Rumah' });
    expect((await transport.home()).place).toBe('Rumah');
  });
});

describe('bacaan longgar Beranda', () => {
  const good = (): Home => ({
    place: 'Semua',
    greetingName: null,
    summary: 'Ada 3 hal.',
    approvals: [],
    agendaToday: [{ id: 'a1', time: '09.00', title: 'Rapat', kind: 'meeting' }],
    house: { lines: [{ deviceId: 'ac', icon: 'snow', text: 'AC nyala', on: true, switchable: true }] },
    business: { source: 'dari Moka', sales: 'Rp1', change: 'naik', down: false, alert: null },
    ring: { nodes: [{ key: 'wa', icon: 'chat', label: 'WhatsApp', reachable: true }] },
    rev: 3,
  });

  test('yang sah lolos apa adanya, ikon yang belum dikenal tidak membuangnya', () => {
    expect(parseHomeLenient(good())).toEqual(good());
    const future = {
      ...good(),
      future: 1,
      ring: { nodes: [{ key: 'x', icon: 'ikon-baru', label: 'X', reachable: true }] },
    };
    expect(parseHomeLenient(future)?.ring.nodes[0]!.icon).toBe('ikon-baru');
  });

  test('baris rusak dibuang, bagian lain bertahan; tanpa place atau rev ditolak', () => {
    const raw = {
      ...good(),
      agendaToday: [
        { id: 'a1', time: '09.00', title: 'Rapat' },
        { nope: 1 },
        5,
        ...[1, 2, 3, 4].map((i) => ({ id: `b${i}`, time: '10.00', title: 'T' })),
      ],
      house: { lines: [{ deviceId: 'ac', text: 'AC nyala' }, { text: 'tanpa id' }] },
      business: { sales: 5 },
      approvals: [{ id: 'd', to: 'X' }],
      ring: { nodes: [{ key: 'a', label: 'A' }, null] },
    };
    const home = parseHomeLenient(raw)!;
    expect(home.agendaToday).toHaveLength(3);
    expect(home.agendaToday[0]).toMatchObject({ kind: 'reminder' });
    expect(home.house.lines).toEqual([{ deviceId: 'ac', icon: 'bulb', text: 'AC nyala', switchable: false }]);
    expect(home.business).toBeNull();
    expect(home.approvals).toEqual([]);
    expect(home.ring.nodes).toEqual([{ key: 'a', icon: 'link', label: 'A', reachable: true }]);
    expect(parseHomeLenient({ ...good(), place: undefined })).toBeNull();
    expect(parseHomeLenient({ ...good(), rev: 0 })).toBeNull();
    expect(parseHomeLenient('x')).toBeNull();
  });

  test('event home: sah atau diperbaiki; rusak dilewati', () => {
    expect(parseEventLenient({ type: 'home', home: good() })).toEqual({ type: 'home', home: good() });
    expect(parseEventLenient({ type: 'home', home: { ...good(), house: 5 } })).toMatchObject({ type: 'home' });
    expect(parseEventLenient({ type: 'home', home: 5 })).toBeNull();
  });
});
