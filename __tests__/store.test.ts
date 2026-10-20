import { BUDI_DRAFT_ID as BUDI, supplierOrderDraft } from '@/sample/outgoing';
import {
  initialSampleState as init,
  sampleReducer as reduce,
  agendaOn,
  approvalText,
  deviceById,
  deviceStatus,
  draftFor,
  homeAgenda,
  houseCard,
  historyRows,
  pendingApproval,
  ringNodes,
  serviceStatus,
  type SampleAction,
  type SampleState,
} from '@/sample/store';

const run = (actions: SampleAction[], from: SampleState = init) => actions.reduce(reduce, from);
const dev = (s: SampleState, id: string) => deviceById(s, id)!;
const status = (s: SampleState, id: string) => deviceStatus(dev(s, id));

test('keadaan awal sama dengan desain', () => {
  expect(init.place).toBe('Semua');
  expect(dev(init, 'ac-kamar')).toMatchObject({ on: true, ac: { temp: 24, mode: 'Dingin', fan: 'Otomatis' } });
  expect(pendingApproval(init)?.id).toBe(BUDI);
  expect(init.outgoing[BUDI]).toEqual({
    id: BUDI,
    to: 'Pak Budi',
    channel: 'WhatsApp',
    what: 'balasan',
    text: 'Selamat siang, Pak Budi. Untuk sewa tempatnya, kami bisa di harga Rp15 juta. Terima kasih.',
    status: 'draft',
    ask: 'Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?',
    heldUntil: '10.47',
    sentAt: '10.42',
  });
  expect(init.toast).toBeNull();
  expect(new Set(init.devices.map((d) => d.place))).toEqual(new Set(['Rumah', 'Kedai Dago', 'Kedai Riau']));
  for (const k of ['Kedai Dago', 'Kedai Riau']) {
    const ds = init.devices.filter((d) => d.place === k);
    expect(ds.length).toBeGreaterThanOrEqual(3);
    expect(ds.some((d) => d.kind === 'kamera')).toBe(true);
  }
});

test('setPlace', () => {
  expect(run([{ type: 'setPlace', place: 'Kedai Dago' }]).place).toBe('Kedai Dago');
});

test('tulisan keadaan perangkat dibuat dari data terstruktur (desain 2c)', () => {
  expect(status(init, 'lampu-utama')).toBe('Nyala · 80%');
  expect(status(init, 'lampu-sudut')).toBe('Tidak terjangkau sejak 10.12');
  expect(status(init, 'kamera-tamu')).toBe('Merekam');
  expect(status(init, 'pintu-depan')).toBe('Terkunci');
  expect(status(init, 'ac-kamar')).toBe('Nyala · 24°');
  expect(status(init, 'lampu-kamar')).toBe('Mati');
  expect(status(init, 'lampu-teras')).toBe('Nyala');
  expect(status(init, 'dago-ac')).toBe('Nyala · 23°');
  expect(status(init, 'riau-ac')).toBe('Mati');
  const s = run([
    { type: 'toggleDevice', id: 'pintu-depan', on: false },
    { type: 'toggleDevice', id: 'kamera-tamu', on: false },
  ]);
  expect(status(s, 'pintu-depan')).toBe('Terbuka');
  expect(status(s, 'kamera-tamu')).toBe('Mati');
  expect(init.devices.every((d) => !('status' in d))).toBe(true);
});

test('setAc mematikan AC, menyamakan perangkat, dan mencatat sumbernya', () => {
  const s = run([{ type: 'setAc', on: false, source: 'suara' }]);
  expect(dev(s, 'ac-kamar').on).toBe(false);
  expect(status(s, 'ac-kamar')).toBe('Mati');
  expect(s.history[0]).toMatchObject({
    day: 'Hari ini',
    kind: 'rumah',
    title: 'Mematikan AC kamar',
    sub: 'lewat suara · 10.41',
  });
  expect(s.history).toHaveLength(init.history.length + 1);
});

test('setAc tanpa perubahan tidak mencatat; atur suhu berkali-kali jadi satu catatan', () => {
  expect(run([{ type: 'setAc', on: true }])).toBe(init);
  const s = run([
    { type: 'setAc', temp: 23 },
    { type: 'setAc', temp: 22, mode: 'Kering' },
  ]);
  expect(dev(s, 'ac-kamar')).toMatchObject({ on: true, ac: { temp: 22, mode: 'Kering' } });
  expect(s.history.filter((h) => h.title === 'Mengatur AC kamar')).toHaveLength(1);
  expect(s.history[0]!.sub).toBe('22° · Kering · lewat aplikasi · 10.43');
  expect(status(s, 'ac-kamar')).toBe('Nyala · 22°');
});

