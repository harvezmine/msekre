import { useEffect, useRef } from 'react';
import { draftIntro } from '@/sample/chat';
import { initialOutgoing } from '@/sample/outgoing';
import { deviceById, useSample, type Outgoing } from '@/sample/store';
import { useApi } from './ApiProvider';
import { FakeTransport } from './fake/FakeTransport';
import { draftFromOutgoing } from './fake/history';
import { MAIN_AC_ID } from '@/sample/devices';
import type { Draft, StreamEvent } from './contract';

/**
 * Jembatan mode contoh: chat memakai server tiruan (`FakeTransport`), sedangkan Beranda, Riwayat, dan Usaha masih
 * memakai penyimpanan contoh 0b. Supaya alur prototipe 0b tetap utuh, jembatan ini menjaga keduanya searah:
 * - draf yang berubah di chat (`held`, `cancelled`, `draft` setelah diubah) diteruskan ke penyimpanan contoh
 *   (`sendDraft`, `cancelSend`, `discardDraft`, `editDraft`), jadi Beranda dan Riwayat ikut berubah;
 * - Batalkan di Riwayat (`cancelSend`) diteruskan ke server tiruan (`draftAction cancel`), jadi kartu di chat ikut;
 * - draf baru dari layar lain ("Pesan lagi" di Usaha, `addDraft`) menjadi pesan asisten berisi kartu draf di server
 *   tiruan, jadi muncul di chat;
 * - masa tahan lima menit yang habis di server tiruan (`held` → `sent`) menandai kirimannya terkirim (`markSent`), jadi
 *   Riwayat berhenti menawarkan Batalkan;
 * - penyimpanan contoh adalah satu-satunya sumber keadaan AC: server tiruan membacanya untuk menjawab "AC kamar
 *   gimana?", dan hanya permintaan pengguna yang benar-benar mengubah AC yang diteruskan (`setAc`); jawaban yang hanya
 *   melaporkan keadaan tidak mengubah Beranda atau menambah entri Riwayat.
 *
 * Tidak berbuat apa-apa di mode server. Dipasang sekali di akar, di dalam `ApiProvider` dan `SampleProvider`.
 */
export function ContohBridge() {
  const { mode, transport } = useApi();
  const fake = mode === 'contoh' && transport instanceof FakeTransport ? transport : null;
  const { state, dispatch } = useSample();

  // Keadaan terbaru untuk pendengar stream (yang dipasang sekali per transport).
  const outgoing = useRef(state.outgoing);
  const sample = useRef(state);
  useEffect(() => {
    outgoing.current = state.outgoing;
    sample.current = state;
  });
  /** Perubahan yang berasal dari server tiruan: jangan dikirim balik ke server tiruan. */
  const fromFake = useRef(new Set<string>());

  useEffect(() => {
    if (!fake) return;
    const seen = new Set<string>();
    const draftChanged = (draft: Draft) => {
      const o = outgoing.current[draft.id];
      if (!o) return;
      if (draft.status === 'held' && o.status === 'draft') {
        dispatch({ type: 'sendDraft', id: o.id });
      } else if (draft.status === 'sent' && o.status === 'held') {
        dispatch({ type: 'markSent', id: o.id });
      } else if (draft.status === 'cancelled' && o.status === 'held') {
        fromFake.current.add(o.id);
        dispatch({ type: 'cancelSend', id: o.id });
      } else if (draft.status === 'cancelled' && o.status === 'draft') {
        dispatch({ type: 'discardDraft', id: o.id });
      } else if (draft.status === 'draft' && o.status === 'draft' && draft.text !== o.text) {
        dispatch({ type: 'editDraft', id: o.id, text: draft.text });
      }
    };
    const onEvent = (event: StreamEvent) => {
      if (event.type === 'draft') draftChanged(event.draft);
      if (event.type !== 'message' || event.message.from !== 'assistant' || seen.has(event.message.id)) return;
      seen.add(event.message.id);
      for (const part of event.message.parts) {
        if (part.type !== 'card') continue;
        if (part.card.kind === 'draft') draftChanged(part.card.draft);
      }
    };
    const readAc = () => {
      const ac = deviceById(sample.current, MAIN_AC_ID);
      return { on: ac?.on ?? false, temp: ac?.ac?.temp ?? 24 };
    };
    fake.setAcReader(readAc);
    const offAc = fake.onAcChange(({ on, temp }) =>
      dispatch({ type: 'setAc', deviceId: MAIN_AC_ID, on, temp, source: 'chat' }),
    );
    const off = fake.subscribe(onEvent, () => {});
    return () => {
      off();
      offAc();
      fake.setAcReader(null);
    };
  }, [fake, dispatch]);

  // Draf baru dari layar lain jadi pesan di chat; Batalkan dari Riwayat diteruskan ke server tiruan.
  const injected = useRef(new WeakMap<FakeTransport, Set<string>>());
  const lastStatus = useRef<Record<string, Outgoing['status']>>({});
  useEffect(() => {
    if (!fake) return;
    const ids = injected.current.get(fake) ?? new Set(Object.keys(initialOutgoing));
    injected.current.set(fake, ids);
    for (const o of Object.values(state.outgoing)) {
      if (!ids.has(o.id)) {
        ids.add(o.id);
        fake.receive({
          from: 'assistant',
          via: 'app',
          parts: [
            { type: 'text', text: draftIntro(o.what) },
            { type: 'card', card: { kind: 'draft', draft: draftFromOutgoing(o) } },
          ],
        });
      }
      if (lastStatus.current[o.id] === 'held' && o.status === 'cancelled' && !fromFake.current.delete(o.id)) {
        fake.draftAction(o.id, { action: 'cancel' }).catch(() => {});
      }
      lastStatus.current[o.id] = o.status;
    }
  }, [fake, state.outgoing]);

  return null;
}
