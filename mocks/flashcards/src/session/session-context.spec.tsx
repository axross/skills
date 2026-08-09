import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, Text } from "react-native";

import { SessionProvider, useSession } from "./session-context";

// Exercises the real session module and the real (key-less, so silently
// no-op) analytics module — this is an integration test of the provider,
// not a unit test of either dependency.

function Probe() {
  const { session, status, signIn, signOut } = useSession();

  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="email">{session?.email ?? "none"}</Text>
      <Pressable
        testID="sign-in"
        onPress={() => void signIn("person@example.com")}
      />
      <Pressable testID="sign-out" onPress={() => void signOut()} />
    </>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SessionProvider", () => {
  it("resolves to no session once loading finishes", async () => {
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });

  it("signs in and makes the session available", async () => {
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );

    await fireEvent.press(screen.getByTestId("sign-in"));

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent(
        "person@example.com",
      ),
    );
  });

  it("signs out and clears the session", async () => {
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    await fireEvent.press(screen.getByTestId("sign-in"));
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent(
        "person@example.com",
      ),
    );

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("none"),
    );
  });

  it("still reaches ready, falling back to signed out, if the session read itself rejects", async () => {
    // Distinct from a corrupt stored value — session.ts already handles that
    // one internally. This is the read rejecting outright, which is what
    // used to leave `status` stuck on "loading" forever.
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("boom"));

    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });
});
