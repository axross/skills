import AsyncStorage from "@react-native-async-storage/async-storage";

import { forgetUser, identifyUser } from "@/analytics/analytics";

import {
  InvalidEmailError,
  getSession,
  isValidEmail,
  signIn,
  signOut,
} from "./session";

jest.mock("@/analytics/analytics", () => ({
  identifyUser: jest.fn(),
  forgetUser: jest.fn(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("isValidEmail", () => {
  it.each([
    "person@example.com",
    "  person@example.com  ",
    "a.b+c@sub.example.co",
  ])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    "",
    "not-an-email",
    "missing-domain@",
    "@missing-local.com",
    "no-at-sign.com",
  ])("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("signIn", () => {
  it("rejects a malformed address without persisting a session", async () => {
    await expect(signIn("not-an-email")).rejects.toBeInstanceOf(
      InvalidEmailError,
    );

    expect(await getSession()).toBeNull();
    expect(identifyUser).not.toHaveBeenCalled();
  });

  it("issues a session for a well-formed address and persists it", async () => {
    const session = await signIn("  Person@Example.com  ");

    expect(session.email).toBe("Person@Example.com");
    expect(session.accountId.length).toBeGreaterThan(0);
    expect(await getSession()).toEqual(session);
  });

  it("identifies the new account, and does not forget it", async () => {
    const session = await signIn("person@example.com");

    expect(identifyUser).toHaveBeenCalledWith(session.accountId);
    expect(forgetUser).not.toHaveBeenCalled();
  });

  it("issues a different account id on each sign-in", async () => {
    const first = await signIn("person@example.com");
    await signOut();
    const second = await signIn("person@example.com");

    expect(second.accountId).not.toBe(first.accountId);
  });
});

describe("signOut", () => {
  it("clears the persisted session and forgets the identity", async () => {
    await signIn("person@example.com");

    await signOut();

    expect(await getSession()).toBeNull();
    expect(forgetUser).toHaveBeenCalledTimes(1);
    expect(identifyUser).toHaveBeenCalledTimes(1); // only from the earlier sign-in
  });

  it("is safe to call with no session", async () => {
    await expect(signOut()).resolves.toBeUndefined();
    expect(forgetUser).toHaveBeenCalledTimes(1);
  });
});

describe("getSession", () => {
  it("returns null when nothing is stored", async () => {
    expect(await getSession()).toBeNull();
  });
});
