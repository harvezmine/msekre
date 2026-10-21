import { router, useLocalSearchParams } from 'expo-router';
import { useAccount } from '@/api/useAccount';
import { ConfirmBody } from '@/ui/kit';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

// Lembar konfirmasi dari pengaturan Akun: keluarkan HP lain (aksi=hp).
export default function Konfirmasi() {
  const { id } = useLocalSearchParams<{ id?: string; aksi?: string }>();
  return (
    <Sheet onClose={() => router.back()}>
      <Isi id={typeof id === 'string' ? id : ''} />
    </Sheet>
  );
}

function Isi({ id }: { id: string }) {
  const toast = useToast();
  const { account, removePhone, busy } = useAccount();
  const { close } = useSheet();
  const phone = account?.phones.find((p) => p.id === id);
  if (!phone || phone.current) {
    return <Txt style={{ paddingVertical: 24, textAlign: 'center' }}>HP ini tidak ditemukan.</Txt>;
  }
  const run = async () => {
    const res = await removePhone(id);
    close(() => {
      if (res.ok) toast(`${phone.name} dikeluarkan.`);
      else if (res.message) toast(res.message);
    });
  };
  const working = busy.phone(id);
  return (
    <ConfirmBody
      icon="phone"
      title={`Keluarkan ${phone.name}?`}
      message="HP itu langsung keluar dari akun ini dan tidak lagi menerima notifikasi. Anda bisa masuk lagi dari HP itu kapan saja."
      confirm="Ya, keluarkan"
      busy={working}
      onConfirm={() => void run()}
      onCancel={() => close()}
    />
  );
}
