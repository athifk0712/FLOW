import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const SIZE = 60;
// The hen's own colours (from the celengan ayam mark), the same in light and dark themes.
const HEN = {
  body: "#F6F1E7",
  line: "#E6DAC4",
  coral: "#E0604A",
  ink: "#1C2B2A",
};
// How long the speech bubble stays before it tucks itself away.
const BUBBLE_MS = 6000;

type Props = {
  /** What Flowku says in its bubble; a new line pops the bubble up again. No bubble without one. */
  line?: string;
  onPress?: () => void;
  style?: object;
};

// Flowku's companion: the head of the celengan ayam from the Flowku mark. It floats, blinks, and can say one short line.
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
        Animated.timing(float, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // A blink every few seconds, sometimes a double one.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const once = Animated.sequence([
      Animated.timing(blink, {
        toValue: 0.1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(blink, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]);
    const schedule = () => {
      timer = setTimeout(
        () => {
          const twice = Math.random() < 0.25;
          (twice
            ? Animated.sequence([once, Animated.delay(90), once])
            : once
          ).start(schedule);
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
    Animated.spring(pop, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(pop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setHiddenLine(line ?? null));
    }, BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [line, pop]);

  const squish = (to: number) =>
    Animated.spring(press, {
      toValue: to,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const shadowScale = float.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.8],
  });

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      {showBubble && (
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
            },
            {
              opacity: pop,
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable onPress={onPress}>
            <ThemedText type="small">{line}</ThemedText>
          </Pressable>
          <View
            style={[
              styles.tail,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              },
            ]}
          />
        </Animated.View>
      )}

      <Pressable
        onPress={onPress}
        onPressIn={() => squish(0.9)}
        onPressOut={() => squish(1)}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : "image"}
        accessibilityLabel="Flowku"
      >
        <Animated.View
          style={{ transform: [{ translateY }, { scale: press }] }}
        >
          <View style={styles.head}>
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              {/* teal badge, like the app icon, so the sand-coloured head stands out on a sand page */}
              <Circle cx={50} cy={50} r={50} fill={theme.primary} />
              <G transform="translate(4 4) scale(0.92)">
                {/* comb */}
                <Path
                  d="M44 22 C42 12 50 8 55 13 C57 5 67 5 68 13 C73 8 81 12 77 21 C68 25 52 26 44 22 Z"
                  fill={HEN.coral}
                />
                <Circle
                  cx={54}
                  cy={56}
                  r={32}
                  fill={HEN.body}
                  stroke={HEN.line}
                  strokeWidth={3}
                />
                {/* beak and wattle, facing left like the mark */}
                <Path
                  d="M25 49 L8 56 L25 63 C28 59 28 53 25 49 Z"
                  fill={theme.accent}
                />
                <Path
                  d="M24 64 C18 68 19 78 25 80 C30 77 30 68 24 64 Z"
                  fill={HEN.coral}
                />
                <Circle cx={47} cy={64} r={6} fill={HEN.coral} opacity={0.3} />
                {/* painted collar */}
                {[40, 48, 56, 64, 72].map((x, i) => (
                  <Circle
                    key={x}
                    cx={x}
                    cy={[79, 82, 83, 82, 79][i]}
                    r={3.2}
                    fill={theme.primary}
                  />
                ))}
              </G>
            </Svg>
            <Animated.View
              style={[
                styles.eye,
                { backgroundColor: HEN.ink, transform: [{ scaleY: blink }] },
              ]}
            />
          </View>
        </Animated.View>
        <Animated.View
          style={[styles.shadow, { transform: [{ scaleX: shadowScale }] }]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: 220,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginRight: Spacing.one,
    boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
  },
  tail: {
    position: "absolute",
    bottom: -6,
    right: 22,
    width: 12,
    height: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
  head: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    boxShadow: "0 6px 16px rgba(15,92,85,0.35)",
  },
  // Over the drawn head, so it can blink. Centre at (38, 49) of the head, i.e. (39, 49.1) after the badge transform.
  eye: {
    position: "absolute",
    left: SIZE * 0.39 - 3.5,
    top: SIZE * 0.491 - 4.5,
    width: 7,
    height: 9,
    borderRadius: 4,
  },
  shadow: {
    alignSelf: "center",
    marginTop: 4,
    width: 34,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});