test('setAc membatasi suhu 16–30 di penyimpanan', () => {
  expect(dev(run([{ type: 'setAc', temp: 40 }]), 'ac-kamar').ac!.temp).toBe(30);
  expect(dev(run([{ type: 'setAc', temp: 5 }]), 'ac-kamar').ac!.temp).toBe(16);
  expect(dev(run([{ type: 'setAc', temp: 22.6 }]), 'ac-kamar').ac!.temp).toBe(23);
  const top = run([{ type: 'setAc', temp: 30 }]);
  expect(run([{ type: 'setAc', temp: 31 }], top)).toBe(top);
});

test('setAc mengatur AC mana pun lewat deviceId; bukan AC atau tak terjangkau diabaikan', () => {
  const s = run([{ type: 'setAc', deviceId: 'dago-ac', temp: 21, fan: 'Kencang' }]);
  expect(dev(s, 'dago-ac').ac).toEqual({ temp: 21, mode: 'Dingin', fan: 'Kencang' });
  expect(dev(s, 'ac-kamar')).toBe(dev(init, 'ac-kamar'));
  expect(s.history[0]).toMatchObject({
    kind: 'usaha',
    title: 'Mengatur AC kedai',
    sub: 'Kedai Dago · 21° · Dingin · lewat aplikasi · 10.43',
  });
  // dua AC dengan nama sama tidak bergabung jadi satu catatan
  const both = run([{ type: 'setAc', deviceId: 'riau-ac', temp: 24 }], s);
  expect(both.history.filter((h) => h.title === 'Mengatur AC kedai')).toHaveLength(2);
  expect(run([{ type: 'setAc', deviceId: 'lampu-utama', on: false }])).toBe(init);
  expect(run([{ type: 'setAc', deviceId: 'tidak-ada', on: false }])).toBe(init);
  const unreachable = {
    ...init,
    devices: init.devices.map((d) => (d.id === 'dago-ac' ? { ...d, reachable: false } : d)),
  };
  expect(run([{ type: 'setAc', deviceId: 'dago-ac', on: false }], unreachable)).toBe(unreachable);
});

test('mati lalu nyala lagi memakai terang dan suhu yang sama', () => {
  const lamp = run([
    { type: 'toggleDevice', id: 'lampu-utama', on: false },
    { type: 'toggleDevice', id: 'lampu-utama', on: true },
  ]);
  expect(status(lamp, 'lampu-utama')).toBe('Nyala · 80%');
  const ac = run([
    { type: 'toggleDevice', id: 'dago-ac', on: false },
    { type: 'toggleDevice', id: 'dago-ac', on: true },
  ]);
  expect(status(ac, 'dago-ac')).toBe('Nyala · 23°');
  expect(ac.history.slice(0, 2).map((h) => h.title)).toEqual(['Menyalakan AC kedai', 'Mematikan AC kedai']);
  const kamar = run([
    { type: 'setAc', on: false },
    { type: 'setAc', temp: 20 },
    { type: 'setAc', on: true },
  ]);
  expect(status(kamar, 'ac-kamar')).toBe('Nyala · 20°');
});

test('toggleDevice: lampu, kunci, AC, dan perangkat tak terjangkau', () => {
  let s = run([{ type: 'toggleDevice', id: 'lampu-utama', on: false }]);
  expect(dev(s, 'lampu-utama')).toMatchObject({ on: false, level: 80 });
  expect(status(s, 'lampu-utama')).toBe('Mati');
  expect(s.history[0]).toMatchObject({
    title: 'Mematikan lampu utama',
    kind: 'rumah',
    sub: 'Rumah · lewat aplikasi · 10.43',
  });
  s = run([{ type: 'toggleDevice', id: 'pintu-depan', on: false }]);
  expect(s.history[0]!.title).toBe('Membuka pintu depan');
  s = run([{ type: 'toggleDevice', id: 'dago-lampu', on: false }]);
  expect(s.history[0]).toMatchObject({ kind: 'usaha' });
  s = run([{ type: 'toggleDevice', id: 'ac-kamar', on: false }]);
  expect(dev(s, 'ac-kamar').on).toBe(false);
  expect(s.history[0]).toMatchObject({ title: 'Mematikan AC kamar', sub: 'lewat aplikasi · 10.43' });
  expect(run([{ type: 'toggleDevice', id: 'lampu-sudut', on: true }])).toBe(init);
  expect(run([{ type: 'toggleDevice', id: 'tidak-ada', on: true }])).toBe(init);
});

