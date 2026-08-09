import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { trackScreenView } from "@/analytics/analytics";
import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";

import { dueCount, type Deck } from "./deck";
import { normalizeDeckId } from "./deck-id";
import { DeckNotFound } from "./deck-not-found";
import { getDeck } from "./deck-repository";

export function DeckDetailScreen() {
  const params = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const deckId = normalizeDeckId(params.deckId);

  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [now, setNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (deckId === null) {
      return;
    }

    let cancelled = false;
    getDeck(deckId).then((found) => {
      if (cancelled) return;
      setDeck(found ?? null);
      setNow(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useEffect(() => {
    trackScreenView("Deck Detail");
  }, []);

  if (deckId === null) {
    return <DeckNotFound />;
  }

  if (deck === undefined || now === undefined) {
    return <LoadingScreen />;
  }

  if (deck === null) {
    return <DeckNotFound />;
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
