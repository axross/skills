import { createSeedDecks } from "./seed-decks";

describe("createSeedDecks", () => {
  it("creates three decks, each with a unique id and a handful of cards", () => {
    const decks = createSeedDecks();

    expect(decks).toHaveLength(3);

    const deckIds = decks.map((deck) => deck.id);
    expect(new Set(deckIds).size).toBe(deckIds.length);

    for (const deck of decks) {
      expect(deck.cards.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("gives every card a unique id, non-empty content, and an immediately-due state", () => {
    const decks = createSeedDecks();
    const now = Date.now();

    for (const deck of decks) {
      const cardIds = deck.cards.map((card) => card.id);
      expect(new Set(cardIds).size).toBe(cardIds.length);

      for (const card of deck.cards) {
        expect(card.front.length).toBeGreaterThan(0);
        expect(card.back.length).toBeGreaterThan(0);
        expect(card.scheduling.dueAt).toBeLessThanOrEqual(now);
      }
    }
  });
});
