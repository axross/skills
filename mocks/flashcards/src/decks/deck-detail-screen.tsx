import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { trackScreenView } from "@/analytics/analytics";
import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";

import { dueCount } from "./deck";
import { normalizeDeckId } from "./deck-id";
import { DeckNotFound } from "./deck-not-found";
import { useDeckByRouteParam } from "./use-deck-by-route-param";

export function DeckDetailScreen() {
  const params = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const deckId = normalizeDeckId(params.deckId);

  const { deck, status } = useDeckByRouteParam(deckId);
  // Captured once at mount rather than re-read every render, so the due
  // count shown does not creep forward while this screen stays mounted.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    trackScreenView("Deck Detail");
  }, []);

  if (status === "not-found") {
    return <DeckNotFound />;
  }

  if (!deck) {
    return <LoadingScreen />;
  }

  const due = dueCount(deck, now);

  return (
    <Screen>
      <ScreenHeader title={deck.name} onBack={() => router.back()} />
      <Text style={styles.meta}>
        {`${deck.cards.length} card${deck.cards.length === 1 ? "" : "s"} · ${due} due now`}
      </Text>
      <View style={styles.actions}>
        <ActionButton
          label="Study"
          onPress={() => router.push(`/decks/${deck.id}/study`)}
          testID="study-deck"
        />
        <ActionButton
          label="Add a card"
          kind="secondary"
          onPress={() => router.push(`/decks/${deck.id}/new-card`)}
          testID="add-card"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  meta: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  actions: {
    gap: theme.spacing(1.5),
  },
}));
