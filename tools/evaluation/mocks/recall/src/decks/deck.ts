import type { SchedulingState } from "@/scheduler/scheduler";

export type Card = {
  id: string;
  front: string;
  back: string;
  photoUri?: string;
  scheduling: SchedulingState;
};

export type Deck = {
  id: string;
  name: string;
  cards: Card[];
};

/** The deck's cards that are due at or before `now`, soonest-due first. */
export function dueCards(deck: Deck, now: number): Card[] {
  return deck.cards
    .filter((card) => card.scheduling.dueAt <= now)
    .sort((a, b) => a.scheduling.dueAt - b.scheduling.dueAt);
}

export function dueCount(deck: Deck, now: number): number {
  return dueCards(deck, now).length;
}
