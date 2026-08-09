import { useRouter } from "expo-router";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ActionButton } from "@/ui/action-button";
import { Screen } from "@/ui/screen";

/**
 * Rendered when `useDeckByRouteParam` could not read the deck at all — as
 * distinct from `DeckNotFound`, which is a `deckId` that resolved to no
 * match. Shared by every screen under `/decks/[deckId]` that hook backs, the
 * same way `DeckNotFound` already is.
 */
export function DeckLoadError() {
  const router = useRouter();

  return (
    <Screen>
      <Text style={styles.title}>Couldn&apos;t load this deck</Text>
      <Text style={styles.body}>
        Something went wrong reading your decks. Try again.
      </Text>
      <ActionButton
        label="Back to decks"
        onPress={() => router.replace("/")}
        testID="deck-load-error-home"
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
