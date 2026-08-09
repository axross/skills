import { useRouter } from "expo-router";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ActionButton } from "@/ui/action-button";
import { Screen } from "@/ui/screen";

/** Rendered for a `deckId` route parameter that matches no stored deck. */
export function DeckNotFound() {
  const router = useRouter();

  return (
    <Screen>
      <Text style={styles.title}>Deck not found</Text>
      <Text style={styles.body}>
        This deck doesn&apos;t exist or was removed.
      </Text>
      <ActionButton
        label="Back to decks"
        onPress={() => router.replace("/")}
        testID="deck-not-found-home"
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
