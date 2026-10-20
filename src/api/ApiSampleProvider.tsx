import type { ReactNode } from 'react';
import type { SampleState } from '@/sample/reducer';
import { SampleProvider } from '@/sample/store';
import { useApi } from './ApiProvider';
import { FakeTransport } from './fake/FakeTransport';

/**
 * Menghubungkan penyimpanan contoh dengan sumber data. Mode `contoh`: layar yang belum pindah ke kontrak (Agenda,
 * Perangkat, Usaha, Terhubung, Riwayat, Akun) melihat penyimpanan milik server tiruan, jadi data yang sama dengan yang
 * dilihat Beranda dan chat. Mode `server`: penyimpanan sendiri yang terpisah (sementara, sampai layar-layar itu pindah
 * ke kontrak). Dipasang di dalam `ApiProvider`.
 */
export function ApiSampleProvider({ children, initial }: { children: ReactNode; initial?: SampleState }) {
  const { mode, transport } = useApi();
  const store = mode === 'contoh' && transport instanceof FakeTransport ? transport.sample : undefined;
  return (
    <SampleProvider initial={initial} store={store}>
      {children}
    </SampleProvider>
  );
}
