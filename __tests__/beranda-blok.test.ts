import type { AgendaItem, Device } from '@/api/contract';
import { contactInitial, nextAgenda, pickFavorites, stateWord, suggestionFor, SUGGESTIONS } from '@/ui/beranda/blocks';

const item = (p: Partial<AgendaItem> & Pick<AgendaItem, 'id' | 'date' | 'time'>): AgendaItem => ({
  title: `Butir ${p.id}`,
  kind: 'reminder',
  at: '2025-10-20T00:00:00.000Z',
  ...p,
});

const device = (p: Partial<Device> & Pick<Device, 'id' | 'kind'>): Device => ({
  place: 'Rumah',
  room: 'Kamar',
  name: p.id,
  icon: 'bulb',
  on: true,
  reachable: true,
  capabilities: [{ type: 'power' }],
  state: {},
  status: 'Nyala',
  ...p,
});

describe('agenda berikutnya', () => {
  const today = '2025-10-20';
  const items = [
    item({ id: 'lewat', date: today, time: '09.00' }),
    item({ id: 'tugas', date: today, time: '11.00', kind: 'task' }),
    item({ id: 'selesai', date: today, time: '11.30', done: true }),
    item({ id: 'seharian', date: today, time: '00.00', allDay: true }),
    item({ id: 'siang', date: today, time: '13.00' }),
    item({ id: 'sore', date: today, time: '16.00' }),
  ];

  test('yang paling dekat dalam 12 jam, tanpa tugas, yang selesai, atau sepanjang hari', () => {
    expect(nextAgenda({ items, today, homeToday: [] }, '10.42')).toMatchObject({ id: 'siang', time: '13.00', day: 0 });
  });

  test('yang sudah mulai tetap tampil 15 menit, lalu berganti', () => {
    expect(nextAgenda({ items, today, homeToday: [] }, '13.15')?.id).toBe('siang');
    expect(nextAgenda({ items, today, homeToday: [] }, '13.16')?.id).toBe('sore');
  });

  test('lebih dari 12 jam lagi: tidak ada blok', () => {
    expect(
      nextAgenda({ items: [item({ id: 'besok', date: '2025-10-21', time: '09.00' })], today, homeToday: [] }, '08.00'),
    ).toBeNull();
  });

  test('besok pagi masih dalam 12 jam: ditandai besok', () => {
    const late = [item({ id: 'pagi', date: '2025-10-21', time: '07.00' })];
    expect(nextAgenda({ items: late, today, homeToday: [] }, '21.30')).toMatchObject({ id: 'pagi', day: 1 });
  });

  test('agenda belum dimuat: memakai agenda hari ini dari Beranda', () => {
    const homeToday = [
      { id: 'h1', time: '09.30', title: 'Telepon vendor', kind: 'reminder' },
      { id: 'h2', time: '10.00', title: 'Cek', kind: 'task' },
    ];
    expect(nextAgenda({ items: [], today: null, homeToday }, '08.00')).toMatchObject({ title: 'Telepon vendor' });
  });

  test('butir yang selesai di agenda tidak muncul lagi lewat salinan Beranda', () => {
    const homeToday = [{ id: 'selesai', time: '11.30', title: 'Butir selesai', kind: 'reminder' }];
    expect(nextAgenda({ items, today, homeToday }, '11.00')?.id).toBe('siang');
  });
});

describe('sakelar favorit', () => {
  const list = [
    device({ id: 'kotak', kind: 'box', capabilities: [] }),
    device({ id: 'sensor', kind: 'sensor', capabilities: [{ type: 'battery' }] }),
    device({ id: 'kunci', kind: 'lock', capabilities: [{ type: 'lock' }], sensitive: true }),
    device({ id: 'lampu', kind: 'lamp', lastUsedAt: '2025-10-20T01:00:00.000Z' }),
    device({ id: 'ac', kind: 'ac', lastUsedAt: '2025-10-20T03:00:00.000Z' }),
    device({ id: 'tv', kind: 'tv' }),
    device({ id: 'kipas', kind: 'fan', lastUsedAt: '2025-10-20T02:00:00.000Z' }),
  ];

  test('belum ada favorit: tiga yang terakhir diatur, tanpa Kotak, sensor, atau yang dijaga', () => {
    expect(pickFavorites(list).map((d) => d.id)).toEqual(['ac', 'kipas', 'lampu']);
  });

  test('yang disematkan pengguna menang, termasuk yang dijaga', () => {
    const pinned = list.map((d) => (d.id === 'kunci' || d.id === 'tv' ? { ...d, favorite: true } : d));
    expect(pickFavorites(pinned).map((d) => d.id)).toEqual(['kunci', 'tv']);
  });

  test('satu kata keadaan', () => {
    expect(stateWord(device({ id: 'a', kind: 'ac', state: { temp: 24 } }))).toBe('24°');
    expect(stateWord(device({ id: 'a', kind: 'ac', on: false, state: { temp: 24 } }))).toBe('Mati');
    expect(stateWord(device({ id: 'l', kind: 'lamp' }))).toBe('Nyala');
    expect(stateWord(device({ id: 'k', kind: 'lock' }))).toBe('Terkunci');
    expect(stateWord(device({ id: 'k', kind: 'lock', on: false }))).toBe('Terbuka');
    expect(stateWord(device({ id: 'x', kind: 'lamp', reachable: false }))).toBe('Terputus');
  });
});

test('inisial penerima tanpa sapaan hormat', () => {
  expect(contactInitial('Pak Budi')).toBe('B');
  expect(contactInitial('Bu Sari')).toBe('S');
  expect(contactInitial('PT Sumber Susu')).toBe('S');
  expect(contactInitial('rina')).toBe('R');
});

test('contoh kalimat berganti tiap hari dan berputar', () => {
  const days = ['2025-10-20', '2025-10-21', '2025-10-22', '2025-10-23', '2025-10-24'].map(suggestionFor);
  expect(new Set(days.slice(0, 4)).size).toBe(SUGGESTIONS.length);
  expect(days[4]).toBe(days[0]);
  expect(days[0]).toBe(SUGGESTIONS[0]);
});
