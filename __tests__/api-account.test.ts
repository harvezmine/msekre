import { planLine, planText, STYLES, trialBar } from '@/api/account';
import { AccountController } from '@/api/accountController';
import {
  accountSchema,
  assistantNameSchema,
  assistantUpdateReqSchema,
  greetingUpdateReqSchema,
  notificationsUpdateReqSchema,
  streamEventSchema,
} from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import { ERROR_TEXT, friendlyError, INVALID_NAME_TEXT } from '@/api/errors';
import { parseAccountLenient, parseEventLenient } from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { appVersion, versionText } from '@/api/version';
import { ApiFailure } from '@/api/transport';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

const make = (options: ConstructorParameters<typeof FakeTransport>[1] = {}) => {
  const transport = new FakeTransport(createMemorySession(null), { mode: 'server', ...options });
  const controller = new AccountController(transport);
  controller.start();
  return { transport, controller };
};
const data = (c: AccountController) => c.getState().data!;

describe('skema dan pembacaan longgar', () => {
  test('nama asisten: 2 sampai 20 huruf', () => {
    for (const ok of ['Nadia', 'Al', 'Siti', 'Éllena', 'A'.repeat(20)]) {
      expect(assistantNameSchema.safeParse(ok).success).toBe(true);
    }
    for (const bad of ['N', 'Nadia 2', 'Siti Nur', 'Nadia!', '', '   ', 'A'.repeat(21), '12']) {
      expect(assistantNameSchema.safeParse(bad).success).toBe(false);
    }
    expect(assistantNameSchema.parse('  Nadia  ')).toBe('Nadia');
  });

  test('isi permintaan: ketat, minimal satu perubahan', () => {
    expect(assistantUpdateReqSchema.safeParse({ style: 'formal' }).success).toBe(true);
    expect(assistantUpdateReqSchema.safeParse({}).success).toBe(false);
    expect(assistantUpdateReqSchema.safeParse({ name: 'Nadia', lain: 1 }).success).toBe(false);
    expect(assistantUpdateReqSchema.safeParse({ style: 'santai' }).success).toBe(false);
    expect(greetingUpdateReqSchema.safeParse({ daily: true, time: '07.00' }).success).toBe(true);
    expect(greetingUpdateReqSchema.safeParse({ daily: true, time: '7:00' }).success).toBe(false);
    expect(notificationsUpdateReqSchema.safeParse({ rumah: false }).success).toBe(true);
    expect(notificationsUpdateReqSchema.safeParse({}).success).toBe(false);
    expect(notificationsUpdateReqSchema.safeParse({ lain: true }).success).toBe(false);
  });

  const raw = async () => {
    const { transport } = make();
    return (await transport.account()) as unknown as Record<string, unknown>;
  };

  test('Akun dari server tiruan sah menurut skema', async () => {
    const account = await raw();
    expect(accountSchema.safeParse(account).success).toBe(true);
    expect(account).toMatchObject({
      plan: { name: 'Bisnis', status: 'aktif' },
      assistant: { name: 'Nadia', style: 'ramah' },
      greeting: { daily: true, time: '07.00' },
      security: { pinEnabled: false, hasPin: false },
    });
  });

  test('bagian opsional yang rusak dibuang: HP rusak, layanan privasi rusak, status paket baru', async () => {
    const account = await raw();
    const parsed = parseAccountLenient({
      ...account,
      plan: { name: 'Bisnis', status: 'gratis_selamanya' },
      phones: [...(account.phones as unknown[]), { id: 'x' }, 'bukan'],
      privacy: { services: [{ id: 'gmail', name: 'Gmail', memoryCount: 4 }, { id: 'rusak' }] },
    })!;
    expect(parsed.plan.status).toBe('aktif');
    expect(parsed.phones.map((p) => p.id)).toEqual(['hp-ini', 'hp-lama']);
    expect(parsed.privacy.services).toEqual([{ id: 'gmail', name: 'Gmail', memoryCount: 4 }]);
    // Bagian yang hilang dibaca kosong; bagian wajib yang rusak membuat seluruhnya ditolak.
    const bare = parseAccountLenient({ ...account, phones: undefined, privacy: undefined })!;
    expect(bare.phones).toEqual([]);
    expect(bare.privacy.services).toEqual([]);
    expect(parseAccountLenient({ ...account, rev: 0 })).toBeNull();
    expect(parseAccountLenient({ ...account, assistant: { name: '', style: 'ramah' } })).toBeNull();
    expect(parseAccountLenient([])).toBeNull();
    const event = { type: 'account', account };
    expect(streamEventSchema.safeParse(event).success).toBe(true);
    expect(
      parseEventLenient({ type: 'account', account: { ...(account as object), phones: [{ id: 'x' }] } }),
    ).toMatchObject({
      type: 'account',
    });
    expect(parseEventLenient({ type: 'account', account: 3 })).toBeNull();
  });

  test('kalimat paket: hari kalender WIB di sekitar tengah malam', () => {
    // 21 Okt 2026 23.30 WIB dan 22 Okt 2026 00.10 WIB: 40 menit berselang, tetapi hari kalendernya berganti.
    const lateEvening = Date.parse('2026-10-21T16:30:00Z');
    const justAfterMidnight = Date.parse('2026-10-21T17:10:00Z');
    // Berakhir tengah malam 25 Okt WIB (eksklusif): hari terakhirnya 24 Okt.
    const until = '2026-10-24T17:00:00Z';
    const trial = { name: 'Coba', status: 'trial', until } as const;
    expect(planText(trial, lateEvening)).toBe('Coba gratis, tersisa 3 hari');
    expect(planText(trial, justAfterMidnight)).toBe('Coba gratis, tersisa 2 hari');
    // Sehari sebelum hari terakhir, jam berapa pun: tersisa 1 hari.
    expect(planText(trial, Date.parse('2026-10-22T17:01:00Z'))).toBe('Coba gratis, tersisa 1 hari');
    expect(planText(trial, Date.parse('2026-10-23T16:59:00Z'))).toBe('Coba gratis, tersisa 1 hari');
    // Hari terakhir: dari 00.00 WIB sampai sedetik sebelum akhir.
    expect(planText(trial, Date.parse('2026-10-24T17:00:00Z') - 1)).toBe('Coba gratis, berakhir hari ini');
    expect(planText(trial, Date.parse('2026-10-24T01:00:00Z'))).toBe('Coba gratis, berakhir hari ini');
    // Sudah lewat hari terakhirnya.
    expect(planText(trial, Date.parse('2026-10-24T17:00:00Z'))).toBe('Sudah berakhir');
    // Hari terakhir langganan: dari until - 1 ms, di WIB.
    expect(planText({ name: 'Bisnis', status: 'aktif', until: '2026-11-21T17:00:00Z' })).toBe(
      'Aktif sampai 21 Nov 2026',
    );
    expect(planText({ name: 'Bisnis', status: 'aktif', until: '2026-11-21T17:00:00.001Z' })).toBe(
      'Aktif sampai 22 Nov 2026',
    );
    // Zona lain (mis. WITA, 480 menit): batas harinya ikut bergeser.
    expect(planText({ name: 'Bisnis', status: 'aktif', until: '2026-11-21T16:00:00Z' }, 0, 480)).toBe(
      'Aktif sampai 21 Nov 2026',
    );
  });

  test('kalimat paket', () => {
    const now = Date.parse('2026-10-21T03:00:00Z');
    const day = 86_400_000;
    const until = (n: number) => new Date(now + n * day - 1000).toISOString();
    expect(planText({ name: 'Coba', status: 'trial', until: until(5) }, now)).toBe('Coba gratis, tersisa 5 hari');
    expect(planText({ name: 'Coba', status: 'trial', until: until(1) }, now)).toBe('Coba gratis, tersisa 1 hari');
    expect(planText({ name: 'Coba', status: 'trial', until: until(0) }, now)).toBe('Coba gratis, berakhir hari ini');
    expect(planText({ name: 'Coba', status: 'trial' }, now)).toBe('Coba gratis');
    expect(planText({ name: 'Bisnis', status: 'aktif', until: '2026-11-21T05:00:00Z' }, now)).toBe(
      'Aktif sampai 21 Nov 2026',
    );
    expect(planText({ name: 'Bisnis', status: 'aktif' }, now)).toBe('Aktif');
    expect(planText({ name: 'Bisnis', status: 'berakhir', until: until(-3) }, now)).toBe('Sudah berakhir');
    expect(STYLES.map((s) => s.title)).toEqual(['Singkat', 'Ramah', 'Formal']);
  });

  test('baris paket di kartu profil dan batang hari masa coba (hari kalender WIB)', () => {
    const until = '2026-10-24T17:00:00Z';
    const trial = { name: 'Coba', status: 'trial', until } as const;
    // 21 Okt 23.30 WIB: tiga hari lagi; lewat tengah malam WIB: dua.
    expect(planLine(trial, Date.parse('2026-10-21T16:30:00Z'))).toBe('Coba gratis · 3 hari');
    expect(trialBar(trial, Date.parse('2026-10-21T16:30:00Z'))).toBe(3);
    expect(planLine(trial, Date.parse('2026-10-21T17:10:00Z'))).toBe('Coba gratis · 2 hari');
    // Hari terakhir: tetap satu ruas.
    expect(planLine(trial, Date.parse('2026-10-24T01:00:00Z'))).toBe('Coba gratis · hari terakhir');
    expect(trialBar(trial, Date.parse('2026-10-24T01:00:00Z'))).toBe(1);
    expect(planLine(trial, Date.parse('2026-10-24T17:00:00Z'))).toBe('Sudah berakhir');
    expect(trialBar(trial, Date.parse('2026-10-24T17:00:00Z'))).toBeNull();
    // Hari pertama masa coba 7 hari: tujuh ruas penuh.
    const start = Date.parse('2026-10-21T03:00:00Z');
    expect(trialBar({ ...trial, until: new Date(start + 7 * 86_400_000).toISOString() }, start)).toBe(7);
    expect(trialBar({ name: 'Coba', status: 'trial' }, start)).toBeNull();
    // Aktif: tanpa tahun bila tahun ini, dengan tahun bila tahun lain.
    const now = Date.parse('2026-10-21T03:00:00Z');
    expect(planLine({ name: 'Bisnis', status: 'aktif', until: '2026-11-21T17:00:00Z' }, now)).toBe(
      'Aktif sampai 21 Nov',
    );
    expect(planLine({ name: 'Bisnis', status: 'aktif', until: '2027-01-12T05:00:00Z' }, now)).toBe(
      'Aktif sampai 12 Jan 2027',
    );
    expect(trialBar({ name: 'Bisnis', status: 'aktif', until: '2027-01-12T05:00:00Z' }, now)).toBeNull();
    expect(planLine({ name: 'Bisnis', status: 'berakhir' }, now)).toBe('Sudah berakhir');
  });

  test('versi di Akun: versi dan nomor build aplikasi terpasang, atau versi app.config bila tidak ada', () => {
    expect(versionText()).toBe('Versi 1.0.0 (7)');
    expect(versionText('1.2.0', '15')).toBe('Versi 1.2.0 (15)');
    expect(versionText('1.2.0', null)).toBe('Versi 1.2.0');
    expect(versionText(null, null)).toBe(`Versi ${appVersion()}`);
  });
});

