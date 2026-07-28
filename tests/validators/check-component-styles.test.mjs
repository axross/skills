// Exit-code smoke contract for check-component-styles.mjs.
//
// Documented contract: 0 when every checked file passes, 1 on any violation or
// an unreadable path, 2 on a bad invocation.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tempDir, writeFileIn } from "./helpers/fixtures.mjs";
import { SCRIPTS, runNodeScript } from "./helpers/run.mjs";

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

const checkStyles = (...args) =>
  runNodeScript(SCRIPTS.checkComponentStyles, args);

describe("check-component-styles.mjs", () => {
  it("exits 0 on a conforming CSS Module", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(root, "card.module.css", CONFORMING_MODULE);

    const result = checkStyles(file);

    assert.equal(result.code, 0, result.output);
  });

  it("exits 1 on a raw colour literal where a token belongs", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "card.module.css",
      CONFORMING_MODULE.replace("var(--color-text-primary)", "#1a1a1a"),
    );

    const result = checkStyles(file);

    assert.equal(result.code, 1);
    assert.match(result.output, /#1a1a1a/);
  });

  it("exits 1 on a raw length on a token-required property", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "card.module.css",
      CONFORMING_MODULE.replace("var(--spacing-16)", "16px"),
    );

    assert.equal(checkStyles(file).code, 1);
  });

  it("exits 1 when the module declares no components layer", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "card.module.css",
      ":where(:scope) { color: var(--color-text-primary); }\n",
    );

    const result = checkStyles(file);

    assert.equal(result.code, 1);
    assert.match(result.output, /@layer components/);
  });

  it("exits 1 when a path cannot be read", async (t) => {
    const root = await tempDir(t);

    assert.equal(checkStyles(`${root}/missing.module.css`).code, 1);
  });

  it("exits 2 when given no paths", () => {
    const result = checkStyles();

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage: node check-component-styles\.mjs/);
  });
});
