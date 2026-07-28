// Exit-code smoke contract for check-commit-message.mjs.
//
// Documented contract: 0 when the header conforms (warnings may still print), 1
// on one or more MUST violations, 2 when no message could be read.

import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { tempDir, writeFileIn } from "./helpers/fixtures.mjs";
import { SCRIPTS, runNodeScript } from "./helpers/run.mjs";

const checkMessage = (message) =>
  runNodeScript(SCRIPTS.checkCommitMessage, [], { input: message });

describe("check-commit-message.mjs", () => {
  describe("exit 0 — a conforming header", () => {
    it("accepts a header with a type, scope, and description", () => {
      const result = checkMessage("feat(skills): add a structure validator\n");

      assert.equal(result.code, 0);
      assert.match(result.stdout, /conforms to Conventional Commits/);
    });

    it("accepts a header with a body separated by a blank line", () => {
      const result = checkMessage(
        "fix: stop dropping the trailing fence\n\nThe parser closed on any marker.\n",
      );

      assert.equal(result.code, 0);
    });

    it("reads the message from a file argument", async (t) => {
      const root = await tempDir(t);
      await writeFileIn(root, "COMMIT_EDITMSG", "docs: correct the exit codes\n");

      const result = runNodeScript(SCRIPTS.checkCommitMessage, [
        join(root, "COMMIT_EDITMSG"),
      ]);

      assert.equal(result.code, 0);
    });

    it("keeps a soft-limit deviation a warning rather than a failure", () => {
      const result = checkMessage(`chore: ${"x".repeat(80)}\n`);

      assert.equal(result.code, 0, "a SHOULD deviation must not fail the run");
      assert.match(result.stderr, /^warning: /m);
    });
  });

  describe("exit 1 — MUST violations", () => {
    it("rejects an unknown type", () => {
      const result = checkMessage("nope: do a thing\n");

      assert.equal(result.code, 1);
      assert.match(result.stderr, /type "nope" is not one of/);
    });

    it("rejects empty scope parentheses", () => {
      const result = checkMessage("feat(): do a thing\n");

      assert.equal(result.code, 1);
      assert.match(result.stderr, /scope parentheses are empty/);
    });

    it("rejects a description ending in a period", () => {
      const result = checkMessage("feat: do a thing.\n");

      assert.equal(result.code, 1);
      assert.match(result.stderr, /must not end with a period/);
    });

    it("rejects a missing blank line between header and body", () => {
      const result = checkMessage("feat: do a thing\nstraight into the body\n");

      assert.equal(result.code, 1);
      assert.match(result.stderr, /the line after the header must be blank/);
    });
  });

  describe("exit 2 — nothing to read", () => {
    it("exits 2 on an empty message", () => {
      const result = checkMessage("");

      assert.equal(result.code, 2);
      assert.match(result.stderr, /No commit message supplied/);
    });

    it("exits 2 when the message file cannot be read", async (t) => {
      const root = await tempDir(t);

      const result = runNodeScript(SCRIPTS.checkCommitMessage, [
        join(root, "does-not-exist"),
      ]);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /Cannot read message file/);
    });
  });
});