test('kartu Rumah Beranda diturunkan dari perangkat', () => {
  expect(houseCard(init).map((r) => r.text)).toEqual(['AC kamar nyala · 24°', 'Pintu depan terkunci', 'Kamera aktif']);
  const s = run([
    { type: 'setAc', temp: 26 },
    { type: 'toggleDevice', id: 'pintu-depan', on: false },
    { type: 'toggleDevice', id: 'kamera-tamu', on: false },
  ]);
  expect(houseCard(s).map((r) => r.text)).toEqual(['AC kamar nyala · 26°', 'Pintu depan terbuka', 'Kamera mati']);
  expect(houseCard(run([{ type: 'setAc', on: false }]))[0]!.text).toBe('AC kamar mati');
});

test('sendDraft: tertahan, kartu persetujuan hilang, entri Riwayat bisa dibatalkan sampai 10.47', () => {
  const s = run([{ type: 'sendDraft', id: BUDI }]);
  expect(s.outgoing[BUDI]!.status).toBe('held');
  expect(pendingApproval(s)).toBeNull();
  expect(s.history[0]).toEqual({
    id: expect.any(String),
    day: 'Hari ini',
    time: '10.42',
    kind: 'pesan',
    icon: 'chat',
    title: 'Mengirim balasan ke Pak Budi',
    sub: 'disetujui Anda 10.42',
    outgoingId: BUDI,
  });
  expect(historyRows(s)[0]).toMatchObject({ undoable: true, struck: false, until: '10.47' });
  expect(
    historyRows(s)
      .slice(1)
      .every((h) => !h.undoable && !h.struck),
  ).toBe(true);
  expect(
    run([
      { type: 'sendDraft', id: BUDI },
      { type: 'sendDraft', id: BUDI },
    ]).history,
  ).toHaveLength(s.history.length);
  expect(run([{ type: 'sendDraft', id: 'tidak-ada' }])).toBe(init);
});

test('editDraft hanya saat masih draf; teks kosong diabaikan', () => {
  expect(run([{ type: 'editDraft', id: BUDI, text: '  Halo  ' }]).outgoing[BUDI]!.text).toBe('Halo');
  expect(run([{ type: 'editDraft', id: BUDI, text: '   ' }])).toBe(init);
  const sent = run([
    { type: 'sendDraft', id: BUDI },
    { type: 'editDraft', id: BUDI, text: 'Lain' },
  ]);
  expect(sent.outgoing[BUDI]!.text).toBe(init.outgoing[BUDI]!.text);
});

test('cancelSend hanya dari held: entri tercoret tanpa Batalkan, toast', () => {
  expect(run([{ type: 'cancelSend', id: BUDI }])).toBe(init);
  const s = run([
    { type: 'sendDraft', id: BUDI },
    { type: 'cancelSend', id: BUDI },
  ]);
  expect(s.outgoing[BUDI]!.status).toBe('cancelled');
  expect(s.toast?.text).toBe('Kiriman ke Pak Budi dibatalkan.');
  expect(historyRows(s)[0]).toMatchObject({ struck: true, undoable: false, title: 'Mengirim balasan ke Pak Budi' });
  expect(historyRows(s)[0]!.until).toBeUndefined();
  expect(
    run([
      { type: 'sendDraft', id: BUDI },
      { type: 'cancelSend', id: BUDI },
      { type: 'cancelSend', id: BUDI },
    ]),
  ).toEqual(s);
});

