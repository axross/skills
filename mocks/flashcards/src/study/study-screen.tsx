import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { trackCardGraded, trackScreenView } from "@/analytics/analytics";
import { dueCards } from "@/decks/deck";
import { normalizeDeckId } from "@/decks/deck-id";
import { DeckNotFound } from "@/decks/deck-not-found";
import { gradeCard } from "@/decks/deck-repository";
import { useDeckByRouteParam } from "@/decks/use-deck-by-route-param";
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

  const { deck, status } = useDeckByRouteParam(deckId);
  // Captured once at mount, same as the queue it seeds below, rather than
  // re-read every render.
  const [now] = useState(() => Date.now());
  // Which due cards this session has already graded. The queue is filtered
  // by this rather than held as its own separately-updated array, so it
  // stays a value derived from `deck` during render instead of a second
  // piece of state a render could see out of sync with the first.
  const [gradedCardIds, setGradedCardIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    trackScreenView("Study");
  }, []);

  if (deckId === null || status === "not-found") {
    return <DeckNotFound />;
  }

  if (!deck) {
    return <LoadingScreen />;
  }

  const currentDeckId = deckId;
  const queue = dueCards(deck, now).filter(
    (card) => !gradedCardIds.has(card.id),
  );

  async function handleGrade(grade: Grade) {
    const current = queue[0];
    if (!current) return;

    await gradeCard(currentDeckId, current.id, grade, Date.now());
    trackCardGraded({ deckId: currentDeckId, grade });
    setGradedCardIds((prev) => new Set(prev).add(current.id));
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
