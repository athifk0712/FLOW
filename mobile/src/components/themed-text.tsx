import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, TextScale, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  const flat = StyleSheet.flatten([
    { color: theme[themeColor ?? 'text'] },
    type === 'default' && styles.default,
    type === 'title' && styles.title,
    type === 'small' && styles.small,
    type === 'smallBold' && styles.smallBold,
    type === 'subtitle' && styles.subtitle,
    type === 'link' && styles.link,
    type === 'code' && styles.code,
    style,
  ]);

  return <Text style={scaled(flat)} {...rest} />;
}

// Every size in the app is written at full scale and shrunk here once, so the whole UI zooms out together
// (screen-specific sizes included) and one number in theme.ts sets how roomy it feels.
function scaled<T extends { fontSize?: number; lineHeight?: number }>(style: T): T {
  if (TextScale === 1) return style;
  return {
    ...style,
    ...(style.fontSize !== undefined && { fontSize: Math.round(style.fontSize * TextScale * 2) / 2 }),
    ...(style.lineHeight !== undefined && { lineHeight: Math.round(style.lineHeight * TextScale) }),
  };
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 40,
    fontWeight: 600,
    lineHeight: 46,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
