import { router } from 'expo-router';
import { useRef } from 'react';
import { useAuth } from '@/api/useAuth';
import { ConfirmBody } from '@/ui/kit';
import { Sheet, useSheet } from '@/ui/Sheet';

// Lembar konfirmasi keluar dari akun. Dibuka dengan presentation transparentModal dari Stack.
export default function Keluar() {
  return (
    <Sheet onClose={() => router.back()}>
      <Isi />
    </Sheet>
  );
}

function Isi() {
  const { logout } = useAuth();
  const { close } = useSheet();
  const leaving = useRef(false);
  const run = () => {
    // Ketukan kedua diabaikan: keluar hanya sekali.
    if (leaving.current) return;
    leaving.current = true;
    close(() => {
      void logout().then(() => {
        // Di mode server penjaga rute (app/_layout.tsx) sudah menutup semua layar aplikasi; mode contoh tidak punya
        // penjaga. Tumpukan dibersihkan di kedua mode: dari layar masuk, "kembali" tidak mendarat di isi akun lama.
        router.dismissAll();
        router.replace('/mulai');
      });
    });
  };
  return (
    <ConfirmBody
      icon="logout"
      title="Keluar dari akun ini?"
      message="Riwayat tetap tersimpan, dan Anda bisa masuk lagi kapan saja."
      confirm="Keluar"
      onConfirm={run}
      onCancel={() => close()}
    />
  );
}
