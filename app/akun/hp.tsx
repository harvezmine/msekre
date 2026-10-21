import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { agoText } from '@/api/connections';
import { useAccount } from '@/api/useAccount';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Txt } from '@/ui/Txt';

// HP yang terhubung (di bawah Akun): semua HP yang memakai akun ini. HP lain bisa dikeluarkan; HP ini keluar lewat Keluar.
export default function Hp() {
  const { c } = useTheme();
  const { account, status, error, retry, busy } = useAccount();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="HP yang terhubung" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}>
        {account ? (
          <ListGroup>
            {account.phones.map((p, i) => {
              const seen = p.current ? null : agoText(p.lastSeen);
              return (
                <ListRow
                  key={p.id}
                  icon="phone"
                  title={p.current ? `${p.name} (HP ini)` : p.name}
                  subtitle={p.current ? 'Sedang dipakai' : seen ? `Terakhir dipakai ${seen}` : undefined}
                  last={i === account.phones.length - 1}
                  trailing={
                    p.current ? (
                      <View
                        style={{
                          paddingHorizontal: 12,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: c.mint,
                          justifyContent: 'center',
                        }}
                      >
                        <Txt v="caption" weight={600} color={c.green}>
                          HP ini
                        </Txt>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Keluarkan ${p.name}`}
                        accessibilityState={{ disabled: busy.phone(p.id) }}
                        disabled={busy.phone(p.id)}
                        onPress={() => router.push(`/akun/konfirmasi?aksi=hp&id=${encodeURIComponent(p.id)}`)}
                        android_ripple={{ color: c.ripple }}
                        style={{
                          height: 48,
                          paddingHorizontal: 12,
                          justifyContent: 'center',
                          opacity: busy.phone(p.id) ? 0.5 : 1,
                        }}
                      >
                        <Txt weight={600} color={c.clay} style={{ fontSize: 15 }}>
                          Keluarkan
                        </Txt>
                      </Pressable>
                    )
                  }
                />
              );
            })}
          </ListGroup>
        ) : (
          <View style={{ gap: 8 }}>
            <Txt color={c.muted}>{status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}</Txt>
            {status === 'error' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void retry()}>
                <Txt weight={600} color={c.green}>
                  Coba lagi
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}
        <Txt v="caption" color={c.muted} style={{ paddingHorizontal: 4 }}>
          HP yang dikeluarkan langsung keluar dari akun ini dan tidak lagi menerima notifikasi. Untuk HP ini, pakai
          Keluar di Akun.
        </Txt>
      </ScrollView>
    </View>
  );
}
