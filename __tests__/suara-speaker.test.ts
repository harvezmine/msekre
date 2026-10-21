import { CLIP_SLACK_MS, createSpeaker, UNKNOWN_CLIP_MS } from '@/voice/audio';
import { audio } from './audioMock';

beforeEach(() => audio.reset());

test('pemutaran gagal (status error) dianggap selesai, pemutar dilepas', () => {
  const speaker = createSpeaker();
  const done = jest.fn();
  speaker.play({ uri: 'a.wav' }, done);
  expect(audio.players).toHaveLength(1);
  audio.statusUpdate({ error: 'tidak bisa diputar' });
  expect(done).toHaveBeenCalledTimes(1);
  expect(audio.players[0]!.removed).toBe(true);
  // Kabar berikutnya dari pemutar yang sama tidak memanggil lagi.
  audio.statusUpdate({ didJustFinish: true });
  expect(done).toHaveBeenCalledTimes(1);
});

test('tidak ada kabar sama sekali: selesai setelah 60 detik', () => {
  const speaker = createSpeaker();
  const done = jest.fn();
  speaker.play({ uri: 'a.wav' }, done);
  jest.advanceTimersByTime(UNKNOWN_CLIP_MS - 1);
  expect(done).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(done).toHaveBeenCalledTimes(1);
  expect(audio.players[0]!.removed).toBe(true);
});

test('lama klip diketahui: batasnya lama klip ditambah 10 detik', () => {
  const speaker = createSpeaker();
  const done = jest.fn();
  speaker.play({ uri: 'a.wav' }, done);
  audio.statusUpdate({ duration: 5 });
  jest.advanceTimersByTime(5000 + CLIP_SLACK_MS - 1);
  expect(done).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(done).toHaveBeenCalledTimes(1);
});

test('klip diputar berurutan, satu pemutar pada satu waktu, tidak ada yang terpotong', () => {
  const speaker = createSpeaker();
  const order: string[] = [];
  speaker.play({ uri: 'satu.wav' }, () => order.push('satu'));
  speaker.play({ uri: 'dua.wav' }, () => order.push('dua'));
  expect(audio.players).toHaveLength(1);
  expect(audio.players[0]!.removed).toBe(false);
  audio.finishPlayback();
  expect(order).toEqual(['satu']);
  expect(audio.players).toHaveLength(2);
  expect(audio.players[0]!.removed).toBe(true);
  expect((audio.players[1]!.source as { uri: string }).uri).toBe('dua.wav');
  audio.finishPlayback();
  expect(order).toEqual(['satu', 'dua']);
});

test('stop membuang antrean tanpa memanggil onDone', () => {
  const speaker = createSpeaker();
  const done = jest.fn();
  speaker.play({ uri: 'satu.wav' }, done);
  speaker.play({ uri: 'dua.wav' }, done);
  speaker.stop();
  expect(audio.players[0]!.removed).toBe(true);
  expect(audio.players).toHaveLength(1);
  jest.advanceTimersByTime(UNKNOWN_CLIP_MS * 2);
  expect(done).not.toHaveBeenCalled();
});
