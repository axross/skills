import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { Deck } from "@/decks/deck";
import { UNSTUDIED_STATE } from "@/scheduler/scheduler";

import { StudyScreen } from "./study-screen";

const mockGetDeck = jest.fn();
const mockGradeCard = jest.fn();
const mockTrackCardGraded = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ deckId: "world-capitals" }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/decks/deck-repository", () => ({
  getDeck: (...args: unknown[]) => mockGetDeck(...args),
  gradeCard: (...args: unknown[]) => mockGradeCard(...args),
}));

jest.mock("@/analytics/analytics", () => ({
  trackScreenView: jest.fn(),
  trackCardGraded: (...args: unknown[]) => mockTrackCardGraded(...args),
}));

const NOW = Date.UTC(2026, 0, 1);

function deckFixture(): Deck {
  return {
    id: "world-capitals",
    name: "World Capitals",
    cards: [
      {
        id: "card-france",
        front: "France",
        back: "Paris",
        scheduling: { ...UNSTUDIED_STATE, dueAt: NOW - 2000 },
      },
      {
        id: "card-japan",
        front: "Japan",
        back: "Tokyo",
        scheduling: { ...UNSTUDIED_STATE, dueAt: NOW - 1000 },
      },
    ],
  };
}

beforeEach(() => {
  mockGetDeck.mockReset().mockResolvedValue(deckFixture());
  mockGradeCard.mockReset().mockResolvedValue(undefined);
  mockTrackCardGraded.mockReset();
  mockBack.mockReset();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("StudyScreen", () => {
  it("grades the front card, persists it once, and pops it from the queue", async () => {
    await render(<StudyScreen />);

    await waitFor(() => expect(screen.getByText("France")).toBeOnTheScreen());

    await fireEvent.press(screen.getByText("France"));
    await fireEvent.press(await screen.findByTestId("grade-recalled"));

    await waitFor(() =>
      expect(mockGradeCard).toHaveBeenCalledWith(
        "world-capitals",
        "card-france",
        "recalled",
        NOW,
      ),
    );
    expect(mockGradeCard).toHaveBeenCalledTimes(1);
    expect(mockTrackCardGraded).toHaveBeenCalledTimes(1);
    expect(mockTrackCardGraded).toHaveBeenCalledWith({
      deckId: "world-capitals",
      grade: "recalled",
    });

    // The front card is gone, and the next due card takes its place —
    // revealed again resets to false, so its front (not back) is what shows.
    await waitFor(() => expect(screen.getByText("Japan")).toBeOnTheScreen());
    expect(screen.queryByText("France")).toBeNull();
    expect(screen.queryByText("Paris")).toBeNull();
  });

  it("shows the empty state once the only due card has been graded", async () => {
    mockGetDeck.mockResolvedValue({
      id: "world-capitals",
      name: "World Capitals",
      cards: [deckFixture().cards[0]],
    });
    await render(<StudyScreen />);

    await waitFor(() => expect(screen.getByText("France")).toBeOnTheScreen());
    await fireEvent.press(screen.getByText("France"));
    await fireEvent.press(await screen.findByTestId("grade-forgotten"));

    await waitFor(() =>
      expect(mockTrackCardGraded).toHaveBeenCalledWith({
        deckId: "world-capitals",
        grade: "forgotten",
      }),
    );
    expect(screen.getByTestId("study-done")).toBeOnTheScreen();
    expect(screen.queryByTestId("study-card")).toBeNull();
  });
});
