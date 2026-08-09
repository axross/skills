import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { InvalidEmailError } from "./session";
import { SignInScreen } from "./sign-in-screen";

const mockSignIn = jest.fn();
const mockTrackScreenView = jest.fn();

jest.mock("./session-context", () => ({
  useSession: () => ({
    session: null,
    status: "ready",
    signIn: mockSignIn,
    signOut: jest.fn(),
  }),
}));

jest.mock("@/analytics/analytics", () => ({
  trackScreenView: (...args: unknown[]) => mockTrackScreenView(...args),
}));

beforeEach(() => {
  mockSignIn.mockReset();
  mockTrackScreenView.mockReset();
});

describe("SignInScreen", () => {
  it("tracks a screen view on mount", async () => {
    await render(<SignInScreen />);

    expect(mockTrackScreenView).toHaveBeenCalledWith("Sign In");
  });

  it("shows a validation error for a malformed address", async () => {
    mockSignIn.mockRejectedValueOnce(new InvalidEmailError("not-an-email"));
    await render(<SignInScreen />);

    await fireEvent.changeText(
      screen.getByTestId("sign-in-email"),
      "not-an-email",
    );
    await fireEvent.press(screen.getByTestId("sign-in-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("sign-in-email-error")).toHaveTextContent(
        '"not-an-email" is not a valid email address.',
      ),
    );
  });

  it("shows a pending state while signing in, then clears it", async () => {
    let resolveSignIn: () => void = () => {};
    mockSignIn.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    await render(<SignInScreen />);

    await fireEvent.changeText(
      screen.getByTestId("sign-in-email"),
      "person@example.com",
    );
    // Not awaited: this press's handler awaits `signIn`, which this test
    // deliberately leaves unresolved until `resolveSignIn()` below — so
    // awaiting the press itself here would wait for that handler to finish
    // and deadlock before the test ever gets to resolve it.
    fireEvent.press(screen.getByTestId("sign-in-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("sign-in-submit")).toHaveTextContent(
        "Signing in…",
      ),
    );

    resolveSignIn();

    await waitFor(() =>
      expect(screen.getByTestId("sign-in-submit")).toHaveTextContent("Sign in"),
    );
    expect(mockSignIn).toHaveBeenCalledWith("person@example.com");
  });
});
