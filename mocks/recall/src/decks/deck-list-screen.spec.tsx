import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { Deck } from "./deck";
import { DeckListScreen } from "./deck-list-screen";

const mockGetDecks = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./deck-repository", () => ({
  getDecks: (...args: unknown[]) => mockGetDecks(...args),
}));

jest.mock("@/analytics/analytics", () => ({
  trackScreenView: jest.fn(),
}));

const DECKS: Deck[] = [
  { id: "world-capitals", name: "World Capitals", cards: [] },
];

beforeEach(() => {
  mockGetDecks.mockReset().mockResolvedValue(DECKS);
  mockPush.mockReset();
});

describe("DeckListScreen", () => {
  it("lists the decks once loaded", async () => {
    await render(<DeckListScreen />);

    await waitFor(() =>
      expect(screen.getByText("World Capitals")).toBeOnTheScreen(),
    );
  });

  it("shows a retry action if loading the decks fails, and recovers on retry", async () => {
    mockGetDecks.mockRejectedValueOnce(new Error("boom"));
    await render(<DeckListScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("deck-list-retry")).toBeOnTheScreen(),
    );
    expect(screen.queryByText("World Capitals")).toBeNull();

    await fireEvent.press(screen.getByTestId("deck-list-retry"));

    await waitFor(() =>
      expect(screen.getByText("World Capitals")).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId("deck-list-retry")).toBeNull();
  });
});
