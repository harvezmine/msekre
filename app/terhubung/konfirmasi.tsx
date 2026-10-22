// Niat lembar: memastikan satu tindakan yang sulit dibatalkan dari detail layanan, hapus yang asisten pelajari
// (aksi=lupa) atau putuskan (aksi=putus). Tindakan tersering: tombol konfirmasi besar di bawah, Batal di sebelahnya.
import { router, useLocalSearchParams } from 'expo-router';
import { useConnections } from '@/api/useConnections';
import { useAssistantName } from '@/api/useProfile';
import { ConfirmBody } from '@/ui/kit';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

export default function Konfirmasi() {
  const { id, aksi } = useLocalSearchParams<{ id?: string; aksi?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} putus={aksi === 'putus'} />
    </Sheet>
  );
}

function Isi({ id, putus }: { id: string; putus: boolean }) {
  const assistant = useAssistantName();
  const { service, forget, disconnect, busy } = useConnections(id);
  const { close } = useSheet();
  const toast = useToast();
  if (!service) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>Layanan ini tidak ditemukan.</Txt>;
  }
  const run = async () => {
    if (putus) {
      const res = await disconnect(id);
      // Sedang berjalan dari ketukan sebelumnya: jangan menutup lembar dan jangan membuat toast kosong.
      if (!res.ok && !res.message) return;
      close(() => {
        if (!res.ok) return toast(res.message);
        toast(`${service.name} diputuskan.`);
        // Tumpukan bisa berisi Tersambung/detail layanan yang kini tak tersambung; mulai dari Beranda supaya "kembali" tak mendarat di sana.
        router.dismissTo('/');
        router.push('/terhubung');
      });
    } else {
      const res = await forget(id);
      if (!res.ok && !res.message) return;
      close(() =>
        toast(
          res.ok
            ? `Yang ${assistant} pelajari dari ${service.name} sudah dihapus.`
            : res.message || 'Belum bisa menghapus. Coba lagi sebentar ya.',
        ),
      );
    }
  };
  const working = putus ? busy.disconnect : busy.forget;
  return (
    <ConfirmBody
      icon={putus ? 'x' : 'trash'}
      title={putus ? `Putuskan ${service.name}?` : `Hapus yang ${assistant} pelajari dari ${service.name}?`}
      message={
        putus
          ? `${assistant} tidak lagi membaca atau bertindak di layanan ini. Anda bisa menyambungkannya lagi kapan saja.`
          : `Sambungannya tetap ada. Semua yang ${assistant} ingat dari layanan ini dihapus.`
      }
      confirm={putus ? 'Ya, putuskan' : 'Ya, hapus'}
      busy={working}
      onConfirm={() => void run()}
      onCancel={() => close()}
    />
  );
}
