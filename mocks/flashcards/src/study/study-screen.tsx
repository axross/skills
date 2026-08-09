import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { trackCardGraded, trackScreenView } from "@/analytics/analytics";
import type { Card, Deck } from "@/decks/deck";
import { dueCards } from "@/decks/deck";
import { normalizeDeckId } from "@/decks/deck-id";
import { DeckNotFound } from "@/decks/deck-not-found";
import { getDeck, gradeCard } from "@/decks/deck-repository";
import type { Grade } from "@/scheduler/scheduler";
import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";

import { SwipeCard } from "./swipe-card";

export function StudyScreen() {
  const params = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const deckId = normalizeDeckId(params.deckId);

  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [queue, setQueue] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (deckId === null) {
      return;
    }

    let cancelled = false;
    getDeck(deckId).then((found) => {
      if (cancelled) return;
      setDeck(found ?? null);
      if (found) {
        setQueue(dueCards(found, Date.now()));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useEffect(() => {
    trackScreenView("Study");
  }, []);

  if (deckId === null) {
    return <DeckNotFound />;
  }

  if (deck === undefined) {
    return <LoadingScreen />;
  }

  if (deck === null) {
    return <DeckNotFound />;
  }

  const currentDeckId = deckId;

  async function handleGrade(grade: Grade) {
    const current = queue[0];
    if (!current) return;

    await gradeCard(currentDeckId, current.id, grade, Date.now());
    trackCardGraded({ deckId: currentDeckId, grade });
    setQueue((prev) => prev.slice(1));
    setRevealed(false);
  }

  return (
    <Screen>
      <ScreenHeader title={deck.name} onBack={() => router.back()} />
      {queue.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing left to study</Text>
          <Text style={styles.emptyBody}>
            Come back later, or add another card now.
          </Text>
          <ActionButton
            label="Back to deck"
            kind="secondary"
            onPress={() => router.back()}
            testID="study-done"
          />
        </View>
      ) : (
        <View style={styles.session}>
          <Text style={styles.progress}>
            {`${queue.length} card${queue.length === 1 ? "" : "s"} left`}
          </Text>
          <SwipeCard
            front={queue[0].front}
            back={queue[0].back}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onGrade={handleGrade}
          />
          {revealed ? (
            <View style={styles.actions}>
              <ActionButton
                label="Forgotten"
                kind="destructive"
                onPress={() => handleGrade("forgotten")}
                testID="grade-forgotten"
                style={styles.gradeButton}
              />
              <ActionButton
                label="Recalled"
                kind="positive"
                onPress={() => handleGrade("recalled")}
                testID="grade-recalled"
                style={styles.gradeButton}
              />
            </View>
          ) : (
            <Text style={styles.hint}>Tap the card to reveal the answer.</Text>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  session: {
    flex: 1,
    gap: theme.spacing(2),
  },
  progress: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing(1.5),
  },
  gradeButton: {
    flex: 1,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
}));
