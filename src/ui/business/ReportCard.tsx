import { Pressable, View } from 'react-native';
import { REPORT_FILE, REPORT_REQUEST } from '@/sample/business';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

export function ReportCard({ onOpen }: { onOpen: () => void }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <Txt v="subtitle">Laporan</Txt>
      <View
        style={{
          alignSelf: 'flex-end',
          maxWidth: '85%',
          backgroundColor: c.green,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 6,
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}
      >
        <Txt color={c.onGreen}>{REPORT_REQUEST}</Txt>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: c.paper,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 48,
            borderRadius: 12,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="file" size={22} color={c.green} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={600}>{REPORT_FILE.name}</Txt>
          <Txt v="caption" color={c.muted}>
            {REPORT_FILE.meta}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Buka ${REPORT_FILE.name}`}
          onPress={onOpen}
          android_ripple={{ color: c.ripple }}
          style={{
            height: 48,
            paddingHorizontal: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={600}>Buka</Txt>
        </Pressable>
      </View>
    </Card>
  );
}
