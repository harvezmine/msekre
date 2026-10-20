import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { QR_SIZE, qrCells } from './qrPattern';

// Satu jalur untuk seluruh sel (sedikit tumpang tindih 1,02 supaya tak ada celah), bukan ratusan simpul.
const QR_PATH = qrCells()
  .map(({ x, y }) => `M${x} ${y}h1.02v1.02h-1.02z`)
  .join('');

/**
 * Kotak putih berisi pola QR contoh (bukan kode sungguhan). Kotak putih tetap putih di mode gelap supaya terpindai.
 * Tanpa `showCode` kotaknya kosong (gambar sedang diambil, atau sudah tidak berlaku).
 */
export function QrCode({
  showCode = true,
  faded = false,
  testID = 'qris-kode',
  label = 'Kode QRIS contoh',
}: {
  showCode?: boolean;
  faded?: boolean;
  testID?: string;
  label?: string;
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{
        width: 208,
        height: 208,
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E6DE',
        opacity: faded ? 0.25 : 1,
      }}
    >
      {showCode && (
        <Svg width="100%" height="100%" viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} fill="#0D2B22">
          <Path d={QR_PATH} />
        </Svg>
      )}
    </View>
  );
}
