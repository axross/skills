import { ActivityIndicator, Text } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "./screen";

type LoadingScreenProps = {
  label?: string;
};

/** A minimal in-progress state, shared by every screen while it reads its data. */
export function LoadingScreen({ label = "Loading…" }: LoadingScreenProps) {
  const { theme } = useUnistyles();

  return (
    <Screen>
      <ActivityIndicator
        color={theme.colors.accent}
        testID="loading-indicator"
      />
      <Text style={styles.label}>{label}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  label: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
}));
