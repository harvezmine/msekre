import { TODAY } from './agenda';
import { addDays, dayLabel, isoDate } from './dates';
import type { AgendaItem } from './types';

export interface ParsedAgenda {
  kind: 'reminder' | 'task';
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** "Sabtu, 25 Okt" */
  dateLabel: string;
  /** HH.MM */
  time: string;
  /** Jam tidak disebut, jadi bawaan 09.00. */
  timeGuessed: boolean;
  way?: 'alarm';
}

const pad = (n: number) => String(n).padStart(2, '0');

function hour24(h: number, part: string | undefined): number {
  switch (part?.toLowerCase()) {
    case 'siang':
      return h >= 1 && h <= 6 ? h + 12 : h;
    case 'sore':
      return h < 12 ? h + 12 : h;
    case 'malam':
      if (h === 12) return 0;
      return h >= 6 && h < 12 ? h + 12 : h;
    default:
      return h;
  }
}

/**
 * Pengurai contoh sederhana untuk lembar Tambah (Fase 0b). Mengenali "ingatkan", "tanggal N" (Oktober),
 * "besok", "lusa", "hari ini", dan "jam N" / "jam N.MM" / "jam N:MM" dengan pagi/siang/sore/malam.
 * Pengurai sungguhan datang dari server di fase berikutnya.
 */
export function parseAgenda(input: string): ParsedAgenda | null {
  let rest = input.trim();
  if (!rest) return null;

  const kind: ParsedAgenda['kind'] = /\bingatkan\b/i.test(rest) ? 'reminder' : 'task';
  rest = rest.replace(/\bingatkan(\s+(saya|aku))?\b/gi, ' ');

  let date = TODAY;
  const tgl = /\b(?:(?:pada|di)\s+)?tanggal\s+(\d{1,2})\b/i.exec(rest);
  if (tgl && Number(tgl[1]) >= 1 && Number(tgl[1]) <= 31) {
    date = isoDate(2026, 10, Number(tgl[1]));
    rest = rest.replace(tgl[0], ' ');
  } else {
    const rel = /\b(besok|lusa|hari ini)\b/i.exec(rest);
    if (rel) {
      const word = rel[1]!.toLowerCase();
      date = word === 'besok' ? addDays(TODAY, 1) : word === 'lusa' ? addDays(TODAY, 2) : TODAY;
      rest = rest.replace(rel[0], ' ');
    }
  }

  let time = '09.00';
  let timeGuessed = true;
  const jam = /\b(?:(?:pada\s+)?(?:jam|pukul))\s+(\d{1,2})(?:[.:](\d{2}))?(?:\s*(pagi|siang|sore|malam))?\b/i.exec(
    rest,
  );
  if (jam) {
    const h = hour24(Number(jam[1]), jam[3]);
    const m = jam[2] ? Number(jam[2]) : 0;
    if (h <= 23 && m <= 59) {
      time = `${pad(h)}.${pad(m)}`;
      timeGuessed = false;
      rest = rest.replace(jam[0], ' ');
    }
  }

  let title = rest
    .replace(/^\s*tolong\b/i, ' ')
    .replace(/\s+(ya|dong|deh)\s*$/i, ' ')
    .replace(/\s+(pada|di|pukul|jam|untuk)\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');
  if (!title) title = kind === 'reminder' ? 'Pengingat baru' : 'Tugas baru';
  title = title[0]!.toUpperCase() + title.slice(1);

  return {
    kind,
    title,
    date,
    dateLabel: dayLabel(date),
    time,
    timeGuessed,
    way: kind === 'reminder' ? 'alarm' : undefined,
  };
}

export function toAgendaItem(p: ParsedAgenda): Omit<AgendaItem, 'id'> {
  return { date: p.date, time: p.time, title: p.title, kind: p.kind, ...(p.way ? { way: p.way } : {}) };
}
