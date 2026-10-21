import type { OpenAuth } from '@/api/authBrowser';
import { agoText, failureText, groupByCategory, parseCallbackUrl, redirectUrlOf, serviceLine } from '@/api/connections';
import { ConnectionsController } from '@/api/connectionsController';
import {
  connectionDetailSchema,
  connectionsSchema,
  streamEventSchema,
  type Service,
  type StreamEvent,
} from '@/api/contract';
import { FakeTransport } from '@/api/fake/FakeTransport';
import {
  parseConnectionDetailLenient,
  parseConnectionsLenient,
  parseEventLenient,
  parseServiceLenient,
} from '@/api/lenient';
import { createMemorySession } from '@/api/session';
import { ApiFailure } from '@/api/transport';

const NOW = Date.UTC(2026, 9, 21, 3, 0);
const svc = (over: Partial<Service> = {}): Service => ({
  id: 'x',
  name: 'Layanan X',
  icon: 'link',
  category: 'kerja',
  status: 'connected',
  ring: false,
  ...over,
});

const make = (mode: 'contoh' | 'server' = 'server', openAuth?: OpenAuth) => {
  const transport = new FakeTransport(createMemorySession(null), { mode, connectMs: 50 });
  const controller = new ConnectionsController(transport, openAuth);
  controller.start();
  return { transport, controller };
};
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const settle = async (ms = 0) => {
  await flush();
  jest.advanceTimersByTime(ms);
  await flush();
};

describe('teks bantu', () => {
  test('agoText dan serviceLine', () => {
    const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
    expect(agoText(at(0), NOW)).toBe('baru saja');
    expect(agoText(at(5), NOW)).toBe('5 menit lalu');
    expect(agoText(at(125), NOW)).toBe('2 jam lalu');
    expect(agoText(at(3 * 1440), NOW)).toBe('3 hari lalu');
    expect(agoText('bukan waktu', NOW)).toBeNull();
    expect(serviceLine(svc({ account: 'a@b.id', lastUsed: at(2) }), NOW)).toBe(
      'a@b.id · Terakhir dipakai 2 menit lalu',
    );
    expect(serviceLine(svc({ lastUsed: at(2) }), NOW)).toBe('Terakhir dipakai 2 menit lalu');
    expect(serviceLine(svc(), NOW)).toBe('Aktif');
    expect(serviceLine(svc({ needsAttention: 'Perlu disambungkan ulang', account: 'a' }), NOW)).toBe(
      'Perlu disambungkan ulang',
    );
  });

  test('alamat kembali dan kalimat gagal', () => {
    expect(parseCallbackUrl('sekretarisai://terhubung/tersambung?id=notion&ok=1')).toEqual({
      id: 'notion',
      ok: true,
      reason: null,
    });
    expect(parseCallbackUrl('sekretarisai://terhubung/tersambung?id=notion&ok=0&reason=ditolak+pengguna')).toEqual({
      id: 'notion',
      ok: false,
      reason: 'ditolak pengguna',
    });
    expect(parseCallbackUrl('sekretarisai://terhubung/tersambung')).toEqual({ id: null, ok: false, reason: null });
    expect(redirectUrlOf('sekretarisai')).toBe('sekretarisai://terhubung/tersambung');
    expect(redirectUrlOf('sekretarisai://terhubung/tersambung')).toBe('sekretarisai://terhubung/tersambung');
    expect(failureText('Notion', 'ditolak')).toContain('Izin dari Notion belum diberikan');
    expect(failureText('Notion', null)).toContain('Belum berhasil tersambung ke Notion');
  });

  test('katalog menurut kelompok, yang kosong dibuang', () => {
    const groups = groupByCategory([svc({ id: 'a', category: 'usaha' }), svc({ id: 'b', category: 'kerja' })]);
    expect(groups.map((g) => g.key)).toEqual(['kerja', 'usaha']);
  });
});

