import "@/theme/theme";

import { useEffect } from "react";
import * as SystemUI from "expo-system-ui";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUnistyles } from "react-native-unistyles";

import { initAnalytics } from "@/analytics/analytics";
import { SessionProvider } from "@/session/session-context";

initAnalytics();

export default function RootLayout() {
  const { theme } = useUnistyles();

  // Keeps the native root view's background in sync with the active theme,
  // so there is no light/dark mismatch flash behind the status and
  // navigation bars on Android when the system theme changes.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
