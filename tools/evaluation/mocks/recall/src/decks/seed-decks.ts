import { UNSTUDIED_STATE } from "@/scheduler/scheduler";

import type { Card, Deck } from "./deck";

function seededCard(id: string, front: string, back: string): Card {
  return { id, front, back, scheduling: { ...UNSTUDIED_STATE } };
}

/**
 * The decks a fresh install starts from. Every card's scheduling state is
 * `UNSTUDIED_STATE`, whose `dueAt` of `0` puts it due immediately — a new
 * learner always has something to study.
 */
export function createSeedDecks(): Deck[] {
  return [
    {
      id: "chemical-elements",
      name: "Chemical Elements",
      cards: [
        seededCard("chemical-elements-1", "H", "Hydrogen"),
        seededCard("chemical-elements-2", "O", "Oxygen"),
        seededCard("chemical-elements-3", "Fe", "Iron"),
        seededCard("chemical-elements-4", "Au", "Gold"),
        seededCard("chemical-elements-5", "Na", "Sodium"),
        seededCard("chemical-elements-6", "C", "Carbon"),
      ],
    },
    {
      id: "world-capitals",
      name: "World Capitals",
      cards: [
        seededCard("world-capitals-1", "France", "Paris"),
        seededCard("world-capitals-2", "Japan", "Tokyo"),
        seededCard("world-capitals-3", "Australia", "Canberra"),
        seededCard("world-capitals-4", "Egypt", "Cairo"),
        seededCard("world-capitals-5", "Canada", "Ottawa"),
        seededCard("world-capitals-6", "Brazil", "Brasília"),
      ],
    },
    {
      id: "famous-landmarks",
      name: "Famous Landmarks",
      cards: [
        seededCard("famous-landmarks-1", "Eiffel Tower", "Paris, France"),
        seededCard("famous-landmarks-2", "Great Wall", "China"),
        seededCard("famous-landmarks-3", "Statue of Liberty", "New York, USA"),
        seededCard("famous-landmarks-4", "Colosseum", "Rome, Italy"),
        seededCard("famous-landmarks-5", "Taj Mahal", "Agra, India"),
        seededCard(
          "famous-landmarks-6",
          "Sydney Opera House",
          "Sydney, Australia",
        ),
      ],
    },
  ];
}
