import { useEffect, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import type { Deck } from "@/decks/deck";
import { normalizeDeckId } from "@/decks/deck-id";
import { DeckNotFound } from "@/decks/deck-not-found";
import { addCard, getDeck } from "@/decks/deck-repository";
import { trackScreenView } from "@/analytics/analytics";
import { ActionButton } from "@/ui/action-button";
import { LoadingScreen } from "@/ui/loading-screen";
import { Screen } from "@/ui/screen";
import { ScreenHeader } from "@/ui/screen-header";
import { TextField } from "@/ui/text-field";

import { PhotoCapture } from "./photo-capture";

export function NewCardScreen() {
  const params = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const deckId = normalizeDeckId(params.deckId);

  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (deckId === null) {
      return;
    }

    let cancelled = false;
    getDeck(deckId).then((found) => {
      if (!cancelled) setDeck(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useEffect(() => {
    trackScreenView("Add Card");
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

  async function handleSubmit() {
    if (!front.trim() || !back.trim()) {
      setError("Enter both the front and the back of the card.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await addCard(currentDeckId, {
        front: front.trim(),
        back: back.trim(),
        photoUri,
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scrollable>
      <ScreenHeader title="Add a card" onBack={() => router.back()} />
      <TextField
        label="Front"
        value={front}
        onChangeText={setFront}
        testID="new-card-front"
      />
      <TextField
        label="Back"
        value={back}
        onChangeText={setBack}
        testID="new-card-back"
      />
      <PhotoCapture
        permission={permission}
        photoUri={photoUri}
        onRequestPermission={() => void requestPermission()}
        onOpenSettings={() => void Linking.openSettings()}
        onCapture={setPhotoUri}
        onClear={() => setPhotoUri(undefined)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label={submitting ? "Adding…" : "Add card"}
        onPress={handleSubmit}
        testID="submit-new-card"
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  error: {
    ...theme.typography.caption,
    color: theme.colors.negative,
  },
}));
