import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { OrbitNode } from '@/ui/orbit/types';
import { initialAgenda, initialLeftover, TODAY } from './agenda';
import { deviceStatus, initialDevices } from './devices';
import { initialBusiness, initialHistory } from './history';
import { initialOutgoing } from './profile';
import { initialRing, initialServices, serviceCatalog } from './services';
import type {
  AcFan,
  AcMode,
  AcState,
  AgendaItem,
  Business,
  Device,
  HistoryEntry,
  Leftover,
  Outgoing,
  Permission,
  Place,
  Service,
} from './types';

export * from './types';

export type ActionSource = 'suara' | 'aplikasi' | 'chat';

export interface SampleState {
  place: Place;
  ac: AcState;
  devices: Device[];
  approvalPending: boolean;
  outgoing: Outgoing;
  /** Id entri Riwayat dari kiriman yang tertahan, supaya bisa dicoret saat dibatalkan. */
  sentHistoryId: string | null;
  agenda: AgendaItem[];
  leftover: Leftover | null;
  ring: OrbitNode[];
  services: Service[];
  /** Id layanan yang isi ingatannya sudah dihapus. */
  forgotten: string[];
  history: HistoryEntry[];
  business: Business;
  toast: string | null;
  onboarded: boolean;
  /** Pencacah untuk id baru, supaya reducer tetap murni. */
  seq: number;
}

export type SampleAction =
  | { type: 'setPlace'; place: Place }
  | { type: 'setAc'; on?: boolean; temp?: number; mode?: AcMode; fan?: AcFan; source?: ActionSource }
  | { type: 'toggleDevice'; id: string; on: boolean }
  | { type: 'sendDraft' }
  | { type: 'cancelSend' }
  | { type: 'editDraft'; text: string }
  | { type: 'addAgenda'; item: Omit<AgendaItem, 'id'> }
  | { type: 'snooze'; id: string; until: string }
  | { type: 'finishLeftover'; choice: 'today' | 'drop' }
  | { type: 'toggleTask'; id: string }
  | { type: 'connect'; id: string }
  | { type: 'disconnect'; id: string }
  | { type: 'forget'; id: string }
  | { type: 'setPermission'; id: string; permission: Permission }
  | { type: 'showToast'; text: string }
  | { type: 'hideToast' }
  | { type: 'finishOnboarding' };

export const initialSampleState: SampleState = {
  place: 'Semua',
  ac: { on: true, temp: 24, mode: 'Dingin', fan: 'Otomatis' },
  devices: initialDevices,
  approvalPending: true,
  outgoing: initialOutgoing,
  sentHistoryId: null,
  agenda: initialAgenda,
  leftover: initialLeftover,
  ring: initialRing,
  services: initialServices,
  forgotten: [],
  history: initialHistory,
  business: initialBusiness,
  toast: null,
  onboarded: false,
  seq: 0,
};

/** Jam contoh saat pengguna bertindak lewat aplikasi (desain 2m). */
const NOW_APP = '10.43';
const NOW_VOICE = '10.41';

const lc = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s);

function withHistory(state: SampleState, entry: Omit<HistoryEntry, 'id' | 'day'>): { state: SampleState; id: string } {
  const id = `h-${state.seq + 1}`;
  return {
    id,
    state: { ...state, seq: state.seq + 1, history: [{ ...entry, id, day: 'Hari ini' }, ...state.history] },
  };
}

function setDevice(devices: Device[], id: string, patch: Partial<Device>): Device[] {
  return devices.map((d) => (d.id === id ? { ...d, ...patch } : d));
}