describe('kontrak dan pembacaan longgar', () => {
  test('server tiruan memenuhi skema, katalog realistis dengan layanan segera hadir', async () => {
    const { transport, controller } = make();
    const all = await transport.connections();
    expect(connectionsSchema.safeParse(all).success).toBe(true);
    expect(all.connected.map((s) => s.id)).toEqual(['gcal', 'gmail', 'wa', 'moka', 'bca', 'kotak', 'imou']);
    expect(all.catalog.filter((s) => s.status === 'soon').map((s) => s.id)).toEqual(['shopee', 'instagram']);
    expect(all.catalog.map((s) => s.id)).toEqual(
      expect.arrayContaining(['m365', 'notion', 'plaud', 'tiktok', 'github', 'smartthings', 'homeassistant', 'gdrive']),
    );
    expect(all.connected.find((s) => s.id === 'imou')!.needsAttention).toBe('Tidak terjangkau sejak 10.12');
    expect(all.connected.find((s) => s.id === 'moka')).toMatchObject({ account: 'Kopi Rindang', ring: true });
    expect(all.connected.find((s) => s.id === 'kotak')!.ring).toBe(false);
    for (const s of [...all.connected, ...all.catalog]) {
      const d = await transport.connectionDetail(s.id);
      expect(connectionDetailSchema.safeParse(d).success).toBe(true);
      expect(d.what.length).toBeGreaterThan(0);
    }
    await expect(transport.connectionDetail('tidak-ada')).rejects.toMatchObject({ status: 404 });
    controller.stop();
    transport.dispose();
  });

  test('kelompok dan status yang belum dikenal, ring hilang, waktu rusak', () => {
    expect(parseServiceLenient({ id: 'a', name: 'A', icon: 'x', category: 'baru', status: 'baru' })).toEqual({
      id: 'a',
      name: 'A',
      icon: 'x',
      category: 'lainnya',
      status: 'available',
      ring: false,
    });
    expect(
      parseServiceLenient({
        id: 'a',
        name: 'A',
        icon: 'x',
        category: 'kerja',
        status: 'connected',
        lastUsed: 'kemarin',
        ring: true,
      }),
    ).toMatchObject({ ring: true });
    expect(
      parseServiceLenient({
        id: 'a',
        name: 'A',
        icon: 'x',
        category: 'kerja',
        status: 'connected',
        lastUsed: 'kemarin',
      }),
    ).not.toHaveProperty('lastUsed');
    expect(parseServiceLenient({ id: 'a' })).toBeNull();
    expect(parseServiceLenient('x')).toBeNull();
  });

  test('daftar: layanan rusak dibuang, rev wajib; detail: izin baru dibaca baca, kemampuan rusak dibuang', () => {
    const good = svc({ id: 'ok' });
    const c = parseConnectionsLenient({ connected: [good, { oops: 1 }], catalog: 'x', formerly: [], rev: 3 })!;
    expect(c.connected).toEqual([good]);
    expect(c.catalog).toEqual([]);
    expect(parseConnectionsLenient({ connected: [], catalog: [], formerly: [] })).toBeNull();
    const d = parseConnectionDetailLenient({
      service: good,
      capabilities: [{ key: 'a', label: 'A', enabled: true }, { key: 'b' }],
      permission: 'super',
      what: ['Satu', 5, ''],
      memoryCount: -4,
    })!;
    expect(d.permission).toBe('baca');
    expect(d.capabilities).toHaveLength(1);
    expect(d.what).toEqual(['Satu']);
    expect(d.memoryCount).toBeUndefined();
    expect(parseConnectionDetailLenient({ capabilities: [] })).toBeNull();
  });

  test('event connection dibaca ketat dan longgar', () => {
    const event: StreamEvent = { type: 'connection', service: svc(), rev: 4 };
    expect(streamEventSchema.safeParse(event).success).toBe(true);
    expect(parseEventLenient({ ...event, removed: true })).toEqual({ ...event, removed: true });
    expect(parseEventLenient({ ...event, service: { ...event.service, category: 'baru' } })).toMatchObject({
      service: { category: 'lainnya' },
    });
    expect(parseEventLenient({ ...event, rev: 0 })).toBeNull();
    expect(parseEventLenient({ ...event, service: { id: 'x' } })).toBeNull();
  });
});

