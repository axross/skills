import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { trackScreenView } from "@/analytics/analytics";
import { useSession } from "@/session/session-context";
import { ActionButton } from "@/ui/action-button";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";

export function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { rt } = useUnistyles();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    trackScreenView("Settings");
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <View style={styles.section}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value} testID="settings-email">
          {session?.email ?? "—"}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Appearance</Text>
        <Text style={styles.value}>
          {`Recall follows your device's light/dark setting. You're currently using the ${
            rt.themeName ?? "light"
          } theme.`}
        </Text>
      </View>
      <ActionButton
        label={signingOut ? "Signing out…" : "Sign out"}
        kind="destructive"
        onPress={handleSignOut}
        testID="sign-out"
      />
      <Text
        style={styles.version}
      >{`Recall ${Constants.expoConfig?.version ?? "1.0.0"}`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing(0.5),
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  value: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
}));
