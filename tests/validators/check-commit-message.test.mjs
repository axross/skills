// Exit-code smoke contract for check-commit-message.mjs.
//
// Documented contract: 0 when the header conforms (warnings may still print), 1
// on one or more MUST violations, 2 when no message could be read.

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, runScript, validator } from "../helpers/run.mjs";

const checkCommitMessage = validator(SCRIPTS.checkCommitMessage);
const checkMessage = (message) =>
  runScript(SCRIPTS.checkCommitMessage, [], { input: message });

describe("check-commit-message.mjs", () => {
  describe("exit 0 — a conforming header", () => {
    it("accepts a header with a type, scope, and description", () => {
      const result = checkMessage("feat(skills): add a structure validator\n");

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/conforms to Conventional Commits/);
    });

    it("accepts a header with a body separated by a blank line", () => {
      const result = checkMessage(
        "fix: stop dropping the trailing fence\n\nThe parser closed on any marker.\n",
      );

      expect(result).toPassCleanly();
    });

    it("reads the message from a file argument", async () => {
      const root = await tempDir();
      await writeFileIn(root, "COMMIT_EDITMSG", "docs: correct the exit codes\n");

      expect(checkCommitMessage(join(root, "COMMIT_EDITMSG"))).toPassCleanly();
    });

    it("keeps a soft-limit deviation a warning rather than a failure", () => {
      const result = checkMessage(`chore: ${"x".repeat(80)}\n`);

      expect(result, "a SHOULD deviation must not fail the run").toPassCleanly();
      expect(result.stderr).toMatch(/^warning: /m);
    });
  });

  describe("exit 1 — MUST violations", () => {
    it.each([
      {
        violation: "an unknown type",
        message: "nope: do a thing\n",
        reported: /type "nope" is not one of/,
      },
      {
        violation: "empty scope parentheses",
        message: "feat(): do a thing\n",
        reported: /scope parentheses are empty/,
      },
      {
        violation: "a description ending in a period",
        message: "feat: do a thing.\n",
        reported: /must not end with a period/,
      },
      {
        violation: "a missing blank line between header and body",
        message: "feat: do a thing\nstraight into the body\n",
        reported: /the line after the header must be blank/,
      },
    ])("rejects $violation", ({ message, reported }) => {
      expect(checkMessage(message)).toReportFailure(reported);
    });
  });

  describe("exit 2 — nothing to read", () => {
    it("exits 2 on an empty message", () => {
      const result = checkMessage("");

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/No commit message supplied/);
    });

    it("exits 2 when the message file cannot be read", async () => {
      const root = await tempDir();

      const result = checkCommitMessage(join(root, "does-not-exist"));

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Cannot read message file/);
    });
  });

  it("prints usage on --help", () => {
    const result = checkCommitMessage("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-commit-message\.mjs/);
  });
});
