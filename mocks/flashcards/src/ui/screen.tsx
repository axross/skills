import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 */
export function Screen({ children, scrollable = false }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(2),
    gap: theme.spacing(2),
  },
}));
