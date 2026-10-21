import { Pressable, ScrollView, View } from 'react-native';
import { GREETING_TIMES } from '@/api/account';
import { useAccount } from '@/api/useAccount';
import { useAssistantName } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { FilterChips } from '@/ui/FilterChips';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

// Sapaan harian (di bawah Akun): satu sapaan tiap pagi, bisa dimatikan. Pengingat yang Anda minta tetap dikirim.
export default function Sapaan() {
  const { c } = useTheme();
  const assistant = useAssistantName();
  const { account, status, error, retry, setGreeting } = useAccount();
  const toast = useToast();

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <BackHeader title="Sapaan harian" />
        <Txt color={c.muted} style={{ padding: 24, textAlign: 'center' }}>
          {status === 'error' ? error : 'Sebentar ya, saya ambil dulu.'}
        </Txt>
        {status === 'error' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={() => void retry()}>
            <Txt weight={600} color={c.green} style={{ textAlign: 'center' }}>
              Coba lagi
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const { daily, time } = account.greeting;
  const apply = async (req: { daily: boolean; time?: string }) => {
    const res = await setGreeting(req);
    if (!res.ok && res.message) toast(res.message);
  };
  const label = 'Sapa saya tiap pagi';
  // Jam yang dipilih dari tempat lain (misalnya lewat WhatsApp) tetap tampil di antara pilihan.
  const times: string[] =
    time && !GREETING_TIMES.some((t) => t === time) ? [...GREETING_TIMES, time].sort() : [...GREETING_TIMES];
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <BackHeader title="Sapaan harian" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 16 }}>
        <ListGroup>
          <ListRow
            icon="chat"
            title={label}
            subtitle={daily ? 'Hidup' : 'Mati'}
            last
            trailing={<Toggle value={daily} onChange={(next) => void apply({ daily: next })} label={label} />}
          />
        </ListGroup>
        {daily ? (
          <View style={{ gap: 4 }}>
            <Txt weight={600} style={{ fontSize: 15, lineHeight: 20, paddingHorizontal: 4 }}>
              Jam sapaan
            </Txt>
            <View style={{ marginHorizontal: -16 }}>
              <FilterChips
                options={times}
                value={time && times.includes(time) ? time : '07.00'}
                onChange={(t) => void apply({ daily: true, time: t })}
              />
            </View>
          </View>
        ) : null}
        <Txt v="caption" color={c.muted} style={{ paddingHorizontal: 4 }}>
          {assistant} menyapa sekali sehari, bukan berkali-kali. Pengingat tetap dikirim walau sapaan dimatikan.
        </Txt>
      </ScrollView>
    </View>
  );
}