describe('server tiruan', () => {
  test('start: halaman resmi, lalu tersambung dengan event connection dan home (simpul cincin)', async () => {
    const { transport } = make();
    const events: StreamEvent[] = [];
    transport.subscribe(
      (e) => events.push(e),
      () => {},
    );
    await settle();
    const before = await transport.connections();
    const start = await transport.startConnection('tiktok');
    expect(start).toEqual({
      url: expect.stringContaining('https://seller.tiktokshop.com/masuk?state='),
      callbackScheme: 'sekretarisai',
    });
    await settle(60);
    const types = events.map((e) => e.type);
    expect(types).toContain('connection');
    expect(types).toContain('home');
    const conn = events.find((e) => e.type === 'connection')!;
    expect(conn).toMatchObject({ service: { id: 'tiktok', status: 'connected', ring: true }, rev: before.rev + 1 });
    const home = events.find((e) => e.type === 'home')!;
    expect(home.type === 'home' && home.home.ring.nodes.some((n) => n.key === 'tiktok')).toBe(true);
    const after = await transport.connections();
    expect(after.connected.at(-1)).toMatchObject({ id: 'tiktok', since: expect.any(String) });
    expect(after.catalog.some((s) => s.id === 'tiktok')).toBe(false);
    transport.dispose();
  });

  test('start ditolak untuk yang segera hadir, sudah tersambung, Kotak, dan yang tidak ada', async () => {
    const { transport } = make();
    await expect(transport.startConnection('shopee')).rejects.toMatchObject({ status: 400 });
    await expect(transport.startConnection('moka')).rejects.toMatchObject({ status: 400 });
    await expect(transport.startConnection('kotak')).rejects.toMatchObject({ status: 400 });
    await expect(transport.startConnection('tidak-ada')).rejects.toMatchObject({ status: 404 });
    transport.dispose();
  });

  test('izin, forget, dan putuskan: detail, jumlah, dan pindah ke formerly dengan event', async () => {
    const { transport } = make();
    const events: StreamEvent[] = [];
    transport.subscribe(
      (e) => events.push(e),
      () => {},
    );
    await settle();
    expect((await transport.connectionDetail('moka')).permission).toBe('baca');
    const d = await transport.setConnectionPermission('moka', {
      permission: 'baca_tulis',
      capabilities: [{ key: 'stok', enabled: false }],
    });
    expect(d.permission).toBe('baca_tulis');
    expect(d.capabilities.find((c) => c.key === 'stok')!.enabled).toBe(false);
    await expect(transport.setConnectionPermission('m365', { permission: 'baca' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(transport.setConnectionPermission('moka', { permission: 'super' as never })).rejects.toMatchObject({
      status: 400,
    });

    expect((await transport.connectionDetail('moka')).memoryCount).toBe(48);
    expect(await transport.forgetConnection('moka')).toEqual({ ok: true, forgotten: 48 });
    expect((await transport.connectionDetail('moka')).memoryCount).toBe(0);
    expect((await transport.connections()).connected.some((s) => s.id === 'moka')).toBe(true);
    expect(await transport.forgetConnection('moka')).toEqual({ ok: true, forgotten: 0 });
    await expect(transport.forgetConnection('notion')).rejects.toMatchObject({ status: 404 });

    await transport.disconnectConnection('moka');
    await settle();
    const list = await transport.connections();
    expect(list.connected.some((s) => s.id === 'moka')).toBe(false);
    expect(list.formerly.map((s) => s.id)).toEqual(['moka']);
    expect(events.find((e) => e.type === 'connection')).toMatchObject({
      service: { id: 'moka', status: 'formerly', ring: false },
    });
    await expect(transport.disconnectConnection('moka')).rejects.toMatchObject({ status: 404 });
    transport.dispose();
  });
});

describe('ConnectionsController', () => {
  const done =
    (id: string): OpenAuth =>
    async () => {
      jest.advanceTimersByTime(100);
      return { type: 'success', url: `sekretarisai://terhubung/tersambung?id=${id}&ok=1` };
    };

  test('sambung berhasil: halaman resmi dibuka dengan alamat kembali, layanan tampil tersambung', async () => {
    const open = jest.fn(done('notion'));
    const { transport, controller } = make('server', open);
    await controller.load();
    const job = controller.connect('notion');
    expect(controller.getState().flows.notion!.phase).toBe('opening');
    await settle();
    await job;
    expect(open).toHaveBeenCalledWith(expect.stringContaining('notion.so'), 'sekretarisai://terhubung/tersambung');
    expect(controller.getState().flows.notion).toEqual({ phase: 'connected', message: null });
    expect(controller.getState().list.data!.connected.some((s) => s.id === 'notion')).toBe(true);
    expect(controller.getState().list.data!.catalog.some((s) => s.id === 'notion')).toBe(false);
    controller.resetFlow('notion');
    expect(controller.getState().flows.notion).toBeUndefined();
    controller.stop();
    transport.dispose();
  });

  test('pengguna menutup halaman: dibatalkan; ditutup setelah server menyimpan: tersambung', async () => {
    const { transport, controller } = make('server', async () => ({ type: 'cancel' }));
    await controller.connect('notion');
    expect(controller.getState().flows.notion).toMatchObject({
      phase: 'cancelled',
      message: expect.stringContaining('ditutup'),
    });
    controller.stop();
    transport.dispose();

    const late = make('server', async () => {
      jest.advanceTimersByTime(100);
      return { type: 'cancel' };
    });
    await late.controller.connect('plaud');
    expect(late.controller.getState().flows.plaud).toEqual({ phase: 'connected', message: null });
    late.controller.stop();
    late.transport.dispose();
  });

  test('server menolak (ok=0) dan permintaan mulai gagal: kalimat ramah', async () => {
    const denied = make('server', async () => ({
      type: 'success',
      url: 'sekretarisai://terhubung/tersambung?id=notion&ok=0&reason=ditolak',
    }));
    await denied.controller.load();
    await denied.controller.connect('notion');
    expect(denied.controller.getState().flows.notion).toMatchObject({
      phase: 'failed',
      message: 'Izin dari Notion belum diberikan, jadi belum tersambung.',
    });
    denied.controller.stop();
    denied.transport.dispose();

    const open = jest.fn();
    const broken = make('server', open);
    broken.transport.failNext('network');
    await broken.controller.connect('notion');
    expect(broken.controller.getState().flows.notion!.phase).toBe('failed');
    expect(open).not.toHaveBeenCalled();
    broken.controller.stop();
    broken.transport.dispose();
  });

  test('ok=1 tetapi server tidak pernah menyimpan: gagal setelah menunggu', async () => {
    const { transport, controller } = make('server', async () => ({
      type: 'success',
      url: 'sekretarisai://terhubung/tersambung?id=notion&ok=1',
    }));
    jest.spyOn(transport, 'startConnection').mockResolvedValue({ url: 'https://x.id', callbackScheme: 'sekretarisai' });
    const job = controller.connect('notion');
    await settle(7000);
    await job;
    expect(controller.getState().flows.notion!.phase).toBe('failed');
    controller.stop();
    transport.dispose();
  });

  test('mode contoh: tanpa halaman sungguhan, menunggu server tiruan menyelesaikan', async () => {
    const open = jest.fn();
    const { transport, controller } = make('contoh', open);
    const job = controller.connect('github');
    await settle(100);
    await job;
    expect(open).not.toHaveBeenCalled();
    expect(controller.getState().flows.github!.phase).toBe('connected');
    controller.stop();
    transport.dispose();
  });

  test('alamat kembali saat aplikasi dibuka dingin: aman diulang', async () => {
    const { transport, controller } = make('server');
    await transport.startConnection('plaud');
    await settle(100);
    await controller.handleCallback({ id: 'plaud', ok: true, reason: null });
    await controller.handleCallback({ id: 'plaud', ok: true, reason: null });
    expect(controller.getState().flows.plaud!.phase).toBe('connected');
    await controller.handleCallback({ id: null, ok: true, reason: null });
    controller.stop();
    transport.dispose();
  });

  test('izin berubah dulu lalu dikembalikan kalau gagal; detail dari server menggantikan', async () => {
    const { transport, controller } = make();
    await controller.loadDetail('moka');
    transport.failNext('server');
    const failed = controller.setPermission('moka', 'baca_tulis');
    expect(controller.getState().details.moka!.data!.permission).toBe('baca_tulis');
    expect(await failed).toMatchObject({ ok: false });
    expect(controller.getState().details.moka!.data!.permission).toBe('baca');
    expect(await controller.setPermission('moka', 'baca_tulis')).toEqual({ ok: true });
    expect(controller.getState().details.moka!.data!.permission).toBe('baca_tulis');
    expect(await controller.setPermission('moka', 'baca_tulis')).toEqual({ ok: true });
    expect(await controller.setPermission('tanpa-detail', 'baca')).toEqual({ ok: true });
    controller.stop();
    transport.dispose();
  });

  test('forget: jumlah dikembalikan, detail jadi nol; gagal memberi pesan ramah', async () => {
    const { transport, controller } = make();
    await controller.loadDetail('gmail');
    expect(controller.getState().details.gmail!.data!.memoryCount).toBe(120);
    expect(await controller.forget('gmail')).toEqual({ ok: true, forgotten: 120 });
    expect(controller.getState().details.gmail!.data!.memoryCount).toBe(0);
    transport.failNext('network');
    expect(await controller.forget('gmail')).toMatchObject({ ok: false });
    expect(controller.getState().busy.size).toBe(0);
    controller.stop();
    transport.dispose();
  });

  test('putuskan: pindah ke formerly dan detailnya dibuang; layanan tak dikenal gagal', async () => {
    const { transport, controller } = make();
    await controller.load();
    await controller.loadDetail('moka');
    expect(await controller.disconnect('moka')).toEqual({ ok: true });
    const list = controller.getState().list.data!;
    expect(list.connected.some((s) => s.id === 'moka')).toBe(false);
    expect(list.formerly[0]).toMatchObject({ id: 'moka', status: 'formerly', ring: false });
    expect(controller.getState().details.moka).toBeUndefined();
    expect(await controller.disconnect('moka')).toMatchObject({ ok: false });
    controller.stop();
    transport.dispose();
  });

  test('event connection: upsert menurut status, yang lebih lama dibuang, removed menghapus', async () => {
    const { transport, controller } = make();
    await controller.load();
    await controller.loadDetail('gcal');
    const rev = controller.getState().list.data!.rev;
    const apply = (e: StreamEvent) => (controller as unknown as { onEvent: (e: StreamEvent) => void }).onEvent(e);
    apply({ type: 'connection', service: svc({ id: 'baru', name: 'Baru' }), rev: rev + 1 });
    expect(controller.getState().list.data!.connected.at(-1)!.id).toBe('baru');
    apply({ type: 'connection', service: svc({ id: 'baru', name: 'Baru2', status: 'formerly' }), rev: rev + 2 });
    expect(controller.getState().list.data!.connected.some((s) => s.id === 'baru')).toBe(false);
    expect(controller.getState().list.data!.formerly[0]!.name).toBe('Baru2');
    apply({ type: 'connection', service: svc({ id: 'baru', status: 'connected' }), rev: rev });
    expect(controller.getState().list.data!.connected.some((s) => s.id === 'baru')).toBe(false);
    apply({
      type: 'connection',
      service: svc({ id: 'gcal', name: 'Kalender', status: 'connected', needsAttention: 'Perlu disambungkan ulang' }),
      rev: rev + 3,
    });
    expect(controller.getState().details.gcal!.data!.service.needsAttention).toBe('Perlu disambungkan ulang');
    apply({ type: 'connection', service: svc({ id: 'baru' }), removed: true, rev: rev + 4 });
    const l = controller.getState().list.data!;
    expect([...l.connected, ...l.catalog, ...l.formerly].some((s) => s.id === 'baru')).toBe(false);
    expect(l.rev).toBe(rev + 4);
    controller.stop();
    transport.dispose();
  });

  test('gagal memuat: error ramah; detail tidak ada: tidak ditemukan; resync memuat ulang', async () => {
    const transport = new FakeTransport(createMemorySession(null), { mode: 'server' });
    const controller = new ConnectionsController(transport);
    transport.failNext('network');
    await controller.load();
    expect(controller.getState().list).toMatchObject({ status: 'error', data: null });
    await controller.loadDetail('tidak-ada');
    expect(controller.getState().details['tidak-ada']).toMatchObject({
      status: 'error',
      error: 'Layanan ini tidak ditemukan.',
    });
    const spy = jest.spyOn(transport, 'connections');
    await controller.reloadAll();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(controller.getState().list.status).toBe('ready');
    // gagal lagi setelah punya data: data lama tetap
    transport.failNext('network');
    await controller.load();
    expect(controller.getState().list.status).toBe('ready');
    controller.stop();
    transport.dispose();
    expect(new ApiFailure('network')).toBeInstanceOf(Error);
  });
});
