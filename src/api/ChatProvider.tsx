import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { useApi } from './ApiProvider';
import { needsSignIn } from './mode';
import { ChatController } from './chatController';
import { useAuth } from './useAuth';

export const ChatContext = createContext<ChatController | null>(null);

/**
 * Pemilik utas chat untuk seluruh aplikasi, di dalam `ApiProvider` dan `AuthProvider`. Pengendalinya hidup selama
 * aplikasi terbuka, bukan selama layar chat terbuka, jadi pesan yang diantre saat sinyal putus tetap terkirim begitu
 * tersambung lagi walau pengguna sudah kembali ke Beranda, dan pesan itu sudah ada saat chat dibuka lagi.
 *
 * Satu pengendali per transport. Pengendali lama dihentikan saat transport diganti (mode data berganti) dan saat
 * keluar di mode `akun` atau `server` (`signedOut`), jadi utas dan antreannya tidak bocor ke pengguna berikutnya. Selama belum
 * masuk (atau sesi masih diperiksa) pengendalinya ada tapi tidak dijalankan: stream tidak dibuka dan tidak ada yang
 * dikirim. Mode `contoh` tidak mewajibkan masuk, jadi selalu berjalan.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { transport, mode } = useApi();
  const { status } = useAuth();
  const active = !needsSignIn(mode) || status === 'signedIn';
  // Pengendali yang berjalan hanya ada selama `active`; selain itu layar mendapat pengendali kosong yang tidak dijalankan.
  const running = useMemo(() => (active ? new ChatController(transport) : null), [transport, active]);
  const idle = useMemo(() => new ChatController(transport), [transport]);
  useEffect(() => {
    if (!running) return;
    running.start();
    return () => running.stop();
  }, [running]);
  return <ChatContext value={running ?? idle}>{children}</ChatContext>;
}

/** Pengendali utas bersama. Hanya di dalam {@link ChatProvider}. */
export function useChatController(): ChatController {
  const controller = use(ChatContext);
  if (!controller) throw new Error('useChat dipakai di luar ChatProvider');
  return controller;
}