describe('server tiruan: Akun', () => {
  test('ubah nama: /me ikut berubah; nama tidak sah ditolak server (invalid_name)', async () => {
    const { transport } = make();
    const before = await transport.account();
    const after = await transport.setAssistant({ name: 'Sari' });
    expect(after.assistant.name).toBe('Sari');
    expect(after.me.assistantName).toBe('Sari');
    expect(after.rev).toBeGreaterThan(before.rev);
    expect((await transport.me()).assistantName).toBe('Sari');
    await expect(transport.setAssistant({ name: 'S4ri' })).rejects.toMatchObject({
      code: 'invalid_name',
      error: 'nama_tidak_valid',
    });
    await expect(transport.setAssistant({})).rejects.toMatchObject({ error: 'tidak_valid' });
    expect((await transport.setAssistant({ style: 'formal' })).assistant).toEqual({ name: 'Sari', style: 'formal' });
  });

  test('sapaan dan notifikasi: hanya yang diubah; rev naik hanya bila ada perubahan', async () => {
    const { transport } = make();
    const a = await transport.setGreeting({ daily: false });
    expect(a.greeting).toEqual({ daily: false, time: '07.00' });
    expect((await transport.setGreeting({ daily: true, time: '08.00' })).greeting).toEqual({
      daily: true,
      time: '08.00',
    });
    const n = await transport.setNotifications({ rumah: false });
    expect(n.notifications).toEqual({ pesan: true, pengingat: true, ringkasanHarian: true, rumah: false, usaha: true });
    const same = await transport.setNotifications({ rumah: false });
    expect(same.rev).toBe(n.rev);
    await expect(transport.setNotifications({} as never)).rejects.toMatchObject({ error: 'tidak_valid' });
  });

  test('keluarkan HP: yang lain keluar dan tercatat; HP ini ditolak; yang tidak ada 404', async () => {
    const { transport } = make();
    await expect(transport.removePhone('hp-ini')).rejects.toMatchObject({ error: 'tidak_valid' });
    await expect(transport.removePhone('hp-hantu')).rejects.toMatchObject({ error: 'tidak_ditemukan' });
    const next = await transport.removePhone('hp-lama');
    expect(next.phones.map((p) => p.id)).toEqual(['hp-ini']);
    expect(transport.removedPhones).toEqual(['hp-lama']);
  });

  test('PIN dibuat: keamanan di Akun ikut; paket bisa diatur (masa coba, berakhir)', async () => {
    const { transport } = make({ plan: { name: 'Coba', status: 'trial', until: '2026-10-26T00:00:00Z' } });
    expect((await transport.account()).plan).toMatchObject({ name: 'Coba', status: 'trial' });
    await transport.setPin({ pin: '123456', enable: true });
    expect((await transport.account()).security).toEqual({ pinEnabled: true, hasPin: true });
  });

  test('privasi: layanan beringatan; setelah dilupakan jumlahnya 0 dan event account datang', async () => {
    const { transport, controller } = make();
    await controller.load();
    const before = data(controller).privacy.services;
    expect(before.length).toBeGreaterThan(0);
    const target = before.find((s) => s.memoryCount > 0)!;
    await transport.forgetConnection(target.id);
    await flush();
    const after = data(controller).privacy.services.find((s) => s.id === target.id)!;
    expect(after.memoryCount).toBe(0);
    expect(data(controller).rev).toBeGreaterThan(0);
  });

  test('perubahan dari tempat lain (event account) menggantikan Akun; yang lebih lama dibuang', async () => {
    const { transport, controller } = make();
    await controller.load();
    const rev = data(controller).rev;
    await transport.setNotifications({ usaha: false });
    await flush();
    expect(data(controller).notifications.usaha).toBe(false);
    expect(data(controller).rev).toBeGreaterThan(rev);
    // Event usang tidak menimpa yang lebih baru.
    const stale = { ...data(controller), rev, notifications: { ...data(controller).notifications, usaha: true } };
    (controller as unknown as { onEvent(e: unknown): void }).onEvent({ type: 'account', account: stale });
    expect(data(controller).notifications.usaha).toBe(false);
  });
});

