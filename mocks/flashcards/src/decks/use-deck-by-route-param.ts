import { useEffect, useState } from "react";

import type { Deck } from "./deck";
import { getDeck } from "./deck-repository";

export type DeckLoadStatus = "loading" | "not-found" | "ready";

export type UseDeckByRouteParamResult = {
  /** Defined only once `status` is `"ready"`. */
  deck: Deck | undefined;
  status: DeckLoadStatus;
};

/**
 * Loads the deck a route's `deckId` parameter names, already normalized by
 * `normalizeDeckId` at the call site. Every screen under `/decks/[deckId]`
 * needs the same lookup around it — a cancelled-fetch guard so a slow
 * response cannot land after the screen has moved on, and a `"not-found"`
 * status for both a malformed id and one that matches nothing in the store —
 * so this is where that lookup lives instead of being copied at each call
 * site.
 */
export function useDeckByRouteParam(
  deckId: string | null,
): UseDeckByRouteParamResult {
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);

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

  if (deckId === null || deck === null) {
    return { deck: undefined, status: "not-found" };
  }
  if (deck === undefined) {
    return { deck: undefined, status: "loading" };
  }
  return { deck, status: "ready" };
}
