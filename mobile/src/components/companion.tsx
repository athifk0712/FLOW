import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 60;
// How long the speech bubble stays before it tucks itself away.
const BUBBLE_MS = 6000;

type Props = {
  /** What Flowku says in its bubble; a new line pops the bubble up again. No bubble without one. */
  line?: string;
  onPress?: () => void;
  style?: object;
};

// Flowku's companion: a small round teal friend that floats, breathes, blinks, and can say one short line.
// It heads the Flowku tab. Built from plain Views and the core Animated API, so it runs in Expo Go and on web.
export function Companion({ line, onPress, style }: Props) {
  const theme = useTheme();
  const [float] = useState(() => new Animated.Value(0));
  const [blink] = useState(() => new Animated.Value(1));
  const [pop] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(1));
  // The line whose bubble has timed out; a different line shows the bubble again.
  const [hiddenLine, setHiddenLine] = useState<string | null>(null);
  const showBubble = !!line && hiddenLine !== line;

  // Gentle up-and-down float, forever.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // A blink every few seconds, sometimes a double one.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const once = Animated.sequence([
      Animated.timing(blink, { toValue: 0.1, duration: 80, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]);
    const schedule = () => {
      timer = setTimeout(
        () => {
          const twice = Math.random() < 0.25;
          (twice ? Animated.sequence([once, Animated.delay(90), once]) : once).start(schedule);
        },
        2500 + Math.random() * 3000,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [blink]);

  // The bubble pops in whenever the line changes, then hides after a while.
  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(pop, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setHiddenLine(line ?? null));
    }, BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [line, pop]);

  const squish = (to: number) =>
    Animated.spring(press, { toValue: to, friction: 4, tension: 160, useNativeDriver: true }).start();

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const shadowScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      {showBubble && (
        <Animated.View
          style={[
            styles.bubble,
            { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
          ]}>
          <Pressable onPress={onPress}>
            <ThemedText type="small">{line}</ThemedText>
          </Pressable>
          <View style={[styles.tail, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} />
        </Animated.View>
      )}

      <Pressable
        onPress={onPress}
        onPressIn={() => squish(0.9)}
        onPressOut={() => squish(1)}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'image'}
        accessibilityLabel="Flowku">
        <Animated.View style={{ transform: [{ translateY }, { scale: press }] }}>
          {/* Honey sun peeking over the head, from the Flowku mark. */}
          <View style={[styles.sun, { backgroundColor: theme.accent }]} />
          <View style={[styles.body, { backgroundColor: theme.primary }]}>
            <View style={styles.eyes}>
              {[0, 1].map((i) => (
                <Animated.View
                  key={i}
                  style={[styles.eye, { backgroundColor: theme.onPrimary, transform: [{ scaleY: blink }] }]}
                />
              ))}
            </View>
            <View style={styles.cheeks}>
              <View style={[styles.cheek, { backgroundColor: theme.accent }]} />
              <View style={[styles.mouth, { borderColor: theme.onPrimary }]} />
              <View style={[styles.cheek, { backgroundColor: theme.accent }]} />
            </View>
          </View>
        </Animated.View>
        <Animated.View style={[styles.shadow, { transform: [{ scaleX: shadowScale }] }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: 220,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginRight: Spacing.one,
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
  },
  tail: {
    position: 'absolute',
    bottom: -6,
    right: 22,
    width: 12,
    height: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  sun: {
    position: 'absolute',
    top: -6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  body: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 4,
    boxShadow: '0 6px 16px rgba(15,92,85,0.35)',
  },
  eyes: {
    flexDirection: 'row',
    gap: 12,
  },
  eye: {
    width: 7,
    height: 11,
    borderRadius: 4,
  },
  cheeks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cheek: {
    width: 7,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
  mouth: {
    width: 12,
    height: 6,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderTopWidth: 0,
  },
  shadow: {
    alignSelf: 'center',
    marginTop: 4,
    width: 34,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
