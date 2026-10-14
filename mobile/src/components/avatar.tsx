import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAvatar } from '@/lib/avatar';
import { initials } from '@/lib/display-name';

type Props = {
  name: string;
  size?: number;
  /** A local preview to show instead of the saved photo. */
  previewUri?: string | null;
  /** Draws a thin ring, for use on the teal band. */
  ringColor?: string;
};

// The user's photo, or their initials on a teal circle while there is none (or it can't be loaded).
export function Avatar({ name, size = 48, previewUri, ringColor }: Props) {
  const theme = useTheme();
  const { url } = useAvatar();
  const uri = previewUri ?? url;
  const shape = { width: size, height: size, borderRadius: size / 2 };
  const ring = ringColor ? { borderWidth: 2, borderColor: ringColor } : null;
  return (
    <View
      style={[styles.circle, shape, ring, { backgroundColor: theme.primary }]}
      accessibilityRole="image"
      accessibilityLabel={uri ? `Foto profil ${name}` : `Inisial ${name}`}>
      {uri ? (
        <Image source={{ uri }} style={shape} contentFit="cover" transition={150} />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: size * 0.34, lineHeight: size * 0.44 }}>
          {initials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
