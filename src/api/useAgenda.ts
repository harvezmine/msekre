import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAgendaControllerOptional } from './AgendaProvider';
import type { AgendaController, AgendaState } from './agendaController';
import type { AgendaItem } from './contract';

export interface AgendaApi extends AgendaState {
  /** Item satu tanggal, urut jam. */
  itemsOn: (date: string) => AgendaItem[];
  /** Tanggal yang punya agenda (untuk titik di kalender). */
  marked: ReadonlySet<string>;
  retry: AgendaController['load'];
  ensureRange: AgendaController['ensureRange'];
  item: AgendaController['item'];
  preview: AgendaController['preview'];
  add: AgendaController['add'];
  toggle: AgendaController['toggle'];
  setDone: AgendaController['setDone'];
  markDone: AgendaController['markDone'];
  snooze: AgendaController['snooze'];
  snoozeStrict: AgendaController['snoozeStrict'];
  resolveLeftover: AgendaController['resolveLeftover'];
  ackAlarm: AgendaController['ackAlarm'];
}

const NONE: AgendaState = {
  items: [],
  leftover: null,
  today: null,
  now: null,
  tzOffsetMinutes: null,
  ranges: [],
  status: 'loading',
  error: null,
  rev: 0,
};
const noSubscribe = () => () => {};
const noState = () => NONE;
const noError = async () => null;
const noLoad = async () => {};
const noItem = async () => null;
const noPreview: AgendaController['preview'] = async () => ({ ok: false, error: '' });
const noAck = async () => false;
const noStrict = async () => {
  throw new Error('Agenda belum siap');
};

/**
 * Agenda untuk layar: dari pengendali bersama di {@link AgendaProvider} (`GET /agenda`, event `agenda`). Sama di semua
 * mode (mode `akun` juga dari server asli). Di luar provider hasilnya kosong (`status: 'loading'`).
 */
export function useAgenda(): AgendaApi {
  const controller = useAgendaControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  const itemsOn = useCallback((date: string) => state.items.filter((i) => i.date === date), [state.items]);
  const marked = useMemo(() => new Set(state.items.map((i) => i.date)), [state.items]);
  return {
    ...state,
    itemsOn,
    marked,
    retry: controller?.load ?? noLoad,
    ensureRange: controller?.ensureRange ?? noError,
    item: controller?.item ?? noItem,
    preview: controller?.preview ?? noPreview,
    add: controller?.add ?? noError,
    toggle: controller?.toggle ?? noError,
    setDone: controller?.setDone ?? noError,
    markDone: controller?.markDone ?? noStrict,
    snooze: controller?.snooze ?? noError,
    snoozeStrict: controller?.snoozeStrict ?? noStrict,
    resolveLeftover: controller?.resolveLeftover ?? noError,
    ackAlarm: controller?.ackAlarm ?? noAck,
  };
}
