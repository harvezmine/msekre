import { useState } from 'react';
import { useApi } from '@/api/ApiProvider';
import { MODE_LABEL, type DataMode } from '@/api/mode';
import { ChoiceSheet, ListRow } from '../kit';
import { useToast } from '../toastStore';

const ICON = 46;
/** Dua pilihan untuk pengguna; `server` (semua dari server asli) hanya di lembar mode pengembangan. */
const CHOICES = [
  { id: 'akun', label: MODE_LABEL.akun },
  { id: 'contoh', label: MODE_LABEL.contoh },
] as const;

/**
 * Baris "Data" di Akun: akun asli (chat dan suara dari server, layar lain contoh) atau contoh saja. Hanya bila alamat
 * server diatur. Pindah ke Akun Anda tanpa sesi tersimpan membuka layar masuk (penjaga rute); pindah ke Contoh
 * membiarkan sesi akun tersimpan, jadi kembali lagi tidak perlu masuk ulang.
 */
export function DataRow() {
  const { mode, canUseServer, setMode } = useApi();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!canUseServer) return null;
  const pick = (id: string) => {
    const next = id as DataMode;
    if (next === mode) return;
    void setMode(next).then((ok) => {
      if (ok && next === 'contoh') toast('Sekarang memakai data contoh.');
    });
  };
  return (
    <>
      <ListRow
        icon="globe"
        tone="terhubung"
        iconSize={ICON}
        title="Data"
        value={MODE_LABEL[mode]}
        chevron
        onPress={() => setOpen(true)}
      />
      <ChoiceSheet
        visible={open}
        title="Data"
        choices={CHOICES}
        value={mode}
        onPick={pick}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
