// Remote kamera: satu niat, melihat keadaan ruangan; gambar terakhir besar di atas, satu tombol rekam/privasi di zona
// jempol (privasi = berhenti merekam, dijaga PIN bila aktif; tidak pernah dari chat atau rutinitas).
import { useWindowDimensions, View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { byLayout } from '../kit/layout';
import { RemoteKey } from '../kit/RemoteKey';
import { Txt } from '../Txt';
import { isRecording } from '../device/present';
import { Snapshot } from '../device/Snapshot';
import { capOf } from './caps';
import { useRemoteSizes } from './parts';
import { useRemote } from './RemoteContext';
import { RemoteFrame } from './RemoteFrame';

/** Jam gambar terakhir ("08.30") dari ISO 8601, menurut jam HP. */
export function snapshotTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CameraRemote() {
  const { c, marker, radius } = useTheme();
  const { width } = useWindowDimensions();
  const { device, control, mediaUrl } = useRemote();
  const sizes = useRemoteSizes();
  const s = deviceStateOf(device);
  const camera = capOf(device, 'camera');
  const recording = isRecording(device);
  const w = width - 40;
  const h = Math.round(w * byLayout(sizes.cls, { compact: 0.62, regular: 0.75, tall: 0.8 }));
  const at = snapshotTime(s.snapshotAt);

  // Privasi (berhenti merekam) adalah aksi yang dijaga: lembar PIN dibuka otomatis bila PIN aktif.
  const toggle = () => {
    if (camera) void control({ privacy: recording });
    else void control({ on: !recording });
  };

  const top = (
    <View style={{ paddingHorizontal: 20, paddingTop: sizes.lead, gap: 10 }}>
      {recording && s.snapshotMediaId ? (
        <View>
          <Snapshot
            mediaId={s.snapshotMediaId}
            mediaUrl={mediaUrl}
            label={`Gambar terakhir ${device.name}`}
            style={{ width: w, height: h, borderRadius: radius.card }}
          />
          <View
            testID="titik-rekam"
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: marker.warn.base,
              boxShadow: '0 0 0 4px rgba(229,72,77,0.25)',
            }}
          />
        </View>
      ) : (
        <View
          testID="kamera-privasi"
          style={{
            width: w,
            height: h,
            borderRadius: radius.card,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={recording ? 'camera' : 'eyeOff'} size={44} color={c.muted} />
        </View>
      )}
      {recording && at ? (
        <Txt v="caption" tabular color={c.muted}>
          {at}
        </Txt>
      ) : null}
    </View>
  );

  const bottom = (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <RemoteKey
        testID="tombol-rekam"
        label="Rekam"
        icon={recording ? 'camera' : 'eyeOff'}
        variant="power"
        on={recording}
        size={sizes.power}
        onPress={toggle}
      />
      <Txt
        v="label"
        color={recording ? c.brandInk : c.muted}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {recording ? 'Merekam' : 'Privasi'}
      </Txt>
    </View>
  );

  return <RemoteFrame top={top} bottom={bottom} />;
}
