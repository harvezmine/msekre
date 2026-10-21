import type { SampleState } from '@/sample/reducer';
import type {
  Account,
  AccountNotifications,
  AccountPhone,
  AccountPlan,
  AssistantStyle,
  Me,
  SecurityRes,
} from '../contract';
import type { FakeClock } from './clock';
import { detailFrom, type FakeConnectionsContext } from './connections';

/** Bagian Akun yang bisa diubah pengguna (selebihnya turunan atau milik tempat lain). */
export interface FakeAccountState {
  assistantStyle: AssistantStyle;
  greeting: { daily: boolean; time?: string };
  notifications: AccountNotifications;
  phones: AccountPhone[];
  plan: AccountPlan;
}

export const FAKE_GREETING_TIME = '07.00';

/** Keadaan awal: langganan Bisnis aktif sampai 12 Jan 2027, sapaan pagi hidup, dua HP (HP ini dan satu yang lama). */
export function initialAccountState(
  clock: FakeClock,
  options: { plan?: Partial<AccountPlan>; phones?: AccountPhone[] } = {},
): FakeAccountState {
  return {
    assistantStyle: 'ramah',
    greeting: { daily: true, time: FAKE_GREETING_TIME },
    notifications: { pesan: true, pengingat: true, ringkasanHarian: true, rumah: true, usaha: true },
    phones: options.phones ?? [
      { id: 'hp-ini', name: 'Pixel 8', platform: 'android', lastSeen: clock.iso(), current: true },
      { id: 'hp-lama', name: 'Galaxy A54', platform: 'android', lastSeen: clock.iso(-3 * 24 * 60), current: false },
    ],
    plan: { name: 'Bisnis', status: 'aktif', until: '2027-01-12T05:00:00.000Z', price: 500_000, ...options.plan },
  };
}

/** Akun dari keadaan server tiruan. Privasi: layanan tersambung beserta jumlah yang diingat (0 setelah dilupakan). */
export function accountFrom(
  me: Me,
  st: FakeAccountState,
  security: SecurityRes,
  sample: SampleState,
  ctx: FakeConnectionsContext,
): Omit<Account, 'rev'> {
  const services = sample.services.flatMap((s) => {
    const detail = detailFrom(sample, s.id, ctx, new Map());
    const count = detail?.memoryCount;
    // Hanya layanan yang punya ingatan, atau yang baru saja dilupakan (jumlahnya 0 supaya terlihat bersih).
    return detail && count !== undefined && (count > 0 || sample.forgotten.includes(s.id))
      ? [{ id: s.id, name: detail.service.name, memoryCount: count }]
      : [];
  });
  return {
    me,
    plan: st.plan,
    assistant: { name: me.assistantName, style: st.assistantStyle },
    greeting: st.greeting,
    notifications: st.notifications,
    security,
    phones: st.phones,
    privacy: { services },
  };
}
