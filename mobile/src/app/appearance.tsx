import { Pressable, StyleSheet, View } from 'react-native';

import { FeatureIconPreview } from '@/components/feature-icon';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APPEARANCE_OPTIONS, setAppearance, useAppearance } from '@/lib/appearance';
import { ICON_STYLE_OPTIONS, setIconStyle, useIconStyle } from '@/lib/icon-style';

const PREVIEW = ['wallet', 'budget', 'goal'] as const;

export default function AppearanceScreen() {
  const theme = useTheme();
  const appearance = useAppearance();
  const iconStyle = useIconStyle();
  return (
    <SubScreen title="Tampilan" intro="Terang, gelap, atau ikuti pengaturan HP, dan gaya ikon fitur.">
      <View style={styles.options}>
        {APPEARANCE_OPTIONS.map(({ value, label }) => {
          const selected = value === appearance;
          return (
            <Pressable
              key={value}
              onPress={() => setAppearance(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          GAYA IKON
        </ThemedText>
        <View style={styles.options}>
          {ICON_STYLE_OPTIONS.map(({ value, label }) => {
            const selected = value === iconStyle;
            return (
              <Pressable
                key={value}
                onPress={() => setIconStyle(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Gaya ikon ${label}`}
                style={[
                  styles.iconOption,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: selected ? theme.primary : 'transparent',
                  },
                ]}>
                <View style={styles.previewRow}>
                  {PREVIEW.map((name) => (
                    <FeatureIconPreview key={name} name={name} style={value} size={32} />
                  ))}
                </View>
                <ThemedText type="smallBold" numberOfLines={1} style={selected ? { color: theme.primary } : undefined}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
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
  section: {
    gap: Spacing.two,
  },
  iconOption: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
});
