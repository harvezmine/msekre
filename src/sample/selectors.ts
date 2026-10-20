import type { SampleState } from './reducer';
import type { AgendaItem } from './types';

/** Agenda satu tanggal, urut jam. */
export function agendaOn(state: SampleState, date: string): AgendaItem[] {
  return state.agenda.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
}
