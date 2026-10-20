import { HOME_CARD_DEVICES, houseLine } from './devices';
import type { SampleState } from './reducer';
import type { AgendaItem, Device, HistoryEntry, HistoryKind, Outgoing } from './types';

export { AC_MAX, AC_MIN, deviceStatus, houseLine, MAIN_AC_ID } from './devices';

export function deviceById(state: SampleState, id: string): Device | undefined {
  return state.devices.find((d) => d.id === id);
}

/** Baris kartu Rumah di Beranda, dari keadaan perangkatnya: "AC kamar nyala · 24°", "Pintu depan terkunci". */
export function houseCard(state: SampleState): { device: Device; text: string }[] {
  return HOME_CARD_DEVICES.flatMap((id) => {
    const device = deviceById(state, id);
    return device ? [{ device, text: houseLine(device) }] : [];
  });
}

/** Agenda satu tanggal, urut jam. */
export function agendaOn(state: SampleState, date: string): AgendaItem[] {
  return state.agenda.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

/** Draf tertua yang masih menunggu persetujuan, untuk kartu "Butuh persetujuan Anda" di Beranda. */
export function pendingApproval(state: SampleState): Outgoing | null {
  return Object.values(state.outgoing).find((o) => o.status === 'draft') ?? null;
}

/** Kalimat kartu persetujuan: "Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?". */
export function approvalText(o: Outgoing): string {
  return o.ask ?? `${o.what[0]!.toUpperCase()}${o.what.slice(1)} untuk ${o.to} sudah siap. Kirim?`;
}

/** Draf terbaru ke penerima ini yang belum disetujui, supaya "Pesan lagi" tidak membuat draf kembar. */
export function draftFor(state: SampleState, to: string): Outgoing | null {
  return (
    Object.values(state.outgoing)
      .filter((o) => o.to === to && o.status === 'draft')
      .at(-1) ?? null
  );
}

export interface HistoryRow extends HistoryEntry {
  /** Kiriman masih tertahan: tampilkan Batalkan. */
  undoable: boolean;
  /** Kiriman dibatalkan: entri dicoret. */
  struck: boolean;
  /** Batas Batalkan, untuk "sampai 10.47". */
  until?: string;
}

/** Entri Riwayat, terbaru di atas, dengan Batalkan dan coretan dari status kirimannya. `kind` menyaring satu jenis. */
export function historyRows(state: SampleState, kind?: HistoryKind): HistoryRow[] {
  return state.history
    .filter((h) => !kind || h.kind === kind)
    .map((h) => {
      const o = h.outgoingId ? state.outgoing[h.outgoingId] : undefined;
      return {
        ...h,
        undoable: o?.status === 'held',
        struck: o?.status === 'cancelled',
        ...(o?.status === 'held' ? { until: o.heldUntil } : {}),
      };
    });
}
