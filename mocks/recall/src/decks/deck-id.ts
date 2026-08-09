/**
 * A route's `deckId` parameter is untrusted input — Expo Router hands back
 * whatever the URL held, including an empty string, a repeated segment as
 * an array, or nothing at all. Normalizing it here, before any lookup
 * trusts it, is what lets a screen render a not-found state instead of
 * chasing a malformed id into a repository call.
 */
export function normalizeDeckId(
  raw: string | string[] | undefined,
): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