describe('AccountController: tampil dulu, kembalikan bila gagal', () => {
  test('memuat: error ramah, lalu berhasil', async () => {
    const { transport, controller } = make();
    transport.failNext('network');
    await controller.load();
    expect(controller.getState()).toMatchObject({ status: 'error', error: ERROR_TEXT, data: null });
    await controller.load();
    expect(controller.getState().status).toBe('ready');
  });

  test('nama tidak sah ditolak di HP tanpa permintaan; sebelum dimuat ditolak ramah', async () => {
    const { transport, controller } = make();
    const spy = jest.spyOn(transport, 'setAssistant');
    expect(await controller.setAssistant({ name: 'S4' })).toEqual({ ok: false, message: INVALID_NAME_TEXT });
    expect((await controller.setAssistant({ name: 'Sari' })).ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('ubah nama: tampil sebelum server menjawab, tersimpan setelahnya', async () => {
    const { transport, controller } = make({ latencyMs: 50 });
    const loading = controller.load();
    jest.advanceTimersByTime(60);
    await loading;
    const run = controller.setAssistant({ name: ' Sari ', style: 'singkat' });
    expect(data(controller).assistant).toEqual({ name: 'Sari', style: 'singkat' });
    expect(controller.getState().busy.has('assistant')).toBe(true);
    jest.advanceTimersByTime(60);
    expect(await run).toEqual({ ok: true });
    expect(controller.getState().busy.size).toBe(0);
    expect(data(controller).me.assistantName).toBe('Sari');
    const me = transport.me();
    jest.advanceTimersByTime(60);
    expect((await me).assistantName).toBe('Sari');
  });

  test('server menolak: nilai kembali dan teks ramah', async () => {
    const { transport, controller } = make();
    await controller.load();
    transport.failNext('network');
    expect(await controller.setNotifications({ pesan: false })).toEqual({ ok: false, message: ERROR_TEXT });
    expect(data(controller).notifications.pesan).toBe(true);
    transport.failNext('server');
    expect((await controller.setGreeting({ daily: false })).ok).toBe(false);
    expect(data(controller).greeting).toEqual({ daily: true, time: '07.00' });
    transport.failNext('server');
    expect((await controller.setAssistant({ style: 'formal' })).ok).toBe(false);
    expect(data(controller).assistant.style).toBe('ramah');
    transport.failNext('server');
    expect((await controller.setAssistant({ name: 'Sari' })).ok).toBe(false);
    expect(data(controller).assistant.name).toBe('Nadia');
    expect(controller.getState().busy.size).toBe(0);
  });

  test('dua saklar berurutan: yang gagal kembali sendiri, yang berhasil tetap', async () => {
    const { transport, controller } = make({ latencyMs: 10 });
    const loading = controller.load();
    jest.advanceTimersByTime(20);
    await loading;
    transport.failNext('network');
    const first = controller.setNotifications({ pesan: false });
    const second = controller.setNotifications({ rumah: false });
    expect(data(controller).notifications).toMatchObject({ pesan: false, rumah: false });
    jest.advanceTimersByTime(30);
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(true);
    expect(data(controller).notifications).toMatchObject({ pesan: true, rumah: false });
  });

  test('keluarkan HP: satu permintaan sekaligus, HP ini ditolak di HP, berhasil menghapus dari daftar', async () => {
    const { transport, controller } = make({ latencyMs: 10 });
    const loading = controller.load();
    jest.advanceTimersByTime(20);
    await loading;
    expect(await controller.removePhone('hp-ini')).toEqual({ ok: false, message: '' });
    const run = controller.removePhone('hp-lama');
    expect(controller.getState().busy.has('phone:hp-lama')).toBe(true);
    expect(await controller.removePhone('hp-lama')).toEqual({ ok: false, message: '' });
    jest.advanceTimersByTime(20);
    expect(await run).toEqual({ ok: true });
    expect(data(controller).phones.map((p) => p.id)).toEqual(['hp-ini']);
    expect(transport.removedPhones).toEqual(['hp-lama']);
    transport.failNext('network');
    const gone = await controller.removePhone('hp-lama');
    expect(gone).toEqual({ ok: false, message: '' });
  });

  test('keluarkan HP gagal: daftar tetap, teks ramah', async () => {
    const { transport, controller } = make();
    await controller.load();
    transport.failNext('server');
    expect(await controller.removePhone('hp-lama')).toEqual({ ok: false, message: ERROR_TEXT });
    expect(data(controller).phones).toHaveLength(2);
  });

  test('ApiFailure invalid_name dari server dipetakan ke teks ramah', () => {
    expect(friendlyError(new ApiFailure('invalid_name', { status: 400, error: 'nama_tidak_valid' }))).toBe(
      INVALID_NAME_TEXT,
    );
  });
});
