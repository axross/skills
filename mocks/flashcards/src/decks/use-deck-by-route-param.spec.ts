import { renderHook, waitFor } from "@testing-library/react-native";

import type { Deck } from "./deck";
import { useDeckByRouteParam } from "./use-deck-by-route-param";

const mockGetDeck = jest.fn();

jest.mock("./deck-repository", () => ({
  getDeck: (...args: unknown[]) => mockGetDeck(...args),
}));

const DECK: Deck = { id: "world-capitals", name: "World Capitals", cards: [] };

beforeEach(() => {
  mockGetDeck.mockReset();
});

describe("useDeckByRouteParam", () => {
  it("is not-found for a null deckId without calling the repository", async () => {
    const { result } = await renderHook(() => useDeckByRouteParam(null));

    expect(result.current).toEqual({ deck: undefined, status: "not-found" });
    expect(mockGetDeck).not.toHaveBeenCalled();
  });

  it("is loading, then ready, once the repository resolves a match", async () => {
    let resolveGetDeck: (deck: Deck) => void = () => {};
    mockGetDeck.mockReturnValueOnce(
      new Promise<Deck>((resolve) => {
        resolveGetDeck = resolve;
      }),
    );

    const { result } = await renderHook(() =>
      useDeckByRouteParam("world-capitals"),
    );

    expect(result.current.status).toBe("loading");

    resolveGetDeck(DECK);

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.deck).toEqual(DECK);
    expect(mockGetDeck).toHaveBeenCalledWith("world-capitals");
  });

  it("is not-found once the repository resolves with no match", async () => {
    mockGetDeck.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      useDeckByRouteParam("does-not-exist"),
    );

    await waitFor(() => expect(result.current.status).toBe("not-found"));
    expect(result.current.deck).toBeUndefined();
  });
});
