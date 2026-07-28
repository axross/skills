// Exit-code smoke contract for check-component-styles.mjs.
//
// Documented contract: 0 when every checked file passes, 1 on any violation or
// an unreadable path, 2 on a bad invocation.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkStyles = validator(SCRIPTS.checkComponentStyles);

/** A CSS Module satisfying every floor check the script implements. */
const CONFORMING_MODULE = `@layer components {
  @scope (.card) {
    :where(:scope) {
      padding: var(--spacing-16);
      border-radius: var(--radius-8);
      color: var(--color-text-primary);
      transition: opacity var(--duration-fast) var(--easing-standard);
    }
  }
}
`;

/** Write a CSS Module into a fresh temp directory. */
async function cssModule(content) {
  const root = await tempDir();
  return writeFileIn(root, "card.module.css", content);
}

describe("check-component-styles.mjs", () => {
  it("exits 0 on a conforming CSS Module", async () => {
    const file = await cssModule(CONFORMING_MODULE);

    expect(checkStyles(file)).toPassCleanly();
  });

  it.each([
    {
      what: "a raw colour literal where a token belongs",
      content: CONFORMING_MODULE.replace("var(--color-text-primary)", "#1a1a1a"),
      reported: /#1a1a1a/,
    },
    {
      what: "a raw length on a token-required property",
      content: CONFORMING_MODULE.replace("var(--spacing-16)", "16px"),
      reported: /`padding` uses a raw length/,
    },
    {
      what: "no components layer",
      content: ":where(:scope) { color: var(--color-text-primary); }\n",
      reported: /@layer components/,
    },
  ])("exits 1 on $what", async ({ content, reported }) => {
    const file = await cssModule(content);

    expect(checkStyles(file)).toReportFailure(reported);
  });

  it("exits 1 when a path cannot be read", async () => {
    const root = await tempDir();

    expect(checkStyles(`${root}/missing.module.css`)).toExitWith(1);
  });

  it("exits 2 when given no paths", () => {
    const result = checkStyles();

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Usage: check-component-styles\.mjs/);
  });

  it("prints usage on --help", () => {
    const result = checkStyles("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-component-styles\.mjs/);
  });
});
