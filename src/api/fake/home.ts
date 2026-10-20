import { businessByPlace } from '@/sample/business';
import { homeSummary } from '@/sample/profile';
import type { SampleState } from '@/sample/reducer';
import { approvalText, homeAgenda, houseCard, ringNodes } from '@/sample/selectors';
import type { Home } from '../contract';
import { draftFromOutgoing } from './history';

/**
 * Beranda yang dihitung server tiruan dari penyimpanan contoh, dengan penyeleksi yang sama dengan yang dulu dipakai
 * layar. Belum ada `rev`: server tiruan menaikkannya hanya kalau isinya berubah.
 *
 * Aturan: paling banyak tiga baris agenda, tanpa tugas; persetujuan = draf berstatus `draft`; simpul cincin dari layanan
 * tersambung dan perangkat yang punya `ring`; usaha untuk tempat terpilih (Rumah tidak punya usaha, jadi memakai angka
 * Semua cabang).
 */
export function homeFrom(state: SampleState, greetingName: string | null): Omit<Home, 'rev'> {
  const sales =
    (state.place === 'Kedai Dago' || state.place === 'Kedai Riau' ? businessByPlace[state.place] : undefined) ??
    businessByPlace.Semua!;
  const stock = sales.lowStock[0];
  const alert =
    sales === businessByPlace.Semua ? state.business.alert : stock ? `${stock.item} tinggal ${stock.left}` : null;
  return {
    place: state.place,
    greetingName,
    summary: homeSummary,
    approvals: Object.values(state.outgoing)
      .filter((o) => o.status === 'draft')
      .map((o) => ({ ...draftFromOutgoing(o), ask: approvalText(o) })),
    agendaToday: homeAgenda(state).map((a) => ({ id: a.id, time: a.time, title: a.title, kind: a.kind })),
    house: {
      lines: houseCard(state).map(({ device: d, text }) => ({
        deviceId: d.id,
        icon: d.icon,
        text,
        label: d.name,
        ...(d.kind === 'ac' ? { on: d.on } : {}),
        switchable: d.kind === 'ac' && d.reachable,
      })),
    },
    business: {
      source: state.business.source,
      sales: sales.sales,
      change: sales.change,
      down: sales.down ?? false,
      alert,
    },
    ring: { nodes: ringNodes(state).map((n) => ({ key: n.key, icon: n.icon, label: n.label, reachable: !n.offline })) },
  };
}
