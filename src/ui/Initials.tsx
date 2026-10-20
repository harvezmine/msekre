import { useProfile } from '@/api/useProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Huruf awal nama pengguna untuk avatar; ikon orang bila namanya belum ada (jangan pernah memakai nama contoh). */
export function Initials({ size = 15 }: { size?: number }) {
  const { c } = useTheme();
  const { initials } = useProfile();
  if (!initials) return <Icon name="user" size={Math.round(size * 1.5)} color={c.green} />;
  return (
    <Txt weight={700} color={c.green} style={{ fontSize: size }}>
      {initials}
    </Txt>
  );
}
