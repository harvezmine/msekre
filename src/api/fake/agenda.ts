import { NOW, TODAY } from '@/sample/agenda';
import { addDays, weekdayIndex } from '@/api/dates';
import type { SampleState } from '@/sample/reducer';
import type { AgendaItem as SampleItem, Leftover } from '@/sample/types';
import type { AgendaItem, AgendaNew, AgendaParseRes } from '../contract';
import { wibIsoOf } from './clock';
import { parseAgenda } from './parseAgenda';

/** Id pesan notulen contoh yang ditautkan rapat bernotulen siap. */
export const SAMPLE_NOTES_MESSAGE_ID = 'notulen-contoh';

/** Item penyimpanan contoh → item kontrak (jam dinding WIB di data contoh; `at` dihitung dari sana). */
export function toContractItem(a: SampleItem): AgendaItem {
  const notes = a.note === 'Notulen siap';
  return {
    id: a.id,
    ...(a.seriesId ? { seriesId: a.seriesId } : {}),
    date: a.date,
    time: a.time,
    at: wibIsoOf(a.date, a.time),
    title: a.title,
    kind: a.kind,
    ...(a.way ? { way: a.way } : {}),
    ...(a.repeat ? { repeat: a.repeat } : {}),
    ...(a.note && !notes ? { note: a.note } : {}),
    ...(notes ? { notesMessageId: SAMPLE_NOTES_MESSAGE_ID } : {}),
    ...(a.done ? { done: true } : {}),
    // Tundaan disimpan sebagai ISO (lewat tengah malam tetap benar); data contoh lama memakai jam "HH.MM".
    ...(a.snoozedUntil
      ? { snoozedUntil: a.snoozedUntil.includes('T') ? a.snoozedUntil : wibIsoOf(a.date, a.snoozedUntil) }
      : {}),
  };
}

/** Sisa tugas kemarin: tugas kemarin sore yang belum selesai. */
export function leftoverItem(l: Leftover): AgendaItem {
  const date = addDays(TODAY, -1);
  return { id: l.id, date, time: '17.00', at: wibIsoOf(date, '17.00'), title: l.title, kind: 'task' };
}

/** Rentang bawaan `GET /agenda`: Senin pekan ini sampai Minggu pekan depan. */
export function defaultRange(today = TODAY): { from: string; to: string } {
  const monday = addDays(today, -weekdayIndex(today));
  return { from: monday, to: addDays(monday, 13) };
}

/** Item dalam rentang (kedua ujung termasuk), urut tanggal lalu jam. */
export function agendaIn(state: SampleState, from: string, to: string): AgendaItem[] {
  return state.agenda
    .filter((a) => a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .map(toContractItem);
}

export function leftoverOf(state: SampleState): AgendaItem | null {
  return state.leftover ? leftoverItem(state.leftover) : null;
}

/** "Hari ini" dan jam sekarang di server tiruan: tetap pada hari contoh. */
export const FAKE_TODAY = TODAY;
export const FAKE_NOW = NOW;

/** Pratinjau dari kalimat bebas. Teks yang tidak berisi apa pun: `null`. */
export function previewOf(text: string): AgendaParseRes | null {
  const p = parseAgenda(text);
  if (!p) return null;
  const item: AgendaNew = {
    date: p.date,
    time: p.time,
    at: wibIsoOf(p.date, p.time),
    title: p.title,
    kind: p.kind,
    ...(p.way ? { way: p.way } : {}),
  };
  return { preview: { item, guessedTime: p.timeGuessed } };
}

/** Zona waktu pengguna di server tiruan: WIB. */
export const FAKE_TZ_MINUTES = 420;
