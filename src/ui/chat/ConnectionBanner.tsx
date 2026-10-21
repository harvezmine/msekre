import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BLOCKED_TEXT, UPGRADE_TEXT } from '@/api/errors';
import type { ConnectionStatus } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Koneksi harus putus selama ini sebelum banner tampil, supaya kedipan sesaat tidak mengagetkan. */
export const OFFLINE_BANNER_MS = 3000;
export const OFFLINE_TEXT = 'Sinyal lemah, pesan Anda saya simpan dulu.';

/** Teks banner untuk keadaan koneksi, atau `null` bila tidak perlu. `lateOffline`: putus sudah lebih dari 3 detik. */
export function bannerText(connection: ConnectionStatus, lateOffline: boolean): string | null {
  if (connection === 'blocked') return BLOCKED_TEXT;
  if (connection === 'upgrade_required') return UPGRADE_TEXT;
  if (connection === 'open') return null;
  return lateOffline ? OFFLINE_TEXT : null;
}

/** Apakah koneksi putus (belum tersambung) sudah lebih dari 3 detik. */
export function useLateOffline(connection: ConnectionStatus): boolean {
  const offline = connection === 'connecting' || connection === 'closed';
  // Tiap kali koneksi mulai putus dihitung sebagai "kejadian" baru, supaya hitungan 3 detik mulai dari awal.
  const [episode, setEpisode] = useState(0);
  const [wasOffline, setWasOffline] = useState(offline);
  if (offline !== wasOffline) {
    setWasOffline(offline);
    if (offline) setEpisode((e) => e + 1);
  }
  const [lateEpisode, setLateEpisode] = useState(-1);
  useEffect(() => {
    if (!offline) return;
    const id = setTimeout(() => setLateEpisode(episode), OFFLINE_BANNER_MS);
    return () => clearTimeout(id);
  }, [offline, episode]);
  return offline && lateEpisode === episode;
}

/**
 * Kabar tenang di bawah kepala chat dengan teks dari {@link bannerText}: kapsul `sunken` dengan ikon kecil, tanpa warna
 * peringatan yang besar. Tanpa teks tidak tampil.
 */
export function ConnectionBanner({ text }: { text: string | null }) {
  const { c, marker } = useTheme();
  if (!text) return null;
  return (
    <View
      testID="banner-koneksi"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 4,
        minHeight: 48,
        borderRadius: 20,
        backgroundColor: c.sunken,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icon name="info" size={20} color={marker.warn.ink} />
      <Txt v="caption" color={c.text} weight={600} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
        {text}
      </Txt>
    </View>
  );
}
