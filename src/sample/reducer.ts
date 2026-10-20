import type { OrbitNode } from '@/ui/orbit/types';
import { initialAgenda, initialLeftover, TODAY } from './agenda';
import { deviceStatus, initialDevices } from './devices';
import { initialBusiness, initialHistory } from './history';
import { draftIntro, initialChat } from './chat';
import { addMinutes } from './dates';
import { initialOutgoing } from './outgoing';
import { initialRing, initialServices, serviceCatalog } from './services';
import type {
  AcFan,
  AcMode,
  AcState,
  AgendaItem,
  Business,
  ChatEntry,
  Device,
  HistoryEntry,
  Leftover,
  NewChatEntry,
  NewDraft,
  Outgoing,
  Permission,
  Place,
  Service,
} from './types';

export type ActionSource = 'suara' | 'aplikasi' | 'chat';

export interface SampleState {
  place: Place;
  ac: AcState;
  devices: Device[];
  /** Kiriman per id: draf, tertahan, terkirim, dibatalkan. Urutan sisip = urutan dibuat. */
  outgoing: Record<string, Outgoing>;
  /** Utas chat. Kartu konfirmasi dan perangkat menunjuk ke `outgoing` dan `devices` lewat id. */
  chat: ChatEntry[];
  agenda: AgendaItem[];
  leftover: Leftover | null;
  ring: OrbitNode[];
  services: Service[];
  /** Id layanan yang isi ingatannya sudah dihapus. */
  forgotten: string[];
  history: HistoryEntry[];
  business: Business;
  toast: string | null;
  /**
   * Penanda contoh saja: layar pertama kali sudah dilewati. Di Fase 0b tidak ada pengalihan ke /mulai; penjaga
   * onboarding sungguhan dibangun di Fase 1.
   */
  onboarded: boolean;
  /** Pencacah untuk id baru, supaya reducer tetap murni. */
  seq: number;
}

export type SampleAction =
  | { type: 'setPlace'; place: Place }
  | { type: 'setAc'; on?: boolean; temp?: number; mode?: AcMode; fan?: AcFan; source?: ActionSource }
  | { type: 'toggleDevice'; id: string; on: boolean }
  | { type: 'addDraft'; draft: NewDraft }
  | { type: 'editDraft'; id: string; text: string }
  | { type: 'sendDraft'; id: string }
  | { type: 'cancelSend'; id: string }
  | { type: 'addChatMessage'; from: 'user' | 'assistant'; text: string }
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
  outgoing: initialOutgoing,
  chat: initialChat,
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

/** Menambah baris ke utas. Tanda berpikir hanya berlaku di ujung utas, jadi baris baru menggantikannya. */
function withChat(state: SampleState, entries: NewChatEntry[]): SampleState {
  let seq = state.seq;
  const added = entries.map((e): ChatEntry => ({ ...e, id: `c-${++seq}` }));
  return { ...state, seq, chat: [...state.chat.filter((e) => e.kind !== 'thinking'), ...added] };
}

function setOutgoing(state: SampleState, id: string, patch: Partial<Outgoing>): SampleState {
  return { ...state, outgoing: { ...state.outgoing, [id]: { ...state.outgoing[id]!, ...patch } } };
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

    case 'addDraft': {
      const id = `o-${state.seq + 1}`;
      const sentAt = action.draft.sentAt ?? NOW_APP;
      const draft: Outgoing = { ...action.draft, id, status: 'draft', sentAt, heldUntil: addMinutes(sentAt, 5) };
      return withChat({ ...state, seq: state.seq + 1, outgoing: { ...state.outgoing, [id]: draft } }, [
        { kind: 'assistant', text: draftIntro(draft.what) },
        { kind: 'confirm', outgoingId: id },
      ]);
    }

    case 'editDraft': {
      const o = state.outgoing[action.id];
      const text = action.text.trim();
      if (o?.status !== 'draft' || !text || text === o.text) return state;
      return setOutgoing(state, o.id, { text });
    }

    case 'sendDraft': {
      const o = state.outgoing[action.id];
      if (o?.status !== 'draft') return state;
      return withHistory(setOutgoing(state, o.id, { status: 'held' }), {
        time: o.sentAt,
        kind: o.what === 'pesanan' ? 'usaha' : 'pesan',
        icon: 'chat',
        title: `Mengirim ${o.what} ke ${o.to}`,
        sub: `disetujui Anda ${o.sentAt}`,
        outgoingId: o.id,
      }).state;
    }

    case 'cancelSend': {
      const o = state.outgoing[action.id];
      if (o?.status !== 'held') return state;
      return { ...setOutgoing(state, o.id, { status: 'cancelled' }), toast: `Kiriman ke ${o.to} dibatalkan.` };
    }

    case 'addChatMessage': {
      const text = action.text.trim();
      return text ? withChat(state, [{ kind: action.from, text }]) : state;
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
