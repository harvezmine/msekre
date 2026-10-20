import {
  initialSampleState as init,
  sampleReducer as reduce,
  agendaOn,
  type SampleAction,
  type SampleState,
} from '@/sample/store';

const run = (actions: SampleAction[], from: SampleState = init) => actions.reduce(reduce, from);

test('keadaan awal sama dengan desain', () => {
  expect(init.place).toBe('Semua');
  expect(init.ac).toEqual({ on: true, temp: 24, mode: 'Dingin', fan: 'Otomatis' });
  expect(init.ring).toHaveLength(7);
  expect(init.approvalPending).toBe(true);
  expect(init.outgoing).toMatchObject({
    to: 'Pak Budi',
    channel: 'WhatsApp',
    status: 'draft',
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

test('setAc mematikan AC, menyamakan perangkat, dan mencatat sumbernya', () => {
  const s = run([{ type: 'setAc', on: false, source: 'suara' }]);
  expect(s.ac.on).toBe(false);
  expect(s.devices.find((d) => d.id === 'ac-kamar')).toMatchObject({ on: false, status: 'Mati' });
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
  expect(s.ac).toMatchObject({ temp: 22, mode: 'Kering', on: true });
  expect(s.history.filter((h) => h.title === 'Mengatur AC kamar')).toHaveLength(1);
  expect(s.history[0]!.sub).toContain('22°');
  expect(s.devices.find((d) => d.id === 'ac-kamar')!.status).toBe('Nyala · 22°');
});

test('toggleDevice: lampu, kunci, AC, dan perangkat tak terjangkau', () => {
  let s = run([{ type: 'toggleDevice', id: 'lampu-utama', on: false }]);
  expect(s.devices.find((d) => d.id === 'lampu-utama')).toMatchObject({ on: false, status: 'Mati' });
  expect(s.history[0]).toMatchObject({ title: 'Mematikan lampu utama', kind: 'rumah' });
  s = run([{ type: 'toggleDevice', id: 'pintu-depan', on: false }]);
  expect(s.history[0]!.title).toBe('Membuka pintu depan');
  s = run([{ type: 'toggleDevice', id: 'dago-lampu', on: false }]);
  expect(s.history[0]).toMatchObject({ kind: 'usaha' });
  s = run([{ type: 'toggleDevice', id: 'ac-kamar', on: false }]);
  expect(s.ac.on).toBe(false);
  expect(s.history[0]!.title).toBe('Mematikan AC kamar');
  expect(run([{ type: 'toggleDevice', id: 'lampu-sudut', on: true }])).toBe(init);
  expect(run([{ type: 'toggleDevice', id: 'tidak-ada', on: true }])).toBe(init);
});

test('sendDraft: tertahan, kartu persetujuan hilang, entri Riwayat bisa dibatalkan', () => {
  const s = run([{ type: 'sendDraft' }]);
  expect(s.outgoing.status).toBe('held');
  expect(s.approvalPending).toBe(false);
  expect(s.history[0]).toMatchObject({
    kind: 'pesan',
    title: 'Mengirim balasan ke Pak Budi',
    sub: 'disetujui Anda 10.42',
    undoable: true,
  });
  expect(run([{ type: 'sendDraft' }, { type: 'sendDraft' }]).history).toHaveLength(s.history.length);
});

test('editDraft hanya saat masih draf', () => {
  expect(run([{ type: 'editDraft', text: 'Halo' }]).outgoing.text).toBe('Halo');
  const sent = run([{ type: 'sendDraft' }, { type: 'editDraft', text: 'Lain' }]);
  expect(sent.outgoing.text).toBe(init.outgoing.text);
});

test('cancelSend hanya dari held: mencoret entri, toast', () => {
  expect(run([{ type: 'cancelSend' }])).toBe(init);
  const s = run([{ type: 'sendDraft' }, { type: 'cancelSend' }]);
  expect(s.outgoing.status).toBe('cancelled');
  expect(s.toast).toBe('Kiriman ke Pak Budi dibatalkan.');
  expect(s.history[0]).toMatchObject({ struck: true, undoable: false, title: 'Mengirim balasan ke Pak Budi' });
  expect(run([{ type: 'sendDraft' }, { type: 'cancelSend' }, { type: 'cancelSend' }])).toEqual(s);
});

test('addAgenda: id baru, tampil di tanggalnya, dicatat; hari ini masuk Beranda', () => {
  const s = run([
    {
      type: 'addAgenda',
      item: { date: '2026-10-25', time: '09.00', title: 'Beli kado ulang tahun', kind: 'reminder', way: 'alarm' },
    },
    { type: 'addAgenda', item: { date: '2026-10-20', time: '18.00', title: 'Telepon Ibu', kind: 'reminder' } },
  ]);
  const added = agendaOn(s, '2026-10-25').find((a) => a.title === 'Beli kado ulang tahun')!;
  expect(added.id).toBeTruthy();
  expect(new Set(s.agenda.map((a) => a.id)).size).toBe(s.agenda.length);
  expect(s.agenda.find((a) => a.title === 'Telepon Ibu')!.home).toBe(true);
  expect(added.home).toBe(false);
  expect(s.history[0]).toMatchObject({ title: 'Menambah ke agenda', sub: 'Telepon Ibu · 18.00' });
  expect(agendaOn(s, '2026-10-20').map((a) => a.time)).toEqual(
    [...agendaOn(s, '2026-10-20').map((a) => a.time)].sort(),
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
  expect(agendaOn(s, '2026-10-20').some((a) => a.title === title && a.kind === 'task')).toBe(true);
  s = run([{ type: 'finishLeftover', choice: 'drop' }]);
  expect(s.leftover).toBeNull();
  expect(s.agenda).toHaveLength(init.agenda.length);
  expect(reduce(s, { type: 'finishLeftover', choice: 'today' })).toBe(s);
});

test('connect menambah layanan dan simpul cincin; disconnect mengembalikannya', () => {
  const s = run([{ type: 'connect', id: 'tiktok' }]);
  expect(s.ring).toHaveLength(8);
  expect(s.services.find((x) => x.id === 'tiktok')).toMatchObject({ reachable: true, permission: 'read' });
  expect(s.history[0]!.title).toBe('Menyambungkan TikTok Shop & Tokopedia');
  expect(
    run([
      { type: 'connect', id: 'tiktok' },
      { type: 'connect', id: 'tiktok' },
    ]),
  ).toEqual(s);
  expect(run([{ type: 'connect', id: 'tidak-ada' }])).toBe(init);
  const back = run([{ type: 'disconnect', id: 'tiktok' }], s);
  expect(back.ring).toEqual(init.ring);
  expect(back.services).toEqual(init.services);
  expect(back.history[0]!.title).toBe('Memutus TikTok Shop & Tokopedia');
  const noRing = run([{ type: 'disconnect', id: 'kotak' }]);
  expect(noRing.ring).toHaveLength(7);
  expect(noRing.services.some((x) => x.id === 'kotak')).toBe(false);
  expect(run([{ type: 'disconnect', id: 'cctv-lain' }])).toBe(init);
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
});

test('toast, onboarding', () => {
  expect(run([{ type: 'showToast', text: 'Halo' }]).toast).toBe('Halo');
  expect(run([{ type: 'showToast', text: 'Halo' }, { type: 'hideToast' }]).toast).toBeNull();
  expect(run([{ type: 'finishOnboarding' }]).onboarded).toBe(true);
});
