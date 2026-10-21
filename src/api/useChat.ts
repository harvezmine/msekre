import { useEffect, useSyncExternalStore } from 'react';
import { useChatController } from './ChatProvider';
import type { ChatController } from './chatController';
import { chosenIn, isChatThinking, type ChatState } from './chatState';
import type { Message } from './contract';

/** Aksi chat yang identitasnya tetap selama pengendali yang sama (aman dioper ke baris daftar yang di-memo). */
export type ChatActions = Pick<
  ChatController,
  | 'send'
  | 'retry'
  | 'choose'
  | 'loadInitial'
  | 'loadOlder'
  | 'ensureDraft'
  | 'draftAction'
  | 'controlDevice'
  | 'mediaUrl'
>;

export interface Chat extends ChatState {
  /** Aksi yang sama dengan metode di bawah, dalam satu objek yang tidak berganti tiap perubahan keadaan. */
  actions: ChatActions;
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
  /** Aksi pada kartu draf ini sedang berjalan: tombolnya terkunci. */
  draftBusy(id: string): boolean;
  controlDevice: ChatController['controlDevice'];
  mediaUrl: ChatController['mediaUrl'];
}

/**
 * Utas chat untuk layar, dari pengendali bersama di {@link ChatProvider} (hidup selama aplikasi terbuka): riwayat, gelembung optimistis, tombol pilihan, kartu draf, tanda berpikir, status koneksi, dan
 * antrean saat koneksi putus. Sama di mode `contoh` dan `server`; layar tidak tahu transport mana yang dipakai.
 * `onError` menerima teks ramah saat aksi kartu gagal (untuk toast); `onPinRequired` menerima id perangkat yang butuh PIN.
 */
export function useChat({
  onError,
  onPinRequired,
}: { onError?: (text: string) => void; onPinRequired?: (deviceId: string) => void } = {}): Chat {
  const controller = useChatController();
  useEffect(() => {
    controller.setErrorHandler(onError);
    return () => controller.setErrorHandler(undefined);
  }, [controller, onError]);
  useEffect(() => {
    controller.setPinHandler(onPinRequired);
    return () => controller.setPinHandler(undefined);
  }, [controller, onPinRequired]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return {
    ...state,
    actions: controller,
    thinking: isChatThinking(state),
    chosen: (message) => chosenIn(state, message),
    send: controller.send,
    retry: controller.retry,
    choose: controller.choose,
    loadInitial: controller.loadInitial,
    loadOlder: controller.loadOlder,
    draftAction: controller.draftAction,
    draftBusy: (id) => state.busyDrafts.has(id),
    controlDevice: controller.controlDevice,
    mediaUrl: controller.mediaUrl,
  };
}
