import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

export function OrdersRow({ count, onPress }: { count: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        android_ripple={{ color: c.ripple }}
        style={{
          minHeight: 72,
          paddingVertical: 16,
          paddingLeft: 20,
          paddingRight: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bag" size={22} color={c.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={500}>TikTok Shop: {count} pesanan perlu dikirim</Txt>
          <Txt v="caption" color={c.muted}>
            dari TikTok Shop
          </Txt>
        </View>
        <Icon name="chevR" size={20} color={c.muted} />
      </Pressable>
    </Card>
  );
}
