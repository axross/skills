import { useState } from "react";
import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type ActionButtonKind = "primary" | "secondary" | "destructive";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  kind?: ActionButtonKind;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The app's one tappable control. Every button-shaped surface — grading a
 * card, confirming a form, a destructive action — renders this rather than
 * its own `Pressable`, so the minimum target size and the focus ring are
 * enforced in one place instead of re-implemented at each call site.
 */
export function ActionButton({
  label,
  onPress,
  kind = "primary",
  accessibilityLabel,
  testID,
}: ActionButtonProps) {
  const [isFocused, setIsFocused] = useState(false);

  styles.useVariants({ kind });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[styles.button, isFocused && styles.buttonFocused]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: theme.spacing(2),
    variants: {
      kind: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        destructive: { backgroundColor: theme.colors.negative },
      },
    },
  },
  buttonFocused: {
    borderColor: theme.colors.focusRing,
  },
  label: {
    ...theme.typography.label,
    variants: {
      kind: {
        primary: { color: theme.colors.onAccent },
        secondary: { color: theme.colors.text },
        destructive: { color: theme.colors.onAccent },
      },
    },
  },
}));