test('addDraft: draf kedua ke supplier dengan id baru (kartu di chat dibuat server tiruan)', () => {
  const s = run([{ type: 'addDraft', draft: supplierOrderDraft }]);
  const d = draftFor(s, 'PT Sumber Susu')!;
  expect(d).toMatchObject({
    to: 'PT Sumber Susu',
    what: 'pesanan',
    status: 'draft',
    sentAt: '10.43',
    heldUntil: '10.48',
    text: supplierOrderDraft.text,
  });
  expect(d.id).not.toBe(BUDI);
  expect(Object.keys(s.outgoing)).toEqual([BUDI, d.id]);
  // tidak ada yang terkirim sebelum Kirim
  expect(s.history).toBe(init.history);
  // Beranda tetap menanyakan Pak Budi lebih dulu; setelah itu draf supplier
  expect(pendingApproval(s)?.id).toBe(BUDI);
  const next = run([{ type: 'sendDraft', id: BUDI }], s);
  expect(approvalText(pendingApproval(next)!)).toBe('Pesanan untuk PT Sumber Susu sudah siap. Kirim?');

  const sent = run([{ type: 'sendDraft', id: d.id }], s);
  expect(sent.history[0]).toMatchObject({
    title: 'Mengirim pesanan ke PT Sumber Susu',
    kind: 'usaha',
    outgoingId: d.id,
  });
  expect(draftFor(sent, 'PT Sumber Susu')).toBeNull();
  // kiriman lain tidak ikut berubah
  expect(sent.outgoing[BUDI]).toBe(init.outgoing[BUDI]);
});

test('discardDraft: hanya draf yang belum disetujui; menjadi dibatalkan tanpa entri Riwayat', () => {
  const s = run([{ type: 'discardDraft', id: BUDI }]);
  expect(s.outgoing[BUDI]!.status).toBe('cancelled');
  expect(s.history).toBe(init.history);
  expect(pendingApproval(s)).toBeNull();
  expect(run([{ type: 'discardDraft', id: 'tidak-ada' }])).toBe(init);
  const held = run([{ type: 'sendDraft', id: BUDI }]);
  expect(run([{ type: 'discardDraft', id: BUDI }], held)).toBe(held);
});

test('addAgenda: id baru, tampil di tanggalnya, dicatat; hari ini masuk Beranda', () => {
  const s = run([
    {
      type: 'addAgenda',
      item: { date: '2025-10-25', time: '09.00', title: 'Beli kado ulang tahun', kind: 'reminder', way: 'alarm' },
    },
    { type: 'addAgenda', item: { date: '2025-10-20', time: '08.00', title: 'Telepon Ibu', kind: 'reminder' } },
  ]);
  const added = agendaOn(s, '2025-10-25').find((a) => a.title === 'Beli kado ulang tahun')!;
  expect(added.id).toBeTruthy();
  expect(new Set(s.agenda.map((a) => a.id)).size).toBe(s.agenda.length);
  expect(homeAgenda(s).some((a) => a.title === 'Telepon Ibu')).toBe(true);
  expect(homeAgenda(s).some((a) => a.id === added.id)).toBe(false);
  expect(init.agenda.every((a) => !('home' in a))).toBe(true);
  expect(s.history[0]).toMatchObject({ title: 'Menambah ke agenda', sub: 'Telepon Ibu · 08.00' });
  expect(agendaOn(s, '2025-10-20').map((a) => a.time)).toEqual(
    [...agendaOn(s, '2025-10-20').map((a) => a.time)].sort(),
  );
});

test('snooze, toggleTask, finishLeftover', () => {
  let s = run([{ type: 'snooze', id: 'a4', until: '07.10' }]);
  expect(s.agenda.find((a) => a.id === 'a4')!.snoozedUntil).toBe('07.10');
  s = run([{ type: 'toggleTask', id: 'a3' }]);
  expect(s.agenda.find((a) => a.id === 'a3')!.done).toBe(true);
  s = reduce(s, { type: 'toggleTask', id: 'a3' });
  expect(s.agenda.find((a) => a.id === 'a3')!.done).toBe(false);
  // hanya tugas yang bisa dicentang
  expect(run([{ type: 'toggleTask', id: 'a1' }]).agenda.find((a) => a.id === 'a1')!.done).toBeUndefined();

  const title = init.leftover!.title;
  s = run([{ type: 'finishLeftover', choice: 'today' }]);
  expect(s.leftover).toBeNull();
  expect(agendaOn(s, '2025-10-20').some((a) => a.title === title && a.kind === 'task')).toBe(true);
  // tugas ada di layar Agenda, bukan di kartu Beranda
  expect(homeAgenda(s).some((a) => a.title === title)).toBe(false);
  s = run([{ type: 'finishLeftover', choice: 'drop' }]);
  expect(s.leftover).toBeNull();
  expect(s.agenda).toHaveLength(init.agenda.length);
  expect(reduce(s, { type: 'finishLeftover', choice: 'today' })).toBe(s);
});

