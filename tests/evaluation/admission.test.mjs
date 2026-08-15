// admitDispatch: the exact-probe-count admission bound, with no dollar
// figure anywhere.

import { describe, expect, it } from "vitest";

import { admitDispatch } from "../../tools/evaluation/src/admission.mjs";

describe("admitDispatch", () => {
  it("admits unconditionally when no limit is declared", () => {
    expect(admitDispatch({ probeCount: 1000, limit: null }).admitted).toBe(true);
    expect(admitDispatch({ probeCount: 1000, limit: undefined }).admitted).toBe(true);
  });

  it("admits a count at or under the limit", () => {
    expect(admitDispatch({ probeCount: 6, limit: 6 }).admitted).toBe(true);
    expect(admitDispatch({ probeCount: 5, limit: 6 }).admitted).toBe(true);
  });

  // negative control 4/5: a probe count over the limit is refused before
  // any probe starts, and the reason names both the count and the limit.
  it("refuses a count over the limit, naming both", () => {
    const outcome = admitDispatch({ probeCount: 7, limit: 6 });
    expect(outcome.admitted).toBe(false);
    expect(outcome.reason).toContain("7");
    expect(outcome.reason).toContain("6");
  });

  it("never mentions a dollar figure in its reason, either way", () => {
    const admitted = admitDispatch({ probeCount: 3, limit: null });
    const refused = admitDispatch({ probeCount: 30, limit: 3 });
    expect(admitted.reason).not.toMatch(/\$|usd|cost|dollar/i);
    expect(refused.reason).not.toMatch(/\$|usd|cost|dollar/i);
  });
});
