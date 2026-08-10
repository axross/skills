// the own / colliding / foreign classification of what the CLI reported
// loading.

import { describe, expect, it } from "vitest";

import { INVOCABLE, NOT_INVOCABLE, UNRECOGNISED } from "../../tools/discovery-eval/src/fingerprint.mjs";
import { classifyLoaded, contamination } from "../../tools/discovery-eval/src/isolation.mjs";

describe("classifyLoaded", () => {
  it("classifies a legitimately user-invocable skill of ours as own", () => {
    // named for the skill that actually carries `user-invocable: true` in this
    // corpus, so the example does not quietly teach a wrong fact about it.
    const result = classifyLoaded(["living-product-specification"], {
      "living-product-specification": INVOCABLE,
    });
    expect(result).toEqual({ own: ["living-product-specification"], colliding: [], foreign: [] });
  });

  it("classifies a name matching one of ours that is NOT invocable as colliding", () => {
    // that corpus skill carries user-invocable: false, so it can never
    // legitimately appear in a loaded list on its own account — something
    // else is wearing its name.
    const result = classifyLoaded(["unit-testing"], { "unit-testing": NOT_INVOCABLE });
    expect(result).toEqual({ own: [], colliding: ["unit-testing"], foreign: [] });
  });

  it("classifies a name outside the corpus entirely as foreign", () => {
    const result = classifyLoaded(["some-other-teams-skill"], { "unit-testing": NOT_INVOCABLE });
    expect(result).toEqual({ own: [], colliding: [], foreign: ["some-other-teams-skill"] });
  });

  it("classifies an unrecognised invocability value as colliding, never as own", () => {
    const result = classifyLoaded(["mystery"], { mystery: UNRECOGNISED });
    expect(result.own).toEqual([]);
    expect(result.colliding).toEqual(["mystery"]);
  });

  it("de-duplicates and sorts each bucket", () => {
    const result = classifyLoaded(["b", "a", "a"], { a: INVOCABLE, b: INVOCABLE });
    expect(result.own).toEqual(["a", "b"]);
  });

  it("sorts a mix across all three buckets independently", () => {
    const result = classifyLoaded(["zeta-own", "alpha-foreign", "mid-colliding"], {
      "zeta-own": INVOCABLE,
      "mid-colliding": NOT_INVOCABLE,
    });
    expect(result).toEqual({
      own: ["zeta-own"],
      colliding: ["mid-colliding"],
      foreign: ["alpha-foreign"],
    });
  });

  it("returns empty buckets for an empty loaded list", () => {
    expect(classifyLoaded([], {})).toEqual({ own: [], colliding: [], foreign: [] });
  });
});

describe("contamination", () => {
  it("is colliding and foreign together, sorted, never own", () => {
    expect(contamination({ own: ["z"], colliding: ["b"], foreign: ["a"] })).toEqual(["a", "b"]);
  });

  it("is empty when nothing collided or came from outside", () => {
    expect(contamination({ own: ["a"], colliding: [], foreign: [] })).toEqual([]);
  });
});
