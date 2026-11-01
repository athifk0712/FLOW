import { forwardRef, type ReactNode, type RefObject } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const SHARE_BASE_WIDTH = 320;

/** The picture's width in layout units: exactly 1080 pixels on any screen, however small the preview is. */
export const SHARE_CAPTURE_WIDTH = 1080 / PixelRatio.get();

const MAX_PREVIEW_WIDTH = 300;
// Below this the preview can't be read; a small phone scrolls to the controls instead.
const MIN_PREVIEW_WIDTH = 220;

/** A preview that leaves room for `controlsHeight` when it can, and stays readable when it can't. */
export function sharePreviewWidth(screen: { width: number; height: number }, controlsHeight: number) {
  const toFitHeight = ((screen.height - controlsHeight) * 9) / 16;
  return Math.min(MAX_PREVIEW_WIDTH, screen.width - Spacing.five * 2, Math.max(MIN_PREVIEW_WIDTH, toFitHeight));
}

// A picture has fixed geometry, so its text ignores the phone's text size setting.
export function ShareText(props: ThemedTextProps) {
  return <ThemedText allowFontScaling={false} {...props} />;
}

type PreviewProps = {
  /** Width on screen. */
  width: number;
  /** Where the card to capture ends up. */
  cardRef: RefObject<View | null>;
  /** Draws the card at SHARE_CAPTURE_WIDTH with the given ref. */
  renderCard: (ref: RefObject<View | null> | undefined) => ReactNode;
};

// Shows a card drawn at full picture size shrunk to fit the screen. The scale sits on a wrapper, so capturing the card
// inside still gets its full size. A browser's capture garbles anything under a scale, so there it takes an unscaled
// copy kept off screen.
export function SharePreview({ width, cardRef, renderCard }: PreviewProps) {
  const scale = width / SHARE_CAPTURE_WIDTH;
  const isWeb = Platform.OS === 'web';
  return (
    <View style={[styles.preview, { width, height: (width * 16) / 9, borderRadius: Spacing.three }]}>
      <View style={[styles.scaled, { width: SHARE_CAPTURE_WIDTH, height: (SHARE_CAPTURE_WIDTH * 16) / 9, transform: [{ scale }] }]}>
        {renderCard(isWeb ? undefined : cardRef)}
      </View>
      {isWeb && (
        <View style={styles.offScreen} aria-hidden pointerEvents="none">
          {renderCard(cardRef)}
        </View>
      )}
    </View>
  );
}

type Props = {
  /** Width the card is drawn at; the height follows the 9:16 of a status. */
  width: number;
  footer: string;
  children: ReactNode;
};

// The look every status picture shares: the 9:16 teal card, the Flowku name on top and a line at the bottom.
export const ShareFrame = forwardRef<View, Props>(function ShareFrame({ width, footer, children }, ref) {
  const theme = useTheme();
  const s = width / SHARE_BASE_WIDTH;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height: (width * 16) / 9, padding: 20 * s, gap: 14 * s, backgroundColor: theme.primary }]}>
      <View style={[styles.bubble, { width: 220 * s, height: 220 * s, top: -70 * s, right: -60 * s, backgroundColor: theme.accent }]} />
      <View style={[styles.bubble, { width: 150 * s, height: 150 * s, top: 90 * s, left: -70 * s, backgroundColor: theme.onPrimary }]} />

      <View style={[styles.brand, { gap: 8 * s }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 32 * s, height: 32 * s, borderRadius: 9 * s }}
          accessibilityIgnoresInvertColors
        />
        <ShareText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 * s, lineHeight: 22 * s }}>
          Flowku
        </ShareText>
      </View>

      {children}

      <ShareText type="small" style={[styles.footer, { color: theme.onPrimary, fontSize: 12 * s, lineHeight: 16 * s }]}>
        {footer}
      </ShareText>
    </View>
  );
});

const styles = StyleSheet.create({
  preview: {
    overflow: 'hidden',
  },
  scaled: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  },
  offScreen: {
    position: 'absolute',
    top: 0,
    left: -100000,
  },
  card: {
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    opacity: 0.85,
  },
});
