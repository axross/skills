import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { SessionProvider } from "@/session/session-context";

import { SettingsScreen } from "./settings-screen";

// Mocked at the session module, not at the context, so the real
// SessionProvider/useSession wiring runs — that's what proves a rejected
// sign-out really does leave the session in place, rather than just
// asserting a mocked function was called.
const mockGetSession = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/session/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("@/analytics/analytics", () => ({
  trackScreenView: jest.fn(),
}));

const SESSION = { accountId: "local-1", email: "person@example.com" };

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue(SESSION);
  mockSignIn.mockReset();
  mockSignOut.mockReset().mockResolvedValue(undefined);
});

async function renderSignedIn() {
  await render(
    <SessionProvider>
      <SettingsScreen />
    </SessionProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("settings-email")).toHaveTextContent(
      "person@example.com",
    ),
  );
}

describe("SettingsScreen", () => {
  it("shows the signed-in address", async () => {
    await renderSignedIn();
  });

  it("signs out when the sign-out button is pressed", async () => {
    await renderSignedIn();

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  it("shows a visible error and leaves the session in place when sign-out fails", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("boom"));
    await renderSignedIn();

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't sign out. Try again."),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByTestId("settings-email")).toHaveTextContent(
      "person@example.com",
    );
  });
});
