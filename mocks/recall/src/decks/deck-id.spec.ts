import { normalizeDeckId } from "./deck-id";

describe("normalizeDeckId", () => {
  it("accepts a well-formed id", () => {
    expect(normalizeDeckId("world-capitals")).toBe("world-capitals");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeDeckId("  world-capitals  ")).toBe("world-capitals");
  });

  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
    ["only whitespace", "   "],
    ["a repeated-segment array", ["world-capitals", "extra"]],
  ])("rejects %s", (_label, raw) => {
    expect(normalizeDeckId(raw)).toBeNull();
  });
});
