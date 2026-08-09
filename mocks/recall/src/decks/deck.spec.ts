import { UNSTUDIED_STATE } from "@/scheduler/scheduler";

import { dueCards, dueCount, type Deck } from "./deck";

const NOW = Date.UTC(2026, 0, 1);

function cardDueAt(id: string, dueAt: number) {
  return { id, front: id, back: id, scheduling: { ...UNSTUDIED_STATE, dueAt } };
}

describe("dueCards", () => {
  it("returns only cards due at or before now", () => {
    const deck: Deck = {
      id: "deck-1",
      name: "Deck",
      cards: [
        cardDueAt("past", NOW - 1000),
        cardDueAt("now", NOW),
        cardDueAt("future", NOW + 1000),
      ],
    };

    const due = dueCards(deck, NOW);

    expect(due.map((card) => card.id)).toEqual(["past", "now"]);
  });

  it("sorts due cards soonest-due first", () => {
    const deck: Deck = {
      id: "deck-1",
      name: "Deck",
      cards: [cardDueAt("later", NOW - 1000), cardDueAt("sooner", NOW - 5000)],
    };

    const due = dueCards(deck, NOW);

    expect(due.map((card) => card.id)).toEqual(["sooner", "later"]);
  });

  it("returns an empty array when a deck has no cards", () => {
    const deck: Deck = { id: "deck-1", name: "Deck", cards: [] };

    expect(dueCards(deck, NOW)).toEqual([]);
  });
});

describe("dueCount", () => {
  it("counts the cards due at or before now", () => {
    const deck: Deck = {
      id: "deck-1",
      name: "Deck",
      cards: [
        cardDueAt("a", NOW - 1000),
        cardDueAt("b", NOW),
        cardDueAt("c", NOW + 1000),
      ],
    };

    expect(dueCount(deck, NOW)).toBe(2);
  });
});
