import { Pressable, StyleSheet, View } from 'react-native';

import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APPEARANCE_OPTIONS, setAppearance, useAppearance } from '@/lib/appearance';

export default function AppearanceScreen() {
  const theme = useTheme();
  const appearance = useAppearance();
  return (
    <SubScreen title="Tampilan" intro="Terang, gelap, atau ikuti pengaturan HP.">
      <View style={styles.options}>
        {APPEARANCE_OPTIONS.map(({ value, label }) => {
          const selected = value === appearance;
          return (
            <Pressable
              key={value}
              onPress={() => setAppearance(value)}
              style={[styles.option, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