export function sampleReducer(state: SampleState, action: SampleAction): SampleState {
  switch (action.type) {
    case 'setPlace':
      return state.place === action.place ? state : { ...state, place: action.place };

    case 'setAc': {
      const { source, type: _type, ...patch } = action;
      const ac: AcState = { ...state.ac };
      for (const k of ['on', 'temp', 'mode', 'fan'] as const) {
        if (patch[k] !== undefined) (ac[k] as unknown) = patch[k];
      }
      if (ac.on === state.ac.on && ac.temp === state.ac.temp && ac.mode === state.ac.mode && ac.fan === state.ac.fan) {
        return state;
      }
      const acDevice = state.devices.find((d) => d.id === 'ac-kamar');
      let next: SampleState = {
        ...state,
        ac,
        devices: acDevice
          ? setDevice(state.devices, acDevice.id, { on: ac.on, status: deviceStatus(acDevice, ac.on, ac) })
          : state.devices,
      };
      const time = source === 'suara' ? NOW_VOICE : NOW_APP;
      const via = source ?? 'aplikasi';
      if (ac.on !== state.ac.on) {
        next = withHistory(next, {
          time,
          kind: 'rumah',
          icon: 'snow',
          title: ac.on ? 'Menyalakan AC kamar' : 'Mematikan AC kamar',
          sub: `lewat ${via} · ${time}`,
        }).state;
      } else {
        // Mengatur suhu/mode berkali-kali jadi satu catatan, bukan sepuluh.
        const entry: Omit<HistoryEntry, 'id' | 'day'> = {
          time,
          kind: 'rumah',
          icon: 'snow',
          title: 'Mengatur AC kamar',
          sub: `${ac.temp}° · ${ac.mode} · lewat ${via} · ${time}`,
        };
        const top = next.history[0];
        next =
          top && top.title === 'Mengatur AC kamar' && top.day === 'Hari ini'
            ? { ...next, history: [{ ...top, ...entry }, ...next.history.slice(1)] }
            : withHistory(next, entry).state;
      }
      return next;
    }

    case 'toggleDevice': {
      const d = state.devices.find((x) => x.id === action.id);
      if (!d || !d.reachable || d.on === action.on) return state;
      if (d.id === 'ac-kamar') return sampleReducer(state, { type: 'setAc', on: action.on, source: 'aplikasi' });
      const next = {
        ...state,
        devices: setDevice(state.devices, d.id, { on: action.on, status: deviceStatus(d, action.on) }),
      };
      const name = lc(d.name);
      const title =
        d.kind === 'kunci'
          ? `${action.on ? 'Mengunci' : 'Membuka'} ${name}`
          : `${action.on ? 'Menyalakan' : 'Mematikan'} ${name}`;
      return withHistory(next, {
        time: NOW_APP,
        kind: d.place === 'Rumah' ? 'rumah' : 'usaha',
        icon: d.icon,
        title,
        sub: `${d.place} · lewat aplikasi · ${NOW_APP}`,
      }).state;
    }

    case 'editDraft':
      if (state.outgoing.status !== 'draft') return state;
      return { ...state, outgoing: { ...state.outgoing, text: action.text } };

    case 'sendDraft': {
      if (state.outgoing.status !== 'draft') return state;
      const { sentAt, to } = state.outgoing;
      const r = withHistory(
        { ...state, approvalPending: false, outgoing: { ...state.outgoing, status: 'held' } },
        {
          time: sentAt,
          kind: 'pesan',
          icon: 'chat',
          title: `Mengirim balasan ke ${to}`,
          sub: `disetujui Anda ${sentAt}`,
          undoable: true,
        },
      );
      return { ...r.state, sentHistoryId: r.id };
    }

    case 'cancelSend': {
      if (state.outgoing.status !== 'held') return state;
      return {
        ...state,
        outgoing: { ...state.outgoing, status: 'cancelled' },
        toast: `Kiriman ke ${state.outgoing.to} dibatalkan.`,
        history: state.history.map((h) => (h.id === state.sentHistoryId ? { ...h, undoable: false, struck: true } : h)),
      };
    }

    case 'addAgenda': {
      const id = `a-${state.seq + 1}`;
      const item: AgendaItem = { ...action.item, id, home: action.item.date === TODAY };
      const next = { ...state, seq: state.seq + 1, agenda: [...state.agenda, item] };
      return withHistory(next, {
        time: NOW_APP,
        kind: 'pesan',
        icon: item.kind === 'task' ? 'task' : 'bell',
        title: 'Menambah ke agenda',
        sub: `${item.title} · ${item.time}`,
      }).state;
    }

    case 'snooze':
      return {
        ...state,
        agenda: state.agenda.map((a) => (a.id === action.id ? { ...a, snoozedUntil: action.until } : a)),
      };

    case 'finishLeftover': {
      if (!state.leftover) return state;
      if (action.choice === 'drop') return { ...state, leftover: null };
      const id = `a-${state.seq + 1}`;
      return {
        ...state,
        seq: state.seq + 1,
        leftover: null,
        agenda: [...state.agenda, { id, date: TODAY, time: '17.00', title: state.leftover.title, kind: 'task' }],
      };
    }

    case 'toggleTask':
      return {
        ...state,
        agenda: state.agenda.map((a) => (a.id === action.id && a.kind === 'task' ? { ...a, done: !a.done } : a)),
      };

    case 'connect': {
      const entry = serviceCatalog[action.id];
      if (!entry || state.services.some((s) => s.id === action.id)) return state;
      const service: Service = { ...entry.service, ringKey: entry.node.key };
      return withHistory(
        { ...state, services: [...state.services, service], ring: [...state.ring, entry.node] },
        {
          time: NOW_APP,
          kind: 'pesan',
          icon: 'link',
          title: `Menyambungkan ${service.name}`,
          sub: `baru tersambung · ${NOW_APP}`,
        },
      ).state;
    }

    case 'disconnect': {
      const s = state.services.find((x) => x.id === action.id);
      if (!s) return state;
      return withHistory(
        {
          ...state,
          services: state.services.filter((x) => x.id !== s.id),
          ring: state.ring.filter((n) => n.key !== s.ringKey),
        },
        { time: NOW_APP, kind: 'pesan', icon: 'link', title: `Memutus ${s.name}`, sub: `diputus Anda · ${NOW_APP}` },
      ).state;
    }

    case 'forget': {
      const s = state.services.find((x) => x.id === action.id);
      if (!s || state.forgotten.includes(s.id)) return state;
      return withHistory(
        { ...state, forgotten: [...state.forgotten, s.id] },
        {
          time: NOW_APP,
          kind: 'pesan',
          icon: 'trash',
          title: `Menghapus yang saya tahu dari ${s.name}`,
          sub: `atas permintaan Anda · ${NOW_APP}`,
        },
      ).state;
    }

    case 'setPermission':
      return {
        ...state,
        services: state.services.map((s) => (s.id === action.id ? { ...s, permission: action.permission } : s)),
      };

    case 'showToast':
      return { ...state, toast: action.text };
    case 'hideToast':
      return state.toast === null ? state : { ...state, toast: null };
    case 'finishOnboarding':
      return { ...state, onboarded: true };
  }
}

/** Agenda satu tanggal, urut jam. */
export function agendaOn(state: SampleState, date: string): AgendaItem[] {
  return state.agenda.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

interface Ctx {
  state: SampleState;
  dispatch: Dispatch<SampleAction>;
}
const SampleContext = createContext<Ctx | null>(null);

/** `initial` untuk tes: mulai dari keadaan tertentu. */
export function SampleProvider({ children, initial }: { children: ReactNode; initial?: SampleState }) {
  const [state, dispatch] = useReducer(sampleReducer, initial ?? initialSampleState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SampleContext.Provider value={value}>{children}</SampleContext.Provider>;
}

export function useSample(): Ctx {
  const v = useContext(SampleContext);
  if (!v) throw new Error('useSample dipakai di luar SampleProvider');
  return v;
}
