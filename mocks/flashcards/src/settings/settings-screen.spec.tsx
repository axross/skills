import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { SettingsScreen } from "./settings-screen";

const mockSignOut = jest.fn();

jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    session: { accountId: "local-1", email: "person@example.com" },
    status: "ready",
    signIn: jest.fn(),
    signOut: mockSignOut,
  }),
}));

beforeEach(() => {
  mockSignOut.mockReset().mockResolvedValue(undefined);
});

describe("SettingsScreen", () => {
  it("shows the signed-in address", async () => {
    await render(<SettingsScreen />);

    expect(screen.getByTestId("settings-email")).toHaveTextContent(
      "person@example.com",
    );
  });

  it("signs out when the sign-out button is pressed", async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });
});
