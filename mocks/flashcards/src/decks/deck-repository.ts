import AsyncStorage from "@react-native-async-storage/async-storage";

import { UNSTUDIED_STATE, schedule, type Grade } from "@/scheduler/scheduler";

import type { Card, Deck } from "./deck";
import { createSeedDecks } from "./seed-decks";

const STORAGE_KEY = "recall.decks.v1";

function generateCardId(): string {
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readDecks(): Promise<Deck[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    const seeded = createSeedDecks();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  return JSON.parse(raw) as Deck[];
}

async function writeDecks(decks: Deck[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

/** All decks, seeding the store on first launch. */
export async function getDecks(): Promise<Deck[]> {
  return readDecks();
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  const decks = await readDecks();
  return decks.find((deck) => deck.id === deckId);
}

export async function addCard(
  deckId: string,
  input: { front: string; back: string; photoUri?: string },
): Promise<Card> {
  const decks = await readDecks();
  const deck = decks.find((candidate) => candidate.id === deckId);
  if (!deck) {
    throw new Error(`No deck with id "${deckId}".`);
  }

  const card: Card = {
    id: generateCardId(),
    front: input.front,
    back: input.back,
    photoUri: input.photoUri,
    scheduling: { ...UNSTUDIED_STATE },
  };

  deck.cards.push(card);
  await writeDecks(decks);
  return card;
}

/** Grades a card, advancing its scheduling state, and persists the result. */
export async function gradeCard(
  deckId: string,
  cardId: string,
  grade: Grade,
  now: number,
): Promise<Card> {
  const decks = await readDecks();
  const deck = decks.find((candidate) => candidate.id === deckId);
  if (!deck) {
    throw new Error(`No deck with id "${deckId}".`);
  }

  const card = deck.cards.find((candidate) => candidate.id === cardId);
  if (!card) {
    throw new Error(`No card with id "${cardId}" in deck "${deckId}".`);
  }

  card.scheduling = schedule(card.scheduling, grade, now);
  await writeDecks(decks);
  return card;
}
