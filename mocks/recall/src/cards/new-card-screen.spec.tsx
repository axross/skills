import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { PermissionResponse } from "expo-camera";

import type { Deck } from "@/decks/deck";

import { NewCardScreen } from "./new-card-screen";

const mockGetDeck = jest.fn();
const mockAddCard = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ deckId: "world-capitals" }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

// The guidance is explicit: never render a real CameraView in a test.
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    {
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
    } as PermissionResponse,
    jest.fn(),
  ],
}));

jest.mock("expo-linking", () => ({
  openSettings: jest.fn(),
}));

jest.mock("@/decks/deck-repository", () => ({
  getDeck: (...args: unknown[]) => mockGetDeck(...args),
  addCard: (...args: unknown[]) => mockAddCard(...args),
}));

jest.mock("@/analytics/analytics", () => ({
  trackScreenView: jest.fn(),
}));

const DECK: Deck = { id: "world-capitals", name: "World Capitals", cards: [] };

beforeEach(() => {
  mockGetDeck.mockReset().mockResolvedValue(DECK);
  mockAddCard.mockReset().mockResolvedValue(undefined);
  mockBack.mockReset();
});

describe("NewCardScreen", () => {
  it("shows a visible error and does not navigate back when saving the card fails", async () => {
    mockAddCard.mockRejectedValueOnce(new Error("boom"));
    await render(<NewCardScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("new-card-front")).toBeOnTheScreen(),
    );
    await fireEvent.changeText(screen.getByTestId("new-card-front"), "Peru");
    await fireEvent.changeText(screen.getByTestId("new-card-back"), "Lima");
    await fireEvent.press(screen.getByTestId("submit-new-card"));

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't save this card. Try again."),
      ).toBeOnTheScreen(),
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("navigates back once the card saves", async () => {
    await render(<NewCardScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("new-card-front")).toBeOnTheScreen(),
    );
    await fireEvent.changeText(screen.getByTestId("new-card-front"), "Peru");
    await fireEvent.changeText(screen.getByTestId("new-card-back"), "Lima");
    await fireEvent.press(screen.getByTestId("submit-new-card"));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });
});
