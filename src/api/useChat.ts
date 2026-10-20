import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ChatController } from './chatController';
import { chosenIn, isChatThinking, type ChatState } from './chatState';
import type { Message } from './contract';
import { useApi } from './ApiProvider';

export interface Chat extends ChatState {
  /** Asisten sedang berpikir (himpunan `runId` aktif tidak kosong). */
  thinking: boolean;
  /** Pilihan yang sudah diambil di pesan ini: dari server atau dari ketukan yang masih berjalan. */
  chosen(message: Message): string | undefined;
  send: ChatController['send'];
  retry: ChatController['retry'];
  choose: ChatController['choose'];
  loadInitial: ChatController['loadInitial'];
  loadOlder: ChatController['loadOlder'];
  draftAction: ChatController['draftAction'];
  controlDevice: ChatController['controlDevice'];
  mediaUrl: ChatController['mediaUrl'];
}

/**
 * Utas chat untuk layar: riwayat, gelembung optimistis, tombol pilihan, kartu draf, tanda berpikir, status koneksi, dan
 * antrean saat koneksi putus. Sama di mode `contoh` dan `server`; layar tidak tahu transport mana yang dipakai.
 * `onError` menerima teks ramah saat aksi kartu gagal (untuk toast).
 */
export function useChat({ onError }: { onError?: (text: string) => void } = {}): Chat {
  const { transport } = useApi();
  const controller = useMemo(() => new ChatController(transport), [transport]);
  useEffect(() => {
    controller.setErrorHandler(onError);
  }, [controller, onError]);
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return {
    ...state,
    thinking: isChatThinking(state),
    chosen: (message) => chosenIn(state, message),
    send: controller.send,
    retry: controller.retry,
    choose: controller.choose,
    loadInitial: controller.loadInitial,
    loadOlder: controller.loadOlder,
    draftAction: controller.draftAction,
    controlDevice: controller.controlDevice,
    mediaUrl: controller.mediaUrl,
  };
}
