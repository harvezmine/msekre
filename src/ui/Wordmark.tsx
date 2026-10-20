import { Image, View } from 'react-native';
import { APP_NAME } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

const MARK = require('../../assets/brand/s-mark.png');
const MARK_LIGHT = require('../../assets/brand/s-mark-light.png');
const [FIRST, ...REST] = APP_NAME.split(' ');
const LAST = REST.pop() ?? '';

/** Tanda S dan nama aplikasi, dengan "AI" hijau (Wordmark di desain). `size` = ukuran huruf. */
export function Wordmark({ size = 22 }: { size?: number }) {
  const { c, scheme } = useTheme();
  const markH = Math.round(size * 1.6);
  return (
    <View
      accessible
      accessibilityLabel={APP_NAME}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.45) }}
    >
      <Image
        source={scheme === 'dark' ? MARK_LIGHT : MARK}
        style={{ height: markH, width: Math.round((markH * 282) / 310) }}
        accessibilityElementsHidden
      />
      <Txt weight={700} style={{ fontSize: size, lineHeight: size + 2, letterSpacing: -size * 0.02 }}>
        {[FIRST, ...REST].join(' ')}{' '}
        <Txt
          weight={700}
          color={scheme === 'dark' ? c.sage : c.leaf}
          style={{ fontSize: size, lineHeight: size + 2, letterSpacing: -size * 0.02 }}
        >
          {LAST}
        </Txt>
      </Txt>
    </View>
  );
}
