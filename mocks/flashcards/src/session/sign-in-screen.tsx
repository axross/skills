import { useState } from "react";
import { Redirect } from "expo-router";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { TextField } from "@/ui/text-field";

import { InvalidEmailError } from "./session";
import { useSession } from "./session-context";

export function SignInScreen() {
  const { session, status, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setError(null);
    setPending(true);
    try {
      await signIn(email);
    } catch (cause) {
      setError(
        cause instanceof InvalidEmailError
          ? cause.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  // Already signed in (e.g. reached this route directly) — bounce to the
  // deck list rather than showing the form again.
  if (session !== null) {
    return <Redirect href="/" />;
  }

  return (
    <Screen scrollable>
      <Text style={styles.title}>Recall</Text>
      <Text style={styles.subtitle}>Sign in to study your decks.</Text>
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        errorMessage={error ?? undefined}
        testID="sign-in-email"
      />
      <ActionButton
        label={pending ? "Signing in…" : "Sign in"}
        onPress={handleSubmit}
        testID="sign-in-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
