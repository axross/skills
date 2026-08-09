import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { trackScreenView } from "@/analytics/analytics";
import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";

import { dueCount, type Deck } from "./deck";
import { getDecks } from "./deck-repository";

export function DeckListScreen() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[] | undefined>(undefined);
  const [now, setNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDecks().then((found) => {
      if (cancelled) return;
      setDecks(found);
      setNow(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trackScreenView("Deck List");
  }, []);

  if (decks === undefined || now === undefined) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <ScreenHeader
        title="Recall"
        right={
          <ActionButton
            label="Settings"
            kind="secondary"
            onPress={() => router.push("/settings")}
            testID="open-settings"
          />
        }
      />
      {decks.length === 0 ? (
        <Text style={styles.empty}>
          You don&apos;t have any decks yet. Decks you add will show up here.
        </Text>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(deck) => deck.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const due = dueCount(item, now);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.cards.length} cards, ${due} due now`}
                onPress={() => router.push(`/decks/${item.id}`)}
                style={styles.row}
                testID={`deck-row-${item.id}`}
              >
                <Text style={styles.deckName}>{item.name}</Text>
                <Text style={styles.deckMeta}>
                  {`${item.cards.length} card${item.cards.length === 1 ? "" : "s"} · ${due} due now`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.spacing(1.5),
  },
  row: {
    minHeight: theme.sizing.minTouchTarget,
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    gap: theme.spacing(0.5),
  },
  deckName: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  deckMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  empty: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
