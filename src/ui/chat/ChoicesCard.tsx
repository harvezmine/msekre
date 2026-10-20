import { Pressable, View } from 'react-native';
import type { Choice } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/**
 * Tombol pilihan di bawah pesan asisten. Mengetuk satu mengirim pilihan itu dan mengunci tombolnya; sesudah ada
 * `chosenId` hanya pilihan yang diambil yang tampil (dengan tanda centang).
 */
export function ChoicesCard({
  prompt,
  choices,
  chosenId,
  onChoose,
}: {
  prompt?: string;
  choices: Choice[];
  chosenId?: string;
  onChoose: (choiceId: string) => void;
}) {
  const { c } = useTheme();
  const shown = chosenId === undefined ? choices : choices.filter((x) => x.id === chosenId);
  return (
    <View style={{ gap: 8, alignSelf: 'stretch', maxWidth: 340 }}>
      {prompt ? <Txt color={c.muted}>{prompt}</Txt> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((choice) => {
          const taken = choice.id === chosenId;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={choice.title}
              accessibilityState={{ disabled: chosenId !== undefined, selected: taken }}
              disabled={chosenId !== undefined}
              onPress={() => onChoose(choice.id)}
              android_ripple={{ color: c.ripple }}
              style={{
                minHeight: 48,
                borderRadius: 24,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: taken ? c.green : c.card,
                borderWidth: taken ? 0 : 1,
                borderColor: c.line,
              }}
            >
              {taken && <Icon name="check" size={20} color={c.onGreen} />}
              <View style={{ flexShrink: 1 }}>
                <Txt weight={600} color={taken ? c.onGreen : c.green}>
                  {choice.title}
                </Txt>
                {choice.description ? (
                  <Txt v="caption" color={taken ? c.onGreen : c.muted}>
                    {choice.description}
                  </Txt>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