test('cincin diturunkan dari layanan dan perangkat: tujuh simpul desain 1a, CCTV dari Imou', () => {
  expect(ringNodes(init)).toEqual([
    { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
    { key: 'gmail', icon: 'mail', label: 'Gmail' },
    { key: 'wa', icon: 'chat', label: 'WhatsApp' },
    { key: 'ac', icon: 'snow', label: 'AC kamar' },
    { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
    { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
    { key: 'bank', icon: 'bank', label: 'Bank' },
  ]);
  // keterjangkauan hanya dari sumbernya
  const imouBack = {
    ...init,
    services: init.services.map((x) => (x.id === 'imou' ? { ...x, reachable: true } : x)),
  };
  expect(ringNodes(imouBack).find((n) => n.key === 'cctv')!.offline).toBeUndefined();
  const acGone = { ...init, devices: init.devices.map((d) => (d.id === 'ac-kamar' ? { ...d, reachable: false } : d)) };
  expect(ringNodes(acGone).find((n) => n.key === 'ac')!.offline).toBe(true);
  // isi sama = larik sama, supaya cincin tidak mulai ulang
  const a = ringNodes(init);
  expect(ringNodes(run([{ type: 'setPlace', place: 'Kedai Dago' }]))).toBe(a);
  expect(ringNodes(run([{ type: 'setAc', temp: 20 }]))).toBe(a);
});

test('tulisan keadaan layanan diturunkan dari keterjangkauannya (desain 2h)', () => {
  const st = (id: string) => serviceStatus(init.services.find((x) => x.id === id)!);
  expect(st('gcal')).toBe('Aktif · terakhir dibaca 5 menit lalu');
  expect(st('wa')).toBe('Aktif · pesan masuk langsung terbaca');
  expect(st('kotak')).toBe('Aktif · di ruang tamu');
  expect(st('imou')).toBe('Tidak terjangkau sejak 10.12');
});

test('connect menambah layanan dan simpul cincin kedelapan; disconnect mengembalikannya', () => {
  const s = run([{ type: 'connect', id: 'tiktok' }]);
  expect(ringNodes(s)).toHaveLength(8);
  expect(ringNodes(s).at(-1)).toEqual({ key: 'tiktok', icon: 'bag', label: 'TikTok Shop' });
  expect(ringNodes(s).slice(0, 7)).toEqual(ringNodes(init));
  const tiktok = s.services.find((x) => x.id === 'tiktok')!;
  expect(tiktok).toMatchObject({ reachable: true, permission: 'read' });
  expect(serviceStatus(tiktok)).toBe('Aktif · baru tersambung');
  expect(s.history[0]!.title).toBe('Menyambungkan TikTok Shop & Tokopedia');
  expect(
    run([
      { type: 'connect', id: 'tiktok' },
      { type: 'connect', id: 'tiktok' },
    ]),
  ).toEqual(s);
  expect(run([{ type: 'connect', id: 'tidak-ada' }])).toBe(init);
  const back = run([{ type: 'disconnect', id: 'tiktok' }], s);
  expect(ringNodes(back)).toEqual(ringNodes(init));
  expect(back.services).toEqual(init.services);
  expect(back.history[0]!.title).toBe('Memutus TikTok Shop & Tokopedia');
  const noRing = run([{ type: 'disconnect', id: 'kotak' }]);
  expect(ringNodes(noRing)).toHaveLength(7);
  expect(noRing.services.some((x) => x.id === 'kotak')).toBe(false);
  expect(run([{ type: 'disconnect', id: 'cctv-lain' }])).toBe(init);
});

test('memutus layanan bersimpul menghapus simpulnya; menyambung lagi mengembalikannya ke tempat semula', () => {
  const off = run([{ type: 'disconnect', id: 'imou' }]);
  expect(ringNodes(off).map((n) => n.key)).toEqual(['gcal', 'gmail', 'wa', 'ac', 'kasir', 'bank']);
  const again = run([{ type: 'connect', id: 'imou' }], off);
  expect(ringNodes(again).map((n) => n.key)).toEqual(['gcal', 'gmail', 'wa', 'ac', 'cctv', 'kasir', 'bank']);
  // tersambung lagi berarti terjangkau
  expect(ringNodes(again).find((n) => n.key === 'cctv')!.offline).toBeUndefined();
  expect(serviceStatus(again.services.find((x) => x.id === 'imou')!)).toBe('Aktif · baru tersambung');
});

test('forget dan setPermission', () => {
  const s = run([{ type: 'forget', id: 'gmail' }]);
  expect(s.forgotten).toEqual(['gmail']);
  expect(s.history[0]!.title).toBe('Menghapus yang saya tahu dari Gmail');
  expect(
    run([
      { type: 'forget', id: 'gmail' },
      { type: 'forget', id: 'gmail' },
    ]).history,
  ).toHaveLength(s.history.length);
  const p = run([{ type: 'setPermission', id: 'moka', permission: 'act' }]);
  expect(p.services.find((x) => x.id === 'moka')!.permission).toBe('act');
  expect(p.services.find((x) => x.id === 'gmail')).toEqual(init.services.find((x) => x.id === 'gmail'));
  expect(p.history[0]).toMatchObject({ kind: 'lainnya', title: 'Mengubah izin Moka', sub: 'boleh bertindak · 10.43' });
  const back = run([{ type: 'setPermission', id: 'moka', permission: 'read' }], p);
  expect(back.history[0]).toMatchObject({ title: 'Mengubah izin Moka', sub: 'hanya membaca · 10.43' });
  expect(run([{ type: 'setPermission', id: 'moka', permission: 'read' }])).toBe(init);
  expect(run([{ type: 'setPermission', id: 'tidak-ada', permission: 'act' }])).toBe(init);
});

test('kejadian di luar filter masuk jenis lainnya: tidak tampil di Pesan, tetap di Semua', () => {
  const s = run([
    { type: 'connect', id: 'tiktok' },
    { type: 'disconnect', id: 'gmail' },
    { type: 'forget', id: 'moka' },
    { type: 'setPermission', id: 'bca', permission: 'act' },
    { type: 'addAgenda', item: { date: '2025-10-22', time: '10.00', title: 'Servis motor', kind: 'task' } },
    { type: 'sendDraft', id: BUDI },
  ]);
  const added = s.history.slice(0, 6);
  expect(added.map((h) => h.kind)).toEqual(['pesan', 'lainnya', 'lainnya', 'lainnya', 'lainnya', 'lainnya']);
  expect(historyRows(s, 'pesan').map((h) => h.title)).toEqual([
    'Mengirim balasan ke Pak Budi',
    'Mencatat rapat supplier',
    'Mengingatkan rapat dengan supplier susu',
  ]);
  expect(historyRows(s)).toHaveLength(init.history.length + 6);
  // entri contoh tetap sama
  expect(s.history.slice(6)).toEqual(init.history);
});

test('toast, onboarding', () => {
  const one = run([{ type: 'showToast', text: 'Halo' }]);
  expect(one.toast).toEqual({ id: expect.any(Number), text: 'Halo' });
  expect(run([{ type: 'hideToast' }], one).toast).toBeNull();
  // teks yang sama dua kali tetap toast baru
  const two = run([{ type: 'showToast', text: 'Halo' }], one);
  expect(two.toast!.text).toBe('Halo');
  expect(two.toast!.id).not.toBe(one.toast!.id);
  // menutup toast lama tidak menutup yang baru
  expect(run([{ type: 'hideToast', id: one.toast!.id }], two)).toBe(two);
  expect(run([{ type: 'hideToast', id: two.toast!.id }], two).toast).toBeNull();
  expect(run([{ type: 'hideToast' }])).toBe(init);
  expect(run([{ type: 'finishOnboarding' }]).onboarded).toBe(true);
});

test('homeAgenda: paling banyak tiga item hari ini urut jam, tanpa tugas', () => {
  expect(homeAgenda(init).map((a) => a.time)).toEqual(['09.00', '13.00', '16.00']);
  expect(homeAgenda(init).some((a) => a.kind === 'task')).toBe(false);
  const early = run([
    { type: 'addAgenda', item: { date: '2025-10-20', time: '07.00', title: 'Olahraga', kind: 'reminder' } },
  ]);
  expect(homeAgenda(early).map((a) => a.time)).toEqual(['07.00', '09.00', '13.00']);
});
