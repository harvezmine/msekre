import { homeSummary } from '@/sample/profile';
import type { SampleState } from '@/sample/reducer';
import { PLACES } from '@/sample/types';
import { approvalText, homeAgenda, houseCard, ringNodes } from '@/sample/selectors';
import { changeText, stockLeft } from '../business';
import type { Home } from '../contract';
import { formatRupiah } from '../format';
import { businessFrom } from './business';
import { draftFromOutgoing } from './history';

/**
 * Beranda yang dihitung server tiruan dari penyimpanan contoh, dengan penyeleksi yang sama dengan yang dulu dipakai
 * layar. Belum ada `rev`: server tiruan menaikkannya hanya kalau isinya berubah.
 *
 * Aturan: paling banyak tiga baris agenda, tanpa tugas; persetujuan = draf berstatus `draft`; simpul cincin dari layanan
 * tersambung dan perangkat yang punya `ring`; usaha untuk tempat terpilih (dari data yang sama dengan `GET /business`; Rumah memakai angka
 * Semua cabang).
 */
export function homeFrom(state: SampleState, greetingName: string | null): Omit<Home, 'rev'> {
  // Rumah tidak punya usaha, jadi kartu memakai angka Semua (sama dengan `GET /business?place=Semua`).
  const biz = businessFrom(
    state.place === 'Kedai Dago' || state.place === 'Kedai Riau' ? state.place : 'Semua',
    'hari',
    () => undefined,
  );
  const stock = biz.lowStock[0];
  return {
    place: state.place,
    places: PLACES.filter((p) => p !== 'Semua'),
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
      sales: formatRupiah(biz.sales.total),
      change: changeText(biz.sales),
      down: biz.sales.down,
      alert: stock ? `${stock.name} tinggal ${stockLeft(stock)}` : null,
    },
    ring: { nodes: ringNodes(state).map((n) => ({ key: n.key, icon: n.icon, label: n.label, reachable: !n.offline })) },
  };
}
