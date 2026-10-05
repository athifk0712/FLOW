import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { catalogEntry, initials } from '@/lib/account-catalog';

const TYPE_COLOR = { BANK: '#0F5C55', EWALLET: '#3A82E0', CASH: '#2F9E68' } as const;

type Props = {
  name: string;
  type?: keyof typeof TYPE_COLOR;
  color?: string;
  size?: number;
};

// Initials on a brand-tinted circle; we don't ship bank logos.
export function AccountBadge({ name, type = 'BANK', color, size = 36 }: Props) {
  const bg = color ?? catalogEntry(name)?.color ?? TYPE_COLOR[type];
  const text = initials(name);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <ThemedText
        style={[styles.text, { fontSize: text.length > 2 ? size * 0.3 : size * 0.38, color: readableOn(bg) }]}
        numberOfLines={1}>
        {text}
      </ThemedText>
    </View>
  );
}

/** Black or white, whichever reads better on the badge color (WCAG relative luminance). */
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return l > 0.4 ? '#1C2B2A' : '#FFFFFF';
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 800,
  },
});
