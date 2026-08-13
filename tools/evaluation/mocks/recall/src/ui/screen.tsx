import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type ScreenProps = PropsWithChildren<{
  /** Wraps the content in a ScrollView, for forms that can outgrow the viewport. */
  scrollable?: boolean;
}>;

/**
 * Wraps a route's content in the device safe area, paints the theme's
 * background colour behind it, and applies the app's standard content
 * padding. Every screen the router renders uses this rather than laying out
 * against the raw window.
 *
 * The safe area comes from Unistyles' own mini runtime rather than a
 * separate safe-area context hook, so it recomputes on the same path as the
 * rest of the stylesheet. Only the horizontal insets are combined with this
 * screen's own gutter (`Math.max`, so a device with no notch still gets the
 * design's spacing) — the vertical insets are applied as-is, because
 * `content` below layers its own vertical breathing room on top of them
 * rather than folding it into the same value.
 */
export function Screen({ children, scrollable = false }: ScreenProps) {
  return (
    <View style={styles.screen}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
    paddingStart: Math.max(rt.insets.left, theme.spacing(2)),
    paddingEnd: Math.max(rt.insets.right, theme.spacing(2)),
  },
  content: {
    flexGrow: 1,
    paddingVertical: theme.spacing(2),
    gap: theme.spacing(2),
  },
}));
