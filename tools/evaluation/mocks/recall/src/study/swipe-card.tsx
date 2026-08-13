import { useCallback } from "react";
import { Pressable, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import type { Grade } from "@/scheduler/scheduler";

const SWIPE_THRESHOLD = 120;

type SwipeCardProps = {
  front: string;
  back: string;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
};

/**
 * The study session's card: tap to reveal the back, then drag right to
 * grade it recalled or left to grade it forgotten. Swiping is disabled
 * until the card is revealed, so a learner always sees the answer before
 * grading — the grading buttons beside it are the equivalent path for
 * anyone who does not want to swipe.
 */
export function SwipeCard({
  front,
  back,
  revealed,
  onReveal,
  onGrade,
}: SwipeCardProps) {
  const offsetX = useSharedValue(0);

  const grade = useCallback(
    (value: number) => {
      onGrade(value > 0 ? "recalled" : "forgotten");
    },
    [onGrade],
  );

  const pan = Gesture.Pan()
    .enabled(revealed)
    .onChange((event) => {
      offsetX.value += event.changeX;
    })
    .onEnd(() => {
      if (Math.abs(offsetX.value) > SWIPE_THRESHOLD) {
        runOnJS(grade)(offsetX.value);
      }
      offsetX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { rotate: `${offsetX.value / 20}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID="study-card" style={[styles.card, animatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? back : "Reveal the answer"}
          onPress={onReveal}
          disabled={revealed}
          style={styles.face}
        >
          <Text style={styles.text}>{revealed ? back : front}</Text>
          {!revealed ? <Text style={styles.hint}>Tap to reveal</Text> : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(4),
    minHeight: theme.sizing.mediaHeight,
  },
  face: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
  },
  text: {
    ...theme.typography.display,
    color: theme.colors.text,
    textAlign: "center",
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
