import AsyncStorage from "@react-native-async-storage/async-storage";

import { schedule } from "@/scheduler/scheduler";

import { addCard, getDeck, getDecks, gradeCard } from "./deck-repository";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("getDecks", () => {
  it("seeds three decks on first read and persists them", async () => {
    const decks = await getDecks();

    expect(decks).toHaveLength(3);

    const stored = await AsyncStorage.getItem("recall.decks.v1");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual(decks);
  });

  it("returns the same decks on a second read rather than reseeding", async () => {
    const first = await getDecks();
    const second = await getDecks();

    expect(second).toEqual(first);
  });
});

describe("getDeck", () => {
  it("finds a seeded deck by id", async () => {
    const deck = await getDeck("world-capitals");

    expect(deck?.name).toBe("World Capitals");
  });

  it("returns undefined for an unknown deck id", async () => {
    const deck = await getDeck("does-not-exist");

    expect(deck).toBeUndefined();
  });
});

describe("addCard", () => {
  it("persists a new card to the deck", async () => {
    const card = await addCard("world-capitals", {
      front: "Peru",
      back: "Lima",
    });

    const deck = await getDeck("world-capitals");
    expect(deck?.cards).toContainEqual(card);
    expect(card.front).toBe("Peru");
    expect(card.back).toBe("Lima");
    expect(card.scheduling.dueAt).toBeLessThanOrEqual(Date.now());
  });

  it("survives a fresh read after the write", async () => {
    await addCard("world-capitals", { front: "Peru", back: "Lima" });

    const reread = await getDeck("world-capitals");
    expect(reread?.cards.some((card) => card.front === "Peru")).toBe(true);
  });

  it("rejects an unknown deck id", async () => {
    await expect(
      addCard("does-not-exist", { front: "A", back: "B" }),
    ).rejects.toThrow(/No deck with id/);
  });
});

describe("gradeCard", () => {
  it("advances and persists a card's scheduling state", async () => {
    const deck = await getDeck("world-capitals");
    const card = deck!.cards[0];
    const now = Date.UTC(2026, 0, 1);

    const expected = schedule(card.scheduling, "recalled", now);
    const graded = await gradeCard("world-capitals", card.id, "recalled", now);

    expect(graded.scheduling).toEqual(expected);

    const reread = await getDeck("world-capitals");
    expect(
      reread?.cards.find((candidate) => candidate.id === card.id)?.scheduling,
    ).toEqual(expected);
  });

  it("rejects an unknown card id", async () => {
    await expect(
      gradeCard("world-capitals", "does-not-exist", "recalled", Date.now()),
    ).rejects.toThrow(/No card with id/);
  });
});
