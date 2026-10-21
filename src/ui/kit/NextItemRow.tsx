import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { AccentIcon } from './AccentIcon';
import { PressableScale } from './PressableScale';

/** Agenda berikutnya (§8 `NextItemRow`): ikon kalender biru, jam, dua-tiga kata, chevron. Tanpa permukaan. */
export function NextItemRow({
  time,
  title,
  compact = false,
  onPress,
}: {
  /** "13.00", atau "Besok 07.00". */
  time: string;
  title: string;
  compact?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Agenda berikutnya, ${time}, ${title}`}
      accessibilityHint="Buka Agenda"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        minHeight: compact ? 56 : 64,
      }}
    >
      <AccentIcon icon="calendar" tone="agenda" size={48} />
      <Txt v="section" tabular>
        {time}
      </Txt>
      {/* Judul utuh lebih jelas daripada terpotong: paling banyak dua baris, baris tetap minimal 64. */}
      <Txt v="section" weight={400} numberOfLines={2} style={{ flex: 1, letterSpacing: 0 }}>
        {title}
      </Txt>
      <Icon name="chevR" size={22} color={c.faint} />
    </PressableScale>
  );
}
