import { useEffect, useSyncExternalStore } from 'react';
import { findService } from './connections';
import type {
  ConnectFlow,
  ConnectionsController,
  ConnectionsState,
  DetailEntry,
  LoadStatus,
} from './connectionsController';
import { useConnectionsControllerOptional } from './ConnectionsProvider';
import type { Service } from './contract';

export interface ConnectionsApi {
  connected: Service[];
  catalog: Service[];
  formerly: Service[];
  status: LoadStatus;
  /** Teks ramah, kalau `status` `error`. */
  error: string | null;
  /** Muat ulang ("Coba lagi"). */
  retry: () => Promise<void>;
  /** Layanan `id` di daftar mana pun, atau `undefined`. */
  service: Service | undefined;
  /** Detail layanan `id` (kosong sebelum dimuat, atau tanpa `id`). */
  detail: DetailEntry | null;
  /** Tahap menyambungkan layanan `id`. */
  flow: ConnectFlow;
  connect: ConnectionsController['connect'];
  resetFlow: ConnectionsController['resetFlow'];
  handleCallback: ConnectionsController['handleCallback'];
  setPermission: ConnectionsController['setPermission'];
  forget: ConnectionsController['forget'];
  disconnect: ConnectionsController['disconnect'];
  /** Menghapus atau memutus layanan `id` sedang berjalan. */
  busy: { forget: boolean; disconnect: boolean };
  reloadDetail: () => Promise<void>;
}

const EMPTY: ConnectionsState = {
  list: { data: null, status: 'loading', error: null },
  details: {},
  flows: {},
  busy: new Set(),
};
const IDLE: ConnectFlow = { phase: 'idle', message: null };
const noSubscribe = () => () => {};
const noState = () => EMPTY;
const nothing = async () => {};
const noAction = async () => ({ ok: false as const, message: '' });

/**
 * Terhubung untuk layar: daftar (`GET /connections`, event `connection`) dan, kalau `id` diberikan, detail serta alur
 * menyambungkan layanan itu. Sama di mode `contoh` dan `server`. Di luar provider hasilnya kosong.
 */
export function useConnections(id?: string | null): ConnectionsApi {
  const controller = useConnectionsControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  useEffect(() => {
    void controller?.load();
  }, [controller]);
  useEffect(() => {
    if (id) void controller?.loadDetail(id);
  }, [controller, id]);
  const data = state.list.data;
  return {
    connected: data?.connected ?? [],
    catalog: data?.catalog ?? [],
    formerly: data?.formerly ?? [],
    status: state.list.status,
    error: state.list.error,
    retry: controller?.load ?? nothing,
    service: id ? findService(data, id) : undefined,
    detail: id ? (state.details[id] ?? null) : null,
    flow: (id && state.flows[id]) || IDLE,
    connect: controller?.connect ?? nothing,
    resetFlow: controller?.resetFlow ?? (() => {}),
    handleCallback: controller?.handleCallback ?? nothing,
    setPermission: controller?.setPermission ?? (async () => ({ ok: true })),
    forget: controller?.forget ?? (noAction as ConnectionsController['forget']),
    disconnect: controller?.disconnect ?? noAction,
    busy: { forget: !!id && state.busy.has(`forget:${id}`), disconnect: !!id && state.busy.has(`disconnect:${id}`) },
    reloadDetail: id && controller ? () => controller.loadDetail(id) : nothing,
  };
}
