import AsyncStorage from "@react-native-async-storage/async-storage";

import { forgetUser, identifyUser } from "@/analytics/analytics";

export type Session = {
  accountId: string;
  email: string;
};

const STORAGE_KEY = "recall.session.v1";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidEmailError extends Error {
  constructor(email: string) {
    super(`"${email}" is not a valid email address.`);
    this.name = "InvalidEmailError";
  }
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

function createAccountId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Validates the address's shape and issues a local account id. There is no
 * backend behind this — it is a declared stand-in for one, not a defect.
 */
export async function signIn(email: string): Promise<Session> {
  const trimmed = email.trim();
  if (!isValidEmail(trimmed)) {
    throw new InvalidEmailError(trimmed);
  }

  const session: Session = { accountId: createAccountId(), email: trimmed };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  identifyUser(session.accountId);
  return session;
}

/**
 * Clears the local session and forgets the analytics identity. This is the
 * only place `forgetUser` (and so the underlying `reset()`) is called.
 */
export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  forgetUser();
}

export async function getSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    // A value a previous version of the app wrote, or one that is simply
    // corrupt, is untrusted the same way a credential is — see
    // data-and-storage.md. Clear it and fall back to signed out rather than
    // letting it fail the app's launch.
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
