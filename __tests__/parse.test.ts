import { addMinutes, dayLabel, weekdayIndex } from '@/sample/dates';
import { parseAgenda } from '@/sample/parse';

test('Ingatkan saya bayar pajak motor tanggal 25', () => {
  expect(parseAgenda('Ingatkan saya bayar pajak motor tanggal 25')).toEqual({
    kind: 'reminder',
    title: 'Bayar pajak motor',
    date: '2026-10-25',
    dateLabel: 'Sabtu, 25 Okt',
    time: '09.00',
    timeGuessed: true,
    way: 'alarm',
  });
});

test('jam dengan menit dan bagian hari', () => {
  expect(parseAgenda('ingatkan saya telepon Pak Budi besok jam 3.30 sore')).toMatchObject({
    kind: 'reminder',
    title: 'Telepon Pak Budi',
    date: '2026-10-21',
    dateLabel: 'Selasa, 21 Okt',
    time: '15.30',
    timeGuessed: false,
  });
  expect(parseAgenda('Ingatkan saya minum obat jam 8 malam')).toMatchObject({ title: 'Minum obat', time: '20.00' });
  expect(parseAgenda('Ingatkan saya rapat jam 10:15 pagi')).toMatchObject({ time: '10.15', timeGuessed: false });
});

test('tanpa kata ingatkan jadi tugas, tanpa cara bunyi', () => {
  const p = parseAgenda('beli kado ulang tahun tanggal 28')!;
  expect(p).toMatchObject({ kind: 'task', title: 'Beli kado ulang tahun', dateLabel: 'Selasa, 28 Okt', time: '09.00' });
  expect(p.way).toBeUndefined();
});

test('tanpa tanggal berarti hari ini; kata pada/di sebelum tanggal ikut hilang', () => {
  expect(parseAgenda('Cek stok gudang jam 14.00')).toMatchObject({
    date: '2026-10-20',
    time: '14.00',
    title: 'Cek stok gudang',
  });
  expect(parseAgenda('Ingatkan bayar listrik pada tanggal 5')).toMatchObject({
    title: 'Bayar listrik',
    date: '2026-10-05',
  });
});

test('jam tidak masuk akal diabaikan; teks kosong tidak dibaca', () => {
  expect(parseAgenda('Ingatkan saya olahraga jam 27')).toMatchObject({ time: '09.00', timeGuessed: true });
  expect(parseAgenda('   ')).toBeNull();
  expect(parseAgenda('Ingatkan saya')).toMatchObject({ title: 'Pengingat baru' });
});

test('hari dihitung dari kalender contoh', () => {
  expect(dayLabel('2026-10-20')).toBe('Senin, 20 Okt');
  expect(weekdayIndex('2026-10-01')).toBe(2);
  expect(addMinutes('23.55', 10)).toBe('00.05');
  expect(addMinutes('07.00', 10)).toBe('07.10');
});
