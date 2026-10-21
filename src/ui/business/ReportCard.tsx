import { View } from 'react-native';
import { mimeOfName } from '@/api/business';
import type { BusinessReport } from '@/api/contract';
import { formatFileMeta } from '@/api/format';
import type { MediaSource } from '@/api/transport';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '../Card';
import { CardButton } from '../chat/ChatCard';
import { useDocumentActions } from '../chat/useDocumentActions';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Laporan terakhir: Buka dan Bagikan memakai alur unduh dokumen yang sama dengan kartu berkas di chat. */
export function ReportCard({
  report,
  mediaUrl,
}: {
  report: BusinessReport;
  mediaUrl: (mediaId: string) => Promise<MediaSource>;
}) {
  const { c } = useTheme();
  const mime = mimeOfName(report.name);
  const { busy, open, share } = useDocumentActions(
    { mediaId: report.mediaId, name: report.name, mime, size: report.size },
    mediaUrl,
  );
  return (
    <Card style={{ gap: 12 }}>
      <Txt v="subtitle">Laporan</Txt>
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
          <Txt weight={600} style={{ lineHeight: 22 }}>
            {report.name}
          </Txt>
          <Txt v="caption" color={c.muted}>
            {formatFileMeta(report.size, mime)}
            {report.period ? ` · ${report.period}` : ''}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <CardButton label={busy === 'open' ? 'Mengunduh…' : 'Buka'} disabled={busy !== null} onPress={open} />
        <CardButton label={busy === 'share' ? 'Mengunduh…' : 'Bagikan'} disabled={busy !== null} onPress={share} />
      </View>
    </Card>
  );
}
